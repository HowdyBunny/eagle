import uuid

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation_log import ConversationLog
from app.models.conversation_thread import ConversationThread


async def create_thread(db: AsyncSession, project_id: uuid.UUID, name: str = "新对话") -> ConversationThread:
    thread = ConversationThread(project_id=project_id, name=name)
    db.add(thread)
    await db.commit()
    await db.refresh(thread)
    return thread


async def get_thread(db: AsyncSession, thread_id: uuid.UUID) -> ConversationThread | None:
    result = await db.execute(select(ConversationThread).where(ConversationThread.id == thread_id))
    return result.scalar_one_or_none()


async def list_threads(db: AsyncSession, project_id: uuid.UUID) -> list[ConversationThread]:
    result = await db.execute(
        select(ConversationThread)
        .where(ConversationThread.project_id == project_id)
        .order_by(ConversationThread.created_at.desc())
    )
    return list(result.scalars().all())


async def has_legacy_messages(db: AsyncSession, project_id: uuid.UUID) -> bool:
    result = await db.scalar(
        select(exists().where(
            ConversationLog.project_id == project_id,
            ConversationLog.thread_id.is_(None),
        ))
    )
    return bool(result)


async def rename_thread(db: AsyncSession, thread_id: uuid.UUID, name: str) -> ConversationThread | None:
    thread = await get_thread(db, thread_id)
    if not thread:
        return None
    thread.name = name
    await db.commit()
    await db.refresh(thread)
    return thread


async def delete_thread(db: AsyncSession, thread_id: uuid.UUID) -> bool:
    thread = await get_thread(db, thread_id)
    if not thread:
        return False
    await db.delete(thread)
    await db.commit()
    return True
