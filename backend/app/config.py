from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Core LLM — used by CA, RA, EA
    # LLM_PROVIDER: "openai" (default) uses OpenAI SDK; "anthropic" uses Anthropic SDK
    LLM_PROVIDER: str = "openai"
    LLM_API_KEY: str
    LLM_MODEL: str = "gpt-4o"
    # openai:    LLM_BASE_URL must include /v1  (e.g. https://your-provider.com/v1)
    # anthropic: LLM_BASE_URL must NOT include /v1 (Anthropic SDK appends it automatically)
    LLM_BASE_URL: str | None = None

    # Web search (used by RA when LLM_PROVIDER=openai via responses.create)
    WEB_SEARCH_CONTEXT_SIZE: str = "low"  # "low" | "medium" | "high"

    # Embedding — any OpenAI-compatible embedding endpoint
    EMBEDDING_API_KEY: str
    EMBEDDING_BASE_URL: str | None = None  # None = OpenAI official; must include /v1 for compatible endpoints
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSIONS: int = 1536

    # Langfuse observability — optional (leave blank to disable)
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_HOST: str = ""  # e.g. https://cloud.langfuse.com or your self-hosted URL

    # Auth
    API_KEY: str  # X-API-Key header value for authenticating requests

    # App
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: list[str] = ["*"]

    # File storage root — Eagle data lives under this directory on the user's machine
    # Mac/Linux default: ~/Desktop/Eagle   Windows: set EAGLE_BASE_DIR=C:/Users/<you>/Desktop/Eagle
    EAGLE_BASE_DIR: str = "~/Desktop/Eagle"

    # Database — derived from EAGLE_BASE_DIR if not explicitly set
    DATABASE_URL: str = ""

    # ChromaDB persist directory — derived from EAGLE_BASE_DIR if not explicitly set
    CHROMA_PERSIST_DIR: str = ""

    @model_validator(mode="after")
    def _set_derived_paths(self) -> "Settings":
        base = Path(self.EAGLE_BASE_DIR).expanduser()
        if not self.DATABASE_URL:
            db_path = base / "data" / "eagle.db"
            self.DATABASE_URL = f"sqlite+aiosqlite:///{db_path}"
        if not self.CHROMA_PERSIST_DIR:
            self.CHROMA_PERSIST_DIR = str(base / "data" / "chroma")
        return self


settings = Settings()
