from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://eagle:eagle@localhost:5432/eagle"

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

    # Auth
    API_KEY: str  # X-API-Key header value for authenticating requests

    # App
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: list[str] = ["*"]

    # File storage root — Eagle data lives under this directory on the user's machine
    # Mac/Linux default: ~/Desktop/Eagle   Windows: set EAGLE_BASE_DIR=C:/Users/<you>/Desktop/Eagle
    EAGLE_BASE_DIR: str = "~/Desktop/Eagle"


settings = Settings()
