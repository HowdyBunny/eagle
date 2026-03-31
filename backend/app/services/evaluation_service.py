import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.project_candidate import ProjectCandidate, ProjectCandidateStatus
from app.schemas.evaluation import ProjectCandidateUpdate


async def get_or_create_project_candidate(
    db: AsyncSession, project_id: uuid.UUID, candidate_id: uuid.UUID
) -> ProjectCandidate:
    result = await db.execute(
        select(ProjectCandidate).where(
            ProjectCandidate.project_id == project_id,
            ProjectCandidate.candidate_id == candidate_id,
        )
    )
    pc = result.scalar_one_or_none()
    if not pc:
        pc = ProjectCandidate(project_id=project_id, candidate_id=candidate_id)
        db.add(pc)
        await db.commit()
        await db.refresh(pc)
    return pc


async def save_evaluation(
    db: AsyncSession,
    project_id: uuid.UUID,
    candidate_id: uuid.UUID,
    match_score: float,
    dimension_scores: dict,
    recommendation: str,
    risk_flags: str,
) -> ProjectCandidate:
    pc = await get_or_create_project_candidate(db, project_id, candidate_id)
    pc.match_score = match_score
    pc.dimension_scores = dimension_scores
    pc.recommendation = recommendation
    pc.risk_flags = risk_flags
    pc.status = ProjectCandidateStatus.RECOMMENDED if match_score >= 70 else ProjectCandidateStatus.PENDING
    pc.evaluated_at = datetime.now(tz=timezone.utc)
    await db.commit()
    await db.refresh(pc)
    return pc


async def list_project_candidates(
    db: AsyncSession, project_id: uuid.UUID, sort_by_score: bool = True
) -> list[ProjectCandidate]:
    query = (
        select(ProjectCandidate)
        .where(ProjectCandidate.project_id == project_id)
        .options(selectinload(ProjectCandidate.candidate))
    )
    if sort_by_score:
        query = query.order_by(ProjectCandidate.match_score.desc().nulls_last())
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_project_candidate(
    db: AsyncSession, project_id: uuid.UUID, candidate_id: uuid.UUID
) -> ProjectCandidate | None:
    result = await db.execute(
        select(ProjectCandidate)
        .where(
            ProjectCandidate.project_id == project_id,
            ProjectCandidate.candidate_id == candidate_id,
        )
        .options(selectinload(ProjectCandidate.candidate))
    )
    return result.scalar_one_or_none()


async def update_project_candidate(
    db: AsyncSession,
    project_id: uuid.UUID,
    candidate_id: uuid.UUID,
    data: ProjectCandidateUpdate,
) -> ProjectCandidate | None:
    result = await db.execute(
        select(ProjectCandidate)
        .where(
            ProjectCandidate.project_id == project_id,
            ProjectCandidate.candidate_id == candidate_id,
        )
        .options(selectinload(ProjectCandidate.candidate))
    )
    pc = result.scalar_one_or_none()
    if not pc:
        return None
    if data.status is not None:
        pc.status = data.status
    if data.hunter_feedback is not None:
        pc.hunter_feedback = data.hunter_feedback
    await db.commit()
    await db.refresh(pc)
    return pc
