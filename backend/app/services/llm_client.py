"""
Unified LLM client — routes to OpenAI SDK or Anthropic SDK based on LLM_PROVIDER.

  LLM_PROVIDER=openai (default)
    - chat/agentic_loop: client.chat.completions.create  (OpenAI function-calling)
    - research_chat:     client.responses.create         (OpenAI Responses API + web_search)
    - LLM_BASE_URL must include /v1

  LLM_PROVIDER=anthropic
    - chat/agentic_loop: client.messages.create          (Anthropic tool_use)
    - research_chat:     client.messages.create          (with web_search_20260209 built-in)
    - LLM_BASE_URL must NOT include /v1
"""

import json
import time
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

from app.config import settings
from app.utils.logger import logger

# ── LLM trace helpers ──────────────────────────────────────────────────────────
# Every LLM call writes one JSON line to logs/llm_trace.jsonl via the dedicated
# loguru sink (filtered by extra["llm_trace"]).  Read with:
#   tail -f logs/llm_trace.jsonl | python -m json.tool
#   cat logs/llm_trace.jsonl | jq 'select(.method=="agentic_loop_stream")'

_trace_log = logger.bind(llm_trace=True)


def _fmt_messages(messages: list[dict]) -> list[dict]:
    """Return a copy of messages with long content truncated for readability."""
    out = []
    for i, m in enumerate(messages):
        role = m.get("role", "?")
        content = m.get("content") or ""
        if isinstance(content, list):
            # Anthropic-style content blocks — stringify for the trace
            content = json.dumps(content, ensure_ascii=False)
        content = str(content)
        # System prompt is usually long; give last user message the most room
        if role == "system":
            limit = 400
        elif i == len(messages) - 1 and role == "user":
            limit = 2000
        else:
            limit = 800
        if len(content) > limit:
            content = content[:limit] + f" …(+{len(content) - limit} chars)"
        entry: dict = {"role": role, "content": content}
        # Preserve tool_calls summary for agentic context
        if m.get("tool_calls"):
            entry["tool_calls"] = [
                tc.get("function", {}).get("name") for tc in m["tool_calls"]
            ]
        out.append(entry)
    return out


def _write_trace(
    method: str,
    messages: list[dict],
    output: str,
    duration_ms: int,
    available_tools: list[str] | None = None,
    actions: list[str] | None = None,
    error: str | None = None,
) -> None:
    record: dict = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
        "method": method,
        "provider": settings.LLM_PROVIDER,
        "model": settings.LLM_MODEL,
        "available_tools": available_tools,
        "messages": _fmt_messages(messages),
        "output": output[:2000] + f" …(+{len(output)-2000} chars)" if len(output) > 2000 else output,
        "duration_ms": duration_ms,
    }
    if actions is not None:
        record["actions"] = actions
    if error is not None:
        record["error"] = error
    _trace_log.debug(json.dumps(record, ensure_ascii=False))


