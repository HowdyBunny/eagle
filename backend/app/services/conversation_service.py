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
) -> ConversationLog:
    log = ConversationLog(
        project_id=project_id,
        role=role,
        content=content,
        intent_json=intent_json,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


async def list_conversations(
    db: AsyncSession, project_id: uuid.UUID, skip: int = 0, limit: int = 50
) -> list[ConversationLog]:
    result = await db.execute(
        select(ConversationLog)
        .where(ConversationLog.project_id == project_id)
        .order_by(ConversationLog.created_at.asc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_history(db: AsyncSession, project_id: uuid.UUID, limit: int = 50) -> list[ConversationLog]:
    result = await db.execute(
        select(ConversationLog)
        .where(ConversationLog.project_id == project_id)
        .order_by(ConversationLog.created_at.asc())
        .limit(limit)
    )
    return list(result.scalars().all())
