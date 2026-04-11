import asyncio
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import engine


def _resource_path(relative: str) -> Path:
    """Resolve a bundled resource — works in dev and inside a PyInstaller bundle."""
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))
    return base / relative


def _run_alembic_upgrade() -> None:
    """Run `alembic upgrade head` against the current DATABASE_URL. Sync — call via asyncio.to_thread."""
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(_resource_path("alembic.ini")))
    cfg.set_main_option("script_location", str(_resource_path("alembic")))
    command.upgrade(cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure data directories exist
    db_path = Path(settings.DATABASE_URL.replace("sqlite+aiosqlite:///", ""))
    db_path.parent.mkdir(parents=True, exist_ok=True)
    Path(settings.CHROMA_PERSIST_DIR).mkdir(parents=True, exist_ok=True)

    # Run pending Alembic migrations. Offloaded to a worker thread because
    # env.py uses asyncio.run() which cannot run inside the active loop.
    await asyncio.to_thread(_run_alembic_upgrade)

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
