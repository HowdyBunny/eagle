"""
Tavily search service — used by the Research Agent for live web search.

The RA plans search queries with the LLM, then fans out to Tavily in parallel
here. `auto_parameters=True` lets Tavily pick search_depth / topic / max_results
per query (better than asking the LLM to pick — it has no Tavily-side priors).

Fresh client per call so hot-updated TAVILY_API_KEY takes effect.
"""

from __future__ import annotations

import asyncio

from tavily import AsyncTavilyClient

from app.config import settings
from app.utils.logger import logger


class TavilyNotConfiguredError(RuntimeError):
    """Raised when TAVILY_API_KEY is missing."""


def _get_client() -> AsyncTavilyClient:
    if not settings.TAVILY_API_KEY:
        raise TavilyNotConfiguredError(
            "TAVILY_API_KEY is not set. Configure it in the Settings page."
        )
    return AsyncTavilyClient(api_key=settings.TAVILY_API_KEY)


async def search(query: str) -> dict:
    """Single Tavily search with auto_parameters enabled."""
    client = _get_client()
    return await client.search(query=query, auto_parameters=True)


async def search_many(queries: list[str]) -> list[dict]:
    """
    Run multiple queries in parallel. Failures on individual queries are
    logged and replaced with an empty result so one bad query does not
    sink the whole research.
    """
    if not queries:
        return []
    client = _get_client()

    async def _one(q: str) -> dict:
        try:
            return await client.search(query=q, auto_parameters=True)
        except Exception as exc:
            logger.warning(f"Tavily search failed for query={q!r}: {exc}")
            return {"query": q, "results": [], "error": str(exc)}

    return await asyncio.gather(*(_one(q) for q in queries))


def format_results_for_llm(responses: list[dict], per_result_chars: int = 800) -> str:
    """
    Render Tavily responses as a compact markdown blob to inject into the
    Synthesize prompt. Truncates each result body to bound the token cost.
    """
    blocks: list[str] = []
    for resp in responses:
        q = resp.get("query") or "(unknown query)"
        answer = resp.get("answer")
        results = resp.get("results") or []
        lines = [f"### 搜索查询：{q}"]
        if answer:
            lines.append(f"**Tavily 摘要**：{answer}")
        for r in results:
            title = r.get("title") or "(no title)"
            url = r.get("url") or ""
            content = (r.get("content") or "").strip()
            if len(content) > per_result_chars:
                content = content[:per_result_chars] + "…"
            lines.append(f"- [{title}]({url})\n  {content}")
        if not results and not answer:
            lines.append("_（无结果）_")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)
