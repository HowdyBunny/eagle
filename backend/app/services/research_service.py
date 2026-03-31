import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.project_research import ProjectResearch


async def create_research(
    db: AsyncSession, project_id: uuid.UUID, ontology_id: uuid.UUID, report_file_path: str | None = None
) -> ProjectResearch:
    research = ProjectResearch(
        project_id=project_id,
        ontology_id=ontology_id,
        report_file_path=report_file_path,
    )
    db.add(research)
    await db.commit()
    await db.refresh(research)
    return research


async def list_research(db: AsyncSession, project_id: uuid.UUID) -> list[ProjectResearch]:
    result = await db.execute(
        select(ProjectResearch)
        .where(ProjectResearch.project_id == project_id)
        .options(selectinload(ProjectResearch.ontology))
        .order_by(ProjectResearch.created_at.desc())
    )
    return list(result.scalars().all())
