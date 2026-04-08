"""
Unified LLM client — routes to OpenAI SDK or Anthropic SDK based on LLM_PROVIDER.

  LLM_PROVIDER=openai (default)
    - chat/agentic_loop: client.chat.completions.create  (OpenAI function-calling)
    - research_chat:     client.responses.create         (OpenAI Responses API + web_search)
    - LLM_BASE_URL must include /v1

  LLM_PROVIDER=anthropic
    - chat/agentic_loop: client.messages.create          (Anthropic tool_use)
    - research_chat:     client.messages.create          (with web_search_20250305 built-in)
    - LLM_BASE_URL must NOT include /v1
"""

import json
import os
from typing import Any

from app.config import settings
from app.utils.logger import logger

# ── Langfuse v4 (optional) ─────────────────────────────────────────────────────
# IMPORTANT: env vars must be set BEFORE importing langfuse, because it reads
# them at module load time when initializing the singleton client.
if settings.LANGFUSE_SECRET_KEY:
    os.environ["LANGFUSE_SECRET_KEY"] = settings.LANGFUSE_SECRET_KEY
if settings.LANGFUSE_PUBLIC_KEY:
    os.environ["LANGFUSE_PUBLIC_KEY"] = settings.LANGFUSE_PUBLIC_KEY
if settings.LANGFUSE_HOST:
    os.environ["LANGFUSE_HOST"] = settings.LANGFUSE_HOST

try:
    from langfuse import observe as _lf_observe, get_client as _lf_get_client
    _LANGFUSE_ENABLED = bool(settings.LANGFUSE_SECRET_KEY)
    if _LANGFUSE_ENABLED:
        logger.info("Langfuse observability enabled")
except ImportError:
    _LANGFUSE_ENABLED = False

    def _lf_observe(*args, **kwargs):  # type: ignore
        def decorator(fn):
            return fn
        return decorator

    def _lf_get_client():  # type: ignore
        class _Noop:
            def update_current_generation(self, **kw): pass
            def update_current_span(self, **kw): pass
            def set_current_trace_io(self, *a, **kw): pass
        return _Noop()


def _openai_tools_to_anthropic(tools: list[dict]) -> list[dict]:
    """Convert OpenAI {type:function, function:{name,description,parameters}} → Anthropic {name,description,input_schema}."""
    result = []
    for t in tools:
        fn = t["function"]
        result.append({
            "name": fn["name"],
            "description": fn.get("description", ""),
            "input_schema": fn["parameters"],
        })
    return result


def _extract_system(messages: list[dict]) -> tuple[str, list[dict]]:
    """Split out the system message for Anthropic SDK (which takes system as a separate param)."""
    system = ""
    rest = []
    for m in messages:
        if m["role"] == "system":
            system = m["content"]
        else:
            rest.append(m)
    return system, rest


