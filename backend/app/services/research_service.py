import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.project_research import ProjectResearch, ResearchTaskStatus


async def create_research_task(
    db: AsyncSession, project_id: uuid.UUID, topic: str
) -> ProjectResearch:
    """Create a RUNNING task record before RA starts. Returns the task so caller can pass its id."""
    research = ProjectResearch(
        project_id=project_id,
        topic=topic,
        status=ResearchTaskStatus.RUNNING,
    )
    db.add(research)
    await db.commit()
    await db.refresh(research)
    return research


async def complete_research_task(
    db: AsyncSession,
    task_id: uuid.UUID,
    ontology_id: uuid.UUID,
    report_file_path: str | None,
) -> ProjectResearch:
    research = await db.get(ProjectResearch, task_id)
    research.status = ResearchTaskStatus.COMPLETED
    research.ontology_id = ontology_id
    research.report_file_path = report_file_path
    research.finished_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(research)
    return research


async def fail_research_task(
    db: AsyncSession, task_id: uuid.UUID, error_message: str
) -> ProjectResearch:
    research = await db.get(ProjectResearch, task_id)
    research.status = ResearchTaskStatus.FAILED
    research.error_message = error_message
    research.finished_at = datetime.now(timezone.utc)
    await db.commit()
    return research


async def list_research(db: AsyncSession, project_id: uuid.UUID) -> list[ProjectResearch]:
    result = await db.execute(
        select(ProjectResearch)
        .where(ProjectResearch.project_id == project_id)
        .options(selectinload(ProjectResearch.ontology))
        .order_by(ProjectResearch.created_at.desc())
    )
    return list(result.scalars().all())
