import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.utils.logger import logger
from app.utils.paths import make_project_dir, rename_project_dir


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

    # If client_name changes, rename the project folder and update folder_path.
    new_client_name = update_data.get("client_name")
    if new_client_name and new_client_name != project.client_name and project.folder_path:
        old_path = Path(project.folder_path)
        new_path = rename_project_dir(old_path, new_client_name, project.created_at, project.id)
        if new_path:
            update_data["folder_path"] = str(new_path)
            logger.info(f"Renamed project folder: {old_path} → {new_path}")

    for field, value in update_data.items():
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)
    return project


async def delete_project(db: AsyncSession, project_id: uuid.UUID) -> bool:
    """
    Delete a project and all related data (cascade via ORM relationships).
    Moves the project folder to the system trash instead of permanently deleting it.
    Returns True if deleted, False if not found.
    """
    project = await get_project(db, project_id)
    if not project:
        return False

    # Move folder to trash before removing DB record
    if project.folder_path:
        path = Path(project.folder_path)
        if path.exists():
            try:
                import send2trash
                send2trash.send2trash(str(path))
                logger.info(f"Moved project folder to trash: {path}")
            except Exception as e:
                logger.warning(f"Could not move project folder to trash: {e}")

    await db.delete(project)
    await db.commit()
    return True