class LLMClient:
    """
    Provider-agnostic LLM client. Callers always pass messages in OpenAI format
    (system as {"role": "system", "content": ...} in the messages list).

    The client is created fresh on each call so that hot-updated settings
    (via PUT /api/settings) take effect without restarting the server.
    """

    @property
    def provider(self) -> str:
        return settings.LLM_PROVIDER.lower()

    def _get_client(self):
        if self.provider == "anthropic":
            import anthropic
            return anthropic.AsyncAnthropic(
                api_key=settings.LLM_API_KEY,
                base_url=settings.LLM_BASE_URL,
            )
        else:
            from openai import AsyncOpenAI
            return AsyncOpenAI(
                api_key=settings.LLM_API_KEY,
                base_url=settings.LLM_BASE_URL,
            )

    # ── Public interface ────────────────────────────────────────────────────

    @_lf_observe(name="agentic_loop", as_type="agent")
    async def agentic_loop(
        self,
        messages: list[dict],
        tools: list[dict],
        tool_executor: Any,
    ) -> tuple[str, list[str], dict | None]:
        """
        Run a tool-use loop until the model produces a final text reply.
        Returns (reply_text, actions_taken, intent_json).
        tools must be in OpenAI function-calling format.
        """
        if self.provider == "anthropic":
            result = await self._agentic_loop_anthropic(messages, tools, tool_executor)
        else:
            result = await self._agentic_loop_openai(messages, tools, tool_executor)
        reply_text, actions_taken, _ = result
        _lf_get_client().update_current_span(
            metadata={"actions": actions_taken, "provider": self.provider,
                      "tools": [t.get("function", {}).get("name") for t in tools]},
        )
        return result

    @_lf_observe(name="simple_chat", as_type="generation")
    async def simple_chat(self, messages: list[dict], max_tokens: int = 2048) -> str:
        """Single-turn text completion, no tools."""
        if self.provider == "anthropic":
            result = await self._simple_chat_anthropic(messages, max_tokens)
        else:
            result = await self._simple_chat_openai(messages, max_tokens)
        _lf_get_client().update_current_generation(
            model=settings.LLM_MODEL,
            metadata={"provider": self.provider},
        )
        return result

    @_lf_observe(name="research_chat", as_type="generation")
    async def research_chat(self, messages: list[dict], max_tokens: int = 8192) -> str:
        """
        Text completion with web search enabled.
        OpenAI: uses Responses API (responses.create) with web_search tool.
        Anthropic: uses Messages API with built-in web_search_20250305 tool.
        """
        if self.provider == "anthropic":
            result = await self._research_chat_anthropic(messages, max_tokens)
        else:
            result = await self._research_chat_openai(messages, max_tokens)
        _lf_get_client().update_current_generation(
            model=settings.LLM_MODEL,
            metadata={"provider": self.provider},
        )
        return result

    # ── OpenAI implementations ──────────────────────────────────────────────

    async def _agentic_loop_openai(
        self, messages: list[dict], tools: list[dict], tool_executor: Any
    ) -> tuple[str, list[str], dict | None]:
        actions_taken: list[str] = []
        intent_json: dict | None = None
        reply_text = ""
        msgs = list(messages)

        while True:
            response = await self._get_client().chat.completions.create(
                model=settings.LLM_MODEL,
                max_tokens=4096,
                messages=msgs,
                tools=tools,
                tool_choice="auto",
            )
            choice = response.choices[0]
            msg = choice.message

            msg_dict: dict = {"role": "assistant", "content": msg.content}
            if msg.tool_calls:
                msg_dict["tool_calls"] = [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                    }
                    for tc in msg.tool_calls
                ]
            msgs.append(msg_dict)

            if choice.finish_reason == "stop":
                reply_text = msg.content or ""
                break

            if choice.finish_reason == "tool_calls":
                for tc in msg.tool_calls:
                    tool_name = tc.function.name
                    tool_args = json.loads(tc.function.arguments)
                    logger.info(f"CA tool call [{self.provider}]: {tool_name} args={list(tool_args.keys())}")
                    result = await tool_executor.execute(tool_name, tool_args)
                    actions_taken.append(f"{tool_name}: {list(tool_args.keys())}")
                    if intent_json is None:
                        intent_json = {"action": tool_name, "params": tool_args}
                    msgs.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": json.dumps(result, ensure_ascii=False, default=str),
                    })
            else:
                reply_text = "发生了意外的错误，请重试。"
                break

        return reply_text, actions_taken, intent_json

    async def _simple_chat_openai(self, messages: list[dict], max_tokens: int) -> str:
        response = await self._get_client().chat.completions.create(
            model=settings.LLM_MODEL,
            max_tokens=max_tokens,
            messages=messages,
        )
        return response.choices[0].message.content or ""

    async def _research_chat_openai(self, messages: list[dict], max_tokens: int) -> str:
        # Responses API requires string input (verified with geekai.co proxy).
        # Passing a messages list causes "Missing required parameter: 'input'" on some proxies.
        # Concatenate system instructions + user prompt into a single string.
        parts = [m["content"] for m in messages if m.get("content")]
        combined_input = "\n\n---\n\n".join(parts)
        response = await self._get_client().responses.create(
            model=settings.LLM_MODEL,
            input=combined_input,
            tools=[{
                "type": "web_search",
                "search_context_size": settings.WEB_SEARCH_CONTEXT_SIZE,
            }],
        )
        return response.output_text

    # ── Anthropic implementations ───────────────────────────────────────────

    async def _agentic_loop_anthropic(
        self, messages: list[dict], tools: list[dict], tool_executor: Any
    ) -> tuple[str, list[str], dict | None]:
        anthropic_tools = _openai_tools_to_anthropic(tools)
        system, msgs = _extract_system(messages)
        actions_taken: list[str] = []
        intent_json: dict | None = None
        reply_text = ""

        while True:
            response = await self._get_client().messages.create(
                model=settings.LLM_MODEL,
                max_tokens=4096,
                system=system,
                messages=msgs,
                tools=anthropic_tools,
            )
            msgs.append({"role": "assistant", "content": response.content})

            if response.stop_reason == "end_turn":
                for block in response.content:
                    if hasattr(block, "text"):
                        reply_text += block.text
                break

            if response.stop_reason == "tool_use":
                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        tool_name = block.name
                        tool_args = block.input
                        logger.info(f"CA tool call [{self.provider}]: {tool_name} args={list(tool_args.keys())}")
                        result = await tool_executor.execute(tool_name, tool_args)
                        actions_taken.append(f"{tool_name}: {list(tool_args.keys())}")
                        if intent_json is None:
                            intent_json = {"action": tool_name, "params": tool_args}
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(result, ensure_ascii=False, default=str),
                        })
                msgs.append({"role": "user", "content": tool_results})
            else:
                reply_text = "发生了意外的错误，请重试。"
                break

        return reply_text, actions_taken, intent_json

    async def _simple_chat_anthropic(self, messages: list[dict], max_tokens: int) -> str:
        system, msgs = _extract_system(messages)
        response = await self._get_client().messages.create(
            model=settings.LLM_MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=msgs,
        )
        return response.content[0].text

    async def _research_chat_anthropic(self, messages: list[dict], max_tokens: int) -> str:
        system, msgs = _extract_system(messages)
        response = await self._get_client().messages.create(
            model=settings.LLM_MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=msgs,
            tools=[{"type": "web_search_20260209", "name": "web_search"}],
        )
        full_text = ""
        for block in response.content:
            if hasattr(block, "text"):
                full_text += block.text
        return full_text
