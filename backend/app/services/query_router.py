"""
Query-type detection for talent search.

Rule-based classifier that decides which retrieval path a free-text query
should take BEFORE we spend money on an embedding or LLM call.

Three kinds of queries we recognise without an LLM:
  - identifier (phone / email / LinkedIn URL)  → exact SQL lookup
  - short-name (Chinese name, ≤4 chars, no spaces, no domain words)
                                                → name-prefix lookup
  - free-text (everything else)                 → hybrid retrieval
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Identifier:
    kind: str  # "phone" | "email" | "linkedin_url" | "liepin_url"
    value: str  # normalized value used for exact match


_EMAIL_RE = re.compile(r"^[\w.+-]+@[\w-]+\.[\w.-]+$")
_LINKEDIN_RE = re.compile(r"linkedin\.com/in/[\w-]+", re.IGNORECASE)
_LIEPIN_RE = re.compile(r"liepin\.com/", re.IGNORECASE)


def detect_identifier(query: str) -> Identifier | None:
    """Return an Identifier when the query looks like an exact lookup key."""
    q = (query or "").strip()
    if not q:
        return None

    if _EMAIL_RE.match(q):
        return Identifier("email", q)

    if _LINKEDIN_RE.search(q):
        return Identifier("linkedin_url", q)
    if _LIEPIN_RE.search(q):
        return Identifier("liepin_url", q)

    # Phone heuristic: keep only digits, must be 7-15 long, and the raw query
    # must not contain alphabetic noise (otherwise "5 years SAP" matches).
    digits = re.sub(r"[\s\-+()]", "", q)
    if digits.isdigit() and 7 <= len(digits) <= 15 and not re.search(r"[A-Za-z一-鿿]", q):
        return Identifier("phone", digits)

    return None


_SHORT_NAME_RE = re.compile(r"^[一-鿿]{2,4}$")


def looks_like_short_name(query: str) -> bool:
    """2-4 pure Chinese characters with no other content."""
    return bool(_SHORT_NAME_RE.match((query or "").strip()))


# Hints that the query is structurally rich enough to justify an LLM rewrite.
_STRUCTURAL_HINTS = (
    "年以上", "年以下", "≥", ">=", "以上", "以下", "之上", "之下",
    "排除", "不要", "非", "除了",
    "区域", "在 ", "在", "驻", "落地",
)


def needs_llm_rewrite(query: str) -> bool:
    """
    Decide if a query is complex enough to deserve an LLM rewrite pass.

    LLM rewrites are not free, so we only spend the call when the query likely
    contains structured constraints (years / locations / exclusions) tangled
    with free-text intent. Short and identifier queries always skip the LLM.
    """
    q = (query or "").strip()
    if not q:
        return False
    if detect_identifier(q):
        return False
    if looks_like_short_name(q):
        return False
    if len(q) < 8:
        return False
    if any(hint in q for hint in _STRUCTURAL_HINTS):
        return True
    # Long natural-language queries are likely worth rewriting too.
    return len(q) >= 20
