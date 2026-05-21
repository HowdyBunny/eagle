"""
LLM-powered query rewriting for the talent search box.

A recruiter's free-text query often tangles structured constraints (years,
location, exclusions) into a natural-language description. We use a single
small LLM call to extract the structured parts so they become hard SQL
filters, leaving only the semantic remainder for embedding + BM25 retrieval.

LLM calls cost tokens, so we gate them behind a cheap rule check
(`needs_llm_rewrite`) and the user-facing "smart search" toggle on the
frontend. Identifier queries and short names are returned untouched.
"""

from __future__ import annotations

import json
import re
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.services.llm_client import LLMClient
from app.services.query_router import detect_identifier, needs_llm_rewrite
from app.services.school_normalizer import canonicalize_school, is_known_school_slug
from app.utils.logger import logger


_SYSTEM_PROMPT = """你是猎头搜索查询解析器。把用户的自然语言搜索请求拆解为结构化的检索参数。

输出严格的 JSON（不要 markdown 包裹）：
{
  "semantic_query": "保留的语义关键词（用于向量检索 / BM25），剥离了已被结构化的字段",
  "filters": {
    "location": "地点字符串，未提到则 null",
    "min_years_experience": 数字或 null,
    "max_years_experience": 数字或 null,
    "current_company": "公司名或 null",
    "schools": ["学校canonical slug"，未提到则 []]
  },
  "exclusions": {
    "exclude_companies": [],
    "exclude_locations": [],
    "exclude_query": "需要语义排除的描述，未提到则 null"
  }
}

提取规则：
1. 只填用户明确提到的字段，不要推断。其他字段填 null 或空数组。
2. "5 年以上 / ≥5年 / 5+ years" → min_years_experience = 5
3. "10 年以下 / ≤10年" → max_years_experience = 10
4. "在 X / X 地区 / 驻 X" → location
5. "排除 X / 不要 X / 非 X" → exclusions
6. semantic_query 是剥离结构化字段后的核心语义关键词（技能、行业、产品名）。如果剥完什么都不剩，复制原查询。
7. 学校 schools 字段填 canonical slug（清华→"tsinghua"、北大→"peking"、复旦→"fudan"、上海交大→"sjtu"、Stanford→"stanford"、Tsinghua→"tsinghua"），不认识就空数组。"""


_INLINE_JSON_RE = re.compile(r"\{[\s\S]*\}")


class RewriteFilters(BaseModel):
    model_config = ConfigDict(extra="ignore")
    location: str | None = None
    min_years_experience: float | None = None
    max_years_experience: float | None = None
    current_company: str | None = None
    schools: list[str] = Field(default_factory=list)


class RewriteExclusions(BaseModel):
    model_config = ConfigDict(extra="ignore")
    exclude_companies: list[str] = Field(default_factory=list)
    exclude_locations: list[str] = Field(default_factory=list)
    exclude_query: str | None = None


class QueryRewriteRequest(BaseModel):
    query: str


class QueryRewriteResponse(BaseModel):
    raw_query: str
    semantic_query: str
    filters: RewriteFilters
    exclusions: RewriteExclusions
    used_llm: bool                # whether we actually spent an LLM call
    skip_reason: str | None = None  # why we skipped the LLM (identifier / too-short / disabled)


def _empty_response(query: str, skip_reason: str) -> QueryRewriteResponse:
    return QueryRewriteResponse(
        raw_query=query,
        semantic_query=query,
        filters=RewriteFilters(),
        exclusions=RewriteExclusions(),
        used_llm=False,
        skip_reason=skip_reason,
    )


def _extract_json(raw: str) -> dict[str, Any] | None:
    raw = raw.strip()
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    # Strip markdown fence
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    match = _INLINE_JSON_RE.search(raw)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            return None
    return None


def _normalise_schools(parsed_schools: Any, raw_query: str) -> list[str]:
    """
    Trust the LLM only if its output matches our canonical map. If it spits out
    a free-text school we run our own normalizer on the original query as a
    safety net.
    """
    result: list[str] = []
    if isinstance(parsed_schools, list):
        for item in parsed_schools:
            if not isinstance(item, str) or not item.strip():
                continue
            # If the LLM already emitted a known slug, accept it.
            slug = item.strip().lower()
            if is_known_school_slug(slug):
                result.append(slug)
                continue
            # Otherwise try to map whatever it gave back to a slug.
            mapped = canonicalize_school(item)
            if mapped:
                result.append(mapped)
    # Safety net: scan the original query too.
    fallback = canonicalize_school(raw_query)
    if fallback and fallback not in result:
        result.append(fallback)
    return result


async def rewrite_query(query: str, *, force: bool = False) -> QueryRewriteResponse:
    """
    Run the rule gate first; only call the LLM when the query is rich enough
    to deserve one. `force=True` bypasses the gate (useful for testing).
    """
    q = (query or "").strip()
    if not q:
        return _empty_response("", skip_reason="empty")

    if detect_identifier(q):
        return _empty_response(q, skip_reason="identifier")

    if not force and not needs_llm_rewrite(q):
        return _empty_response(q, skip_reason="simple")

    client = LLMClient()
    raw = ""
    try:
        raw = await client.simple_chat(
            [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": q},
            ],
            max_tokens=512,
        )
    except Exception as e:
        logger.warning(f"Query rewrite LLM call failed; falling back to raw query: {e}")
        return _empty_response(q, skip_reason="llm_error")

    parsed = _extract_json(raw)
    if not isinstance(parsed, dict):
        logger.warning(f"Query rewrite returned unparseable JSON: {raw[:200]!r}")
        return _empty_response(q, skip_reason="llm_unparseable")

    filters_raw = parsed.get("filters") if isinstance(parsed.get("filters"), dict) else {}
    exclusions_raw = parsed.get("exclusions") if isinstance(parsed.get("exclusions"), dict) else {}

    filters = RewriteFilters(
        location=filters_raw.get("location"),
        min_years_experience=filters_raw.get("min_years_experience"),
        max_years_experience=filters_raw.get("max_years_experience"),
        current_company=filters_raw.get("current_company"),
        schools=_normalise_schools(filters_raw.get("schools"), q),
    )
    exclusions = RewriteExclusions(
        exclude_companies=[
            s.strip() for s in (exclusions_raw.get("exclude_companies") or []) if isinstance(s, str) and s.strip()
        ],
        exclude_locations=[
            s.strip() for s in (exclusions_raw.get("exclude_locations") or []) if isinstance(s, str) and s.strip()
        ],
        exclude_query=exclusions_raw.get("exclude_query"),
    )
    semantic_query = parsed.get("semantic_query") or q
    if not isinstance(semantic_query, str) or not semantic_query.strip():
        semantic_query = q

    return QueryRewriteResponse(
        raw_query=q,
        semantic_query=semantic_query.strip(),
        filters=filters,
        exclusions=exclusions,
        used_llm=True,
    )
