"""
Runtime settings hot-update endpoint.

Allows the frontend Settings UI to push LLM / Embedding configuration changes
to the running backend without a restart. Changes take effect on the next
agent call because LLMClient and EmbeddingService read from the singleton
`settings` object at call time.

Updates are also persisted to the user .env file (`_USER_ENV` in
app/config.py) so they survive process restarts.
"""

import re
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import _USER_ENV, settings

router = APIRouter(tags=["settings"])


class RuntimeSettingsUpdate(BaseModel):
    llm_provider: str | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None
    llm_base_url: str | None = None
    web_search_strategy: str | None = None
    web_search_extra_body: str | None = None
    web_search_context_size: str | None = None
    embedding_api_key: str | None = None
    embedding_model: str | None = None
    embedding_base_url: str | None = None
    embedding_dimensions: int | None = None


class RuntimeSettingsResponse(BaseModel):
    llm_provider: str
    llm_model: str
    llm_base_url: str | None
    web_search_strategy: str
    web_search_extra_body: str | None
    web_search_context_size: str
    embedding_model: str
    embedding_base_url: str | None
    embedding_dimensions: int


# Map PUT field name → .env variable name. Order preserved for stable file writes.
_ENV_KEY_MAP: tuple[tuple[str, str], ...] = (
    ("llm_provider", "LLM_PROVIDER"),
    ("llm_api_key", "LLM_API_KEY"),
    ("llm_model", "LLM_MODEL"),
    ("llm_base_url", "LLM_BASE_URL"),
    ("web_search_strategy", "WEB_SEARCH_STRATEGY"),
    ("web_search_extra_body", "WEB_SEARCH_EXTRA_BODY"),
    ("web_search_context_size", "WEB_SEARCH_CONTEXT_SIZE"),
    ("embedding_api_key", "EMBEDDING_API_KEY"),
    ("embedding_model", "EMBEDDING_MODEL"),
    ("embedding_base_url", "EMBEDDING_BASE_URL"),
    ("embedding_dimensions", "EMBEDDING_DIMENSIONS"),
)


def _env_escape(value: str) -> str:
    """Quote the value if it contains whitespace or shell-ish characters."""
    if value == "" or any(c in value for c in ' \t"\'\\#$`'):
        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
        return f'"{escaped}"'
    return value


def _persist_to_env(updates: dict[str, str]) -> None:
    """Merge `updates` into the user .env file, preserving other lines/order."""
    path: Path = _USER_ENV
    path.parent.mkdir(parents=True, exist_ok=True)

    lines: list[str] = []
    if path.exists():
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except Exception:
            lines = []

    key_pattern = re.compile(r"^\s*([A-Z_][A-Z0-9_]*)\s*=")
    index: dict[str, int] = {}
    for i, line in enumerate(lines):
        m = key_pattern.match(line)
        if m:
            index[m.group(1)] = i

    for key, value in updates.items():
        new_line = f"{key}={_env_escape(value)}"
        if key in index:
            lines[index[key]] = new_line
        else:
            lines.append(new_line)
            index[key] = len(lines) - 1

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


@router.put("/settings")
async def update_runtime_settings(
    data: RuntimeSettingsUpdate,
):
    """Hot-update LLM and Embedding config at runtime. Persisted to the user .env."""
    payload = data.model_dump(exclude_unset=True)

    # Apply to the in-memory settings singleton so the next agent call sees them.
    if "llm_provider" in payload:
        settings.LLM_PROVIDER = payload["llm_provider"]
    if "llm_api_key" in payload:
        settings.LLM_API_KEY = payload["llm_api_key"]
    if "llm_model" in payload:
        settings.LLM_MODEL = payload["llm_model"]
    if "llm_base_url" in payload:
        settings.LLM_BASE_URL = payload["llm_base_url"] or None
    if "web_search_strategy" in payload:
        settings.WEB_SEARCH_STRATEGY = payload["web_search_strategy"]
    if "web_search_extra_body" in payload:
        settings.WEB_SEARCH_EXTRA_BODY = payload["web_search_extra_body"] or None
    if "web_search_context_size" in payload:
        settings.WEB_SEARCH_CONTEXT_SIZE = payload["web_search_context_size"]
    if "embedding_api_key" in payload:
        settings.EMBEDDING_API_KEY = payload["embedding_api_key"]
    if "embedding_model" in payload:
        settings.EMBEDDING_MODEL = payload["embedding_model"]
    if "embedding_base_url" in payload:
        settings.EMBEDDING_BASE_URL = payload["embedding_base_url"] or None
    if "embedding_dimensions" in payload:
        settings.EMBEDDING_DIMENSIONS = payload["embedding_dimensions"]

    # Persist to the user .env so the next restart still has these values.
    env_updates: dict[str, str] = {}
    for field, env_key in _ENV_KEY_MAP:
        if field not in payload:
            continue
        value = payload[field]
        env_updates[env_key] = "" if value is None else str(value)

    if env_updates:
        try:
            _persist_to_env(env_updates)
        except Exception as exc:
            return {"status": "updated", "persisted": False, "error": str(exc)}

    return {"status": "updated", "persisted": True}


@router.get("/settings", response_model=RuntimeSettingsResponse)
async def get_runtime_settings():
    """Return current runtime settings (secrets are excluded)."""
    return RuntimeSettingsResponse(
        llm_provider=settings.LLM_PROVIDER,
        llm_model=settings.LLM_MODEL,
        llm_base_url=settings.LLM_BASE_URL,
        web_search_strategy=settings.WEB_SEARCH_STRATEGY,
        web_search_extra_body=settings.WEB_SEARCH_EXTRA_BODY,
        web_search_context_size=settings.WEB_SEARCH_CONTEXT_SIZE,
        embedding_model=settings.EMBEDDING_MODEL,
        embedding_base_url=settings.EMBEDDING_BASE_URL,
        embedding_dimensions=settings.EMBEDDING_DIMENSIONS,
    )
