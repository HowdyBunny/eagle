import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.preference_log import PreferenceLog
from app.schemas.preference import PreferenceCreate


async def create_preference(
    db: AsyncSession, project_id: uuid.UUID, data: PreferenceCreate
) -> PreferenceLog:
    log = PreferenceLog(
        project_id=project_id,
        candidate_id=data.candidate_id,
        feedback_type=data.feedback_type,
        hunter_comment=data.hunter_comment,
        weight_adjustment=data.weight_adjustment,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


async def list_preferences(db: AsyncSession, project_id: uuid.UUID) -> list[PreferenceLog]:
    result = await db.execute(
        select(PreferenceLog)
        .where(PreferenceLog.project_id == project_id)
        .order_by(PreferenceLog.created_at.asc())
    )
    return list(result.scalars().all())


async def get_weight_context(db: AsyncSession, project_id: uuid.UUID) -> dict:
    """Aggregate all weight adjustments for a project into a merged dict for EA."""
    logs = await list_preferences(db, project_id)
    merged: dict = {}
    for log in logs:
        if log.weight_adjustment:
            for dimension, delta in log.weight_adjustment.items():
                merged[dimension] = merged.get(dimension, 0) + delta
    return merged
