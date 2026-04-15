from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env search paths. In packaged mode there is no project-local .env,
# so we also look inside EAGLE_BASE_DIR (~/Desktop/Eagle/.env) which the user
# can edit after install. Project-local .env wins during dev.
_USER_ENV = Path("~/Desktop/Eagle/.env").expanduser()
_ENV_FILES = (str(_USER_ENV), ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILES, env_file_encoding="utf-8", extra="ignore")

    # Core LLM — used by CA, RA, EA
    # LLM_PROVIDER: "openai" (default) uses OpenAI SDK; "anthropic" uses Anthropic SDK
    LLM_PROVIDER: str = "openai"
    # Optional at startup so the packaged app can boot without credentials;
    # the frontend prompts the user to fill these in on first run.
    LLM_API_KEY: str | None = None
    LLM_MODEL: str = "gpt-5.2"
    # openai:    LLM_BASE_URL must include /v1  (e.g. https://your-provider.com/v1)
    # anthropic: LLM_BASE_URL must NOT include /v1 (Anthropic SDK appends it automatically)
    LLM_BASE_URL: str | None = None

    # Web search (used by RA when LLM_PROVIDER=openai via responses.create)
    WEB_SEARCH_CONTEXT_SIZE: str = "low"  # "low" | "medium" | "high"

    # Embedding — any OpenAI-compatible embedding endpoint
    EMBEDDING_API_KEY: str | None = None
    EMBEDDING_BASE_URL: str | None = None  # None = OpenAI official; must include /v1 for compatible endpoints
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSIONS: int = 1536

    # App
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: list[str] = ["*"]

    # File storage root — Eagle data lives under this directory on the user's machine
    # Mac/Linux default: ~/Desktop/Eagle   Windows: set EAGLE_BASE_DIR=C:/Users/<you>/Desktop/Eagle
    EAGLE_BASE_DIR: str = "~/Desktop/Eagle"

    # Database — derived from EAGLE_BASE_DIR if not explicitly set
    DATABASE_URL: str = ""

    # LanceDB persist directory — derived from EAGLE_BASE_DIR if not explicitly set
    LANCEDB_PERSIST_DIR: str = ""

    @model_validator(mode="after")
    def _set_derived_paths(self) -> "Settings":
        base = Path(self.EAGLE_BASE_DIR).expanduser()
        if not self.DATABASE_URL:
            db_path = base / "data" / "eagle.db"
            self.DATABASE_URL = f"sqlite+aiosqlite:///{db_path}"
        if not self.LANCEDB_PERSIST_DIR:
            self.LANCEDB_PERSIST_DIR = str(base / "data" / "lancedb")
        return self


settings = Settings()
