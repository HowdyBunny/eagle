"""
Runtime settings hot-update endpoint.

Allows the frontend Settings UI to push LLM / Embedding configuration changes
to the running backend without a restart. Changes take effect on the next
agent call because LLMClient and EmbeddingService read from the singleton
`settings` object at call time.
"""

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings

router = APIRouter(tags=["settings"])


class RuntimeSettingsUpdate(BaseModel):
    llm_provider: str | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None
    llm_base_url: str | None = None
    web_search_context_size: str | None = None
    embedding_api_key: str | None = None
    embedding_model: str | None = None
    embedding_base_url: str | None = None
    embedding_dimensions: int | None = None


class RuntimeSettingsResponse(BaseModel):
    llm_provider: str
    llm_model: str
    llm_base_url: str | None
    web_search_context_size: str
    embedding_model: str
    embedding_base_url: str | None
    embedding_dimensions: int


@router.put("/settings")
async def update_runtime_settings(
    data: RuntimeSettingsUpdate,
):
    """Hot-update LLM and Embedding config at runtime. No restart needed."""
    if data.llm_provider is not None:
        settings.LLM_PROVIDER = data.llm_provider
    if data.llm_api_key is not None:
        settings.LLM_API_KEY = data.llm_api_key
    if data.llm_model is not None:
        settings.LLM_MODEL = data.llm_model
    if data.llm_base_url is not None:
        settings.LLM_BASE_URL = data.llm_base_url or None
    if data.web_search_context_size is not None:
        settings.WEB_SEARCH_CONTEXT_SIZE = data.web_search_context_size
    if data.embedding_api_key is not None:
        settings.EMBEDDING_API_KEY = data.embedding_api_key
    if data.embedding_model is not None:
        settings.EMBEDDING_MODEL = data.embedding_model
    if data.embedding_base_url is not None:
        settings.EMBEDDING_BASE_URL = data.embedding_base_url or None
    if data.embedding_dimensions is not None:
        settings.EMBEDDING_DIMENSIONS = data.embedding_dimensions
    return {"status": "updated"}


@router.get("/settings", response_model=RuntimeSettingsResponse)
async def get_runtime_settings():
    """Return current runtime settings (secrets are excluded)."""
    return RuntimeSettingsResponse(
        llm_provider=settings.LLM_PROVIDER,
        llm_model=settings.LLM_MODEL,
        llm_base_url=settings.LLM_BASE_URL,
        web_search_context_size=settings.WEB_SEARCH_CONTEXT_SIZE,
        embedding_model=settings.EMBEDDING_MODEL,
        embedding_base_url=settings.EMBEDDING_BASE_URL,
        embedding_dimensions=settings.EMBEDDING_DIMENSIONS,
    )
