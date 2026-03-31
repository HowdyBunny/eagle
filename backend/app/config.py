from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://eagle:eagle@localhost:5432/eagle"

    # Anthropic (LLM for all Agents)
    ANTHROPIC_API_KEY: str
    ANTHROPIC_BASE_URL: str | None = None  # Override for compatible APIs (e.g. local proxy, third-party)
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"

    # OpenAI (Embedding only)
    OPENAI_API_KEY: str
    OPENAI_BASE_URL: str | None = None  # Override for compatible APIs (e.g. Azure, local proxy)
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
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