# Human-readable labels shown in the frontend spinner when CA calls a tool
TOOL_LABELS: dict[str, str] = {
    "update_project": "正在更新项目信息...",
    "clarify_requirement": "正在保存需求画像...",
    "search_talent_pool": "正在搜索人才库...",
    "trigger_evaluation": "正在评估候选人...",
    "request_industry_research": "正在触发行业调研...",
    "update_preference": "正在记录偏好反馈...",
}


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
        t0 = time.monotonic()
        error: str | None = None
        reply_text = ""
        actions_taken: list[str] = []
        tool_names = [t.get("function", {}).get("name") for t in tools]
        try:
            if self.provider == "anthropic":
                result = await self._agentic_loop_anthropic(messages, tools, tool_executor)
            else:
                result = await self._agentic_loop_openai(messages, tools, tool_executor)
            reply_text, actions_taken, _ = result
            return result
        except Exception as exc:
            error = str(exc)
            raise
        finally:
            _write_trace(
                method="agentic_loop",
                messages=messages,
                output=reply_text,
                duration_ms=int((time.monotonic() - t0) * 1000),
                available_tools=tool_names,
                actions=actions_taken,
                error=error,
            )

    async def simple_chat(self, messages: list[dict], max_tokens: int = 2048) -> str:
        """Single-turn text completion, no tools."""
        t0 = time.monotonic()
        error: str | None = None
        result = ""
        try:
            if self.provider == "anthropic":
                result = await self._simple_chat_anthropic(messages, max_tokens)
            else:
                result = await self._simple_chat_openai(messages, max_tokens)
            return result
        except Exception as exc:
            error = str(exc)
            raise
        finally:
            _write_trace(
                method="simple_chat",
                messages=messages,
                output=result,
                duration_ms=int((time.monotonic() - t0) * 1000),
                error=error,
            )

    async def research_chat(self, messages: list[dict], max_tokens: int = 8192) -> str:
        """
        Text completion with web search enabled.
        OpenAI: uses Responses API (responses.create) with web_search tool.
        Anthropic: uses Messages API with built-in web_search_20250305 tool.
        """
        t0 = time.monotonic()
        error: str | None = None
        result = ""
        try:
            if self.provider == "anthropic":
                result = await self._research_chat_anthropic(messages, max_tokens)
            else:
                result = await self._research_chat_openai(messages, max_tokens)
            return result
        except Exception as exc:
            error = str(exc)
            raise
        finally:
            _write_trace(
                method="research_chat",
                messages=messages,
                output=result,
                duration_ms=int((time.monotonic() - t0) * 1000),
                error=error,
            )

    async def agentic_loop_stream(
        self,
        messages: list[dict],
        tools: list[dict],
        tool_executor: Any,
    ) -> AsyncGenerator[dict, None]:
        """
        Streaming variant of agentic_loop.

        Yields dicts — the caller formats them as SSE:
          {"type": "tool_call", "name": str, "label": str}
              Emitted before each tool executes (spinner upgrade).
          {"type": "text", "delta": str}
              Final reply tokens streamed in real time.
          {"type": "done", "reply_text": str,
           "actions_taken": list[str], "intent_json": dict | None}
              Stream complete; caller should persist reply_text.
          {"type": "error", "message": str}
              On unrecoverable failure.

        Tool-call rounds block (non-streaming) so arguments arrive complete
        before execution.  Only the final text round is truly streamed.
        """
        if self.provider == "anthropic":
            gen = self._agentic_loop_stream_anthropic(messages, tools, tool_executor)
        else:
            gen = self._agentic_loop_stream_openai(messages, tools, tool_executor)

        t0 = time.monotonic()
        error: str | None = None
        tool_names = [t.get("function", {}).get("name") for t in tools]
        try:
            async for event in gen:
                if event.get("type") == "done":
                    _write_trace(
                        method="agentic_loop_stream",
                        messages=messages,
                        output=event.get("reply_text", ""),
                        duration_ms=int((time.monotonic() - t0) * 1000),
                        available_tools=tool_names,
                        actions=event.get("actions_taken"),
                        error=None,
                    )
                elif event.get("type") == "error":
                    error = event.get("message", "unknown stream error")
                    _write_trace(
                        method="agentic_loop_stream",
                        messages=messages,
                        output="",
                        duration_ms=int((time.monotonic() - t0) * 1000),
                        available_tools=tool_names,
                        error=error,
                    )
                yield event
        except Exception as exc:
            error = str(exc)
            _write_trace(
                method="agentic_loop_stream",
                messages=messages,
                output="",
                duration_ms=int((time.monotonic() - t0) * 1000),
                available_tools=tool_names,
                error=error,
            )
            raise

    # ── OpenAI implementations ──────────────────────────────────────────────

    async def _agentic_loop_openai(
        self, messages: list[dict], tools: list[dict], tool_executor: Any,
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
                    _args_preview = json.dumps(tool_args, ensure_ascii=False)
                    if len(_args_preview) > 400:
                        _args_preview = _args_preview[:400] + "…"
                    actions_taken.append(f"{tool_name}: {_args_preview}")
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

    async def _agentic_loop_stream_openai(
        self, messages: list[dict], tools: list[dict], tool_executor: Any,
    ) -> AsyncGenerator[dict, None]:
        actions_taken: list[str] = []
        intent_json: dict | None = None
        msgs = list(messages)

        while True:
            # Stream every LLM call. During tool-call rounds the text delta is
            # typically empty, so no premature text gets shown to the user.
            stream = await self._get_client().chat.completions.create(
                model=settings.LLM_MODEL,
                max_tokens=4096,
                messages=msgs,
                tools=tools,
                tool_choice="auto",
                stream=True,
            )

            content_chunks: list[str] = []
            tool_calls_buffer: dict[int, dict] = {}  # index → {id, name, arguments}
            is_tool_round = False
            finish_reason: str | None = None

            async for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                fr = chunk.choices[0].finish_reason
                if fr:
                    finish_reason = fr

                # Accumulate tool_call fragments
                if delta.tool_calls:
                    is_tool_round = True
                    for tc_delta in delta.tool_calls:
                        idx = tc_delta.index
                        if idx not in tool_calls_buffer:
                            tool_calls_buffer[idx] = {"id": "", "name": "", "arguments": ""}
                        if tc_delta.id:
                            tool_calls_buffer[idx]["id"] = tc_delta.id
                        if tc_delta.function:
                            if tc_delta.function.name:
                                tool_calls_buffer[idx]["name"] += tc_delta.function.name
                            if tc_delta.function.arguments:
                                tool_calls_buffer[idx]["arguments"] += tc_delta.function.arguments

                # Stream text immediately when this is the final text round
                if delta.content and not is_tool_round:
                    content_chunks.append(delta.content)
                    yield {"type": "text", "delta": delta.content}

            if finish_reason == "stop":
                reply_text = "".join(content_chunks)
                yield {"type": "done", "reply_text": reply_text,
                       "actions_taken": actions_taken, "intent_json": intent_json}
                return

            elif finish_reason == "tool_calls":
                # Build sorted tool call list from buffer
                tool_calls_list = [
                    {
                        "id": tool_calls_buffer[i]["id"],
                        "type": "function",
                        "function": {
                            "name": tool_calls_buffer[i]["name"],
                            "arguments": tool_calls_buffer[i]["arguments"],
                        },
                    }
                    for i in sorted(tool_calls_buffer)
                ]
                msg_dict: dict = {
                    "role": "assistant",
                    "content": "".join(content_chunks) or None,
                    "tool_calls": tool_calls_list,
                }
                msgs.append(msg_dict)

                for tc in tool_calls_list:
                    tool_name = tc["function"]["name"]
                    tool_args = json.loads(tc["function"]["arguments"])
                    label = TOOL_LABELS.get(tool_name, f"正在执行 {tool_name}...")
                    yield {"type": "tool_call", "name": tool_name, "label": label}

                    logger.info(f"CA stream tool call [{self.provider}]: {tool_name}")
                    result = await tool_executor.execute(tool_name, tool_args)
                    _args_preview = json.dumps(tool_args, ensure_ascii=False)
                    if len(_args_preview) > 400:
                        _args_preview = _args_preview[:400] + "…"
                    actions_taken.append(f"{tool_name}: {_args_preview}")
                    if intent_json is None:
                        intent_json = {"action": tool_name, "params": tool_args}
                    msgs.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": json.dumps(result, ensure_ascii=False, default=str),
                    })
                # loop continues → next LLM call

            else:
                # finish_reason is None (stream ended without proper signal from some proxies)
                # or an unexpected value like "length" / "content_filter".
                # Log it so we can diagnose, then recover gracefully.
                logger.warning(
                    f"[stream openai] unexpected finish_reason={finish_reason!r} "
                    f"content_chunks={len(content_chunks)} tool_calls_buffer={list(tool_calls_buffer)}"
                )
                if content_chunks:
                    # Stream ended abruptly but we already received text — treat as stop
                    reply_text = "".join(content_chunks)
                    yield {"type": "done", "reply_text": reply_text,
                           "actions_taken": actions_taken, "intent_json": intent_json}
                elif tool_calls_buffer:
                    # Stream ended abruptly mid-tool-call — execute what we have and continue
                    logger.warning("[stream openai] stream ended mid-tool-call, attempting recovery")
                    tool_calls_list = [
                        {
                            "id": tool_calls_buffer[i]["id"],
                            "type": "function",
                            "function": {
                                "name": tool_calls_buffer[i]["name"],
                                "arguments": tool_calls_buffer[i]["arguments"],
                            },
                        }
                        for i in sorted(tool_calls_buffer)
                        if tool_calls_buffer[i]["name"]  # skip incomplete entries
                    ]
                    if tool_calls_list:
                        msg_dict = {
                            "role": "assistant",
                            "content": None,
                            "tool_calls": tool_calls_list,
                        }
                        msgs.append(msg_dict)
                        for tc in tool_calls_list:
                            tool_name = tc["function"]["name"]
                            tool_args = json.loads(tc["function"]["arguments"] or "{}")
                            label = TOOL_LABELS.get(tool_name, f"正在执行 {tool_name}...")
                            yield {"type": "tool_call", "name": tool_name, "label": label}
                            logger.info(f"CA stream tool call (recovery) [{self.provider}]: {tool_name}")
                            result = await tool_executor.execute(tool_name, tool_args)
                            _args_preview = json.dumps(tool_args, ensure_ascii=False)
                    if len(_args_preview) > 400:
                        _args_preview = _args_preview[:400] + "…"
                    actions_taken.append(f"{tool_name}: {_args_preview}")
                            if intent_json is None:
                                intent_json = {"action": tool_name, "params": tool_args}
                            msgs.append({
                                "role": "tool",
                                "tool_call_id": tc["id"],
                                "content": json.dumps(result, ensure_ascii=False, default=str),
                            })
                        # loop continues
                        continue
                    else:
                        yield {"type": "error", "message": f"流异常终止（{finish_reason}），请重试。"}
                        return
                else:
                    yield {"type": "error", "message": f"流异常终止（{finish_reason}），请重试。"}
                    return

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

    async def _agentic_loop_stream_anthropic(
        self, messages: list[dict], tools: list[dict], tool_executor: Any,
    ) -> AsyncGenerator[dict, None]:
        anthropic_tools = _openai_tools_to_anthropic(tools)
        system, msgs = _extract_system(messages)
        actions_taken: list[str] = []
        intent_json: dict | None = None

        while True:
            client = self._get_client()
            content_blocks: dict[int, dict] = {}  # index → accumulated block data
            stop_reason: str | None = None

            # Stream using raw SSE events
            async with client.messages.stream(  # type: ignore[union-attr]
                model=settings.LLM_MODEL,
                max_tokens=4096,
                system=system,
                messages=msgs,
                tools=anthropic_tools,
            ) as stream:
                async for event in stream:
                    if event.type == "content_block_start":
                        idx = event.index
                        block = event.content_block
                        content_blocks[idx] = {
                            "type": block.type,
                            "text": "",
                            "partial_json": "",
                            "id": getattr(block, "id", ""),
                            "name": getattr(block, "name", ""),
                        }

                    elif event.type == "content_block_delta":
                        idx = event.index
                        delta = event.delta
                        if delta.type == "text_delta":
                            content_blocks[idx]["text"] += delta.text
                            yield {"type": "text", "delta": delta.text}
                        elif delta.type == "input_json_delta":
                            content_blocks[idx]["partial_json"] += delta.partial_json

                    elif event.type == "message_delta":
                        stop_reason = event.delta.stop_reason

            if stop_reason == "end_turn":
                reply_text = "".join(
                    b["text"] for b in content_blocks.values() if b["type"] == "text"
                )
                yield {"type": "done", "reply_text": reply_text,
                       "actions_taken": actions_taken, "intent_json": intent_json}
                return

            elif stop_reason == "tool_use":
                # Rebuild assistant content blocks for the next turn
                assistant_content = []
                for idx in sorted(content_blocks):
                    b = content_blocks[idx]
                    if b["type"] == "text":
                        assistant_content.append({"type": "text", "text": b["text"]})
                    elif b["type"] == "tool_use":
                        try:
                            parsed_input = json.loads(b["partial_json"]) if b["partial_json"] else {}
                        except json.JSONDecodeError:
                            parsed_input = {}
                        assistant_content.append({
                            "type": "tool_use",
                            "id": b["id"],
                            "name": b["name"],
                            "input": parsed_input,
                        })
                msgs.append({"role": "assistant", "content": assistant_content})

                tool_results = []
                for block in assistant_content:
                    if block["type"] != "tool_use":
                        continue
                    tool_name = block["name"]
                    tool_args = block["input"]
                    label = TOOL_LABELS.get(tool_name, f"正在执行 {tool_name}...")
                    yield {"type": "tool_call", "name": tool_name, "label": label}

                    logger.info(f"CA stream tool call [{self.provider}]: {tool_name}")
                    result = await tool_executor.execute(tool_name, tool_args)
                    _args_preview = json.dumps(tool_args, ensure_ascii=False)
                    if len(_args_preview) > 400:
                        _args_preview = _args_preview[:400] + "…"
                    actions_taken.append(f"{tool_name}: {_args_preview}")
                    if intent_json is None:
                        intent_json = {"action": tool_name, "params": tool_args}
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block["id"],
                        "content": json.dumps(result, ensure_ascii=False, default=str),
                    })
                msgs.append({"role": "user", "content": tool_results})
                # loop continues → next LLM call

            else:
                # stop_reason is None or unexpected — log and recover
                text_so_far = "".join(
                    b["text"] for b in content_blocks.values() if b["type"] == "text"
                )
                logger.warning(
                    f"[stream anthropic] unexpected stop_reason={stop_reason!r} "
                    f"text_len={len(text_so_far)} blocks={list(content_blocks)}"
                )
                if text_so_far:
                    yield {"type": "done", "reply_text": text_so_far,
                           "actions_taken": actions_taken, "intent_json": intent_json}
                else:
                    yield {"type": "error", "message": f"流异常终止（{stop_reason}），请重试。"}
                return

    async def _agentic_loop_anthropic(
        self, messages: list[dict], tools: list[dict], tool_executor: Any,
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
                        _args_preview = json.dumps(tool_args, ensure_ascii=False)
                    if len(_args_preview) > 400:
                        _args_preview = _args_preview[:400] + "…"
                    actions_taken.append(f"{tool_name}: {_args_preview}")
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
