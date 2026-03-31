import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.utils.paths import make_project_dir


async def create_project(db: AsyncSession, data: ProjectCreate) -> Project:
    project_id = uuid.uuid4()
    created_at = datetime.now(timezone.utc)
    project_dir = make_project_dir(data.client_name, created_at, project_id)

    project = Project(
        id=project_id,
        client_name=data.client_name,
        project_name=data.project_name,
        jd_raw=data.jd_raw,
        requirement_profile=data.requirement_profile,
        mode=data.mode,
        folder_path=str(project_dir),
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def get_project(db: AsyncSession, project_id: uuid.UUID) -> Project | None:
    result = await db.execute(select(Project).where(Project.id == project_id))
    return result.scalar_one_or_none()


async def list_projects(db: AsyncSession, skip: int = 0, limit: int = 20) -> list[Project]:
    result = await db.execute(
        select(Project).order_by(Project.created_at.desc()).offset(skip).limit(limit)
    )
    return list(result.scalars().all())


async def update_project(db: AsyncSession, project_id: uuid.UUID, data: ProjectUpdate) -> Project | None:
    project = await get_project(db, project_id)
    if not project:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)
    return project
