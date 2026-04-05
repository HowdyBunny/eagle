from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure data directories exist
    db_path = Path(settings.DATABASE_URL.replace("sqlite+aiosqlite:///", ""))
    db_path.parent.mkdir(parents=True, exist_ok=True)
    Path(settings.CHROMA_PERSIST_DIR).mkdir(parents=True, exist_ok=True)

    # Verify DB connection
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))

    # Warm up ChromaDB (creates collections if they don't exist)
    from app.services.chroma_service import (
        get_candidate_collection,
        get_industry_collection,
        get_requirement_collection,
    )
    get_candidate_collection()
    get_industry_collection()
    get_requirement_collection()

    yield

    # Shutdown: dispose engine
    await engine.dispose()


app = FastAPI(
    title="Eagle API",
    description="Agentic AI platform for headhunters - talent search and evaluation system",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from app.api import register_routers  # noqa: E402

register_routers(app)
