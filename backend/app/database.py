import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import event
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.types import String, TypeDecorator

from app.config import settings


class UUIDString(TypeDecorator):
    """Store UUID as String(36) in SQLite; present as uuid.UUID in Python."""

    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Any) -> str | None:
        if value is not None:
            return str(value)
        return value

    def process_result_value(self, value: Any, dialect: Any) -> uuid.UUID | None:
        if value is not None:
            return uuid.UUID(value)
        return value


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_pragmas(dbapi_connection: Connection, connection_record: Any) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


@event.listens_for(Base, "before_update", propagate=True)
def _set_updated_at(mapper: Any, connection: Any, target: Any) -> None:
    if hasattr(target, "updated_at"):
        target.updated_at = datetime.now(timezone.utc)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session
