import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation_log import ConversationLog, ConversationRole


async def save_message(
    db: AsyncSession,
    project_id: uuid.UUID,
    role: ConversationRole,
    content: str,
    intent_json: dict | None = None,
    thread_id: uuid.UUID | None = None,
) -> ConversationLog:
    log = ConversationLog(
        project_id=project_id,
        thread_id=thread_id,
        role=role,
        content=content,
        intent_json=intent_json,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


async def list_conversations(
    db: AsyncSession,
    project_id: uuid.UUID,
    thread_id: uuid.UUID | None = None,
    skip: int = 0,
    limit: int = 50,
) -> list[ConversationLog]:
    q = select(ConversationLog).where(ConversationLog.project_id == project_id)
    if thread_id is not None:
        q = q.where(ConversationLog.thread_id == thread_id)
    else:
        q = q.where(ConversationLog.thread_id.is_(None))
    q = q.order_by(ConversationLog.created_at.asc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_history(
    db: AsyncSession,
    project_id: uuid.UUID,
    thread_id: uuid.UUID | None = None,
    limit: int = 50,
) -> list[ConversationLog]:
    q = select(ConversationLog).where(ConversationLog.project_id == project_id)
    if thread_id is not None:
        q = q.where(ConversationLog.thread_id == thread_id)
    else:
        q = q.where(ConversationLog.thread_id.is_(None))
    q = q.order_by(ConversationLog.created_at.asc()).limit(limit)
    result = await db.execute(q)
    return list(result.scalars().all())
