import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker, get_db
from app.schemas.research import ResearchTriggerRequest, ResearchResponse
from app.services import project_service, research_service
from app.utils.logger import logger
from app.utils.paths import eagle_dir

router = APIRouter(prefix="/projects", tags=["research"])


async def _run_research_in_background(
    project_id: uuid.UUID,
    topic: str,
    additional_context: str | None,
) -> None:
    """
    Background task wrapper that opens a fresh DB session.

    The request-scoped session from Depends(get_db) is closed as soon as the
    202 response is sent, so we must NOT reuse it here.
    """
    async with async_session_maker() as db:
        from app.agents.research import ResearchAgent
        agent = ResearchAgent(db)
        try:
            await agent.research(project_id, topic, additional_context)
        except Exception:
            logger.exception(
                f"Background research task failed for project {project_id}, topic='{topic}'"
            )


@router.post("/{project_id}/research", status_code=status.HTTP_202_ACCEPTED)
async def trigger_research(
    project_id: uuid.UUID,
    request: ResearchTriggerRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    project = await project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    background_tasks.add_task(
        _run_research_in_background,
        project_id,
        request.topic,
        request.additional_context,
    )

    return {"message": "Research triggered", "project_id": str(project_id), "topic": request.topic}


@router.get("/{project_id}/research", response_model=list[ResearchResponse])
async def list_research(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),

):
    project = await project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return await research_service.list_research(db, project_id)


@router.get("/{project_id}/research/{research_id}/report")
async def get_research_report(
    project_id: uuid.UUID,
    research_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Return the markdown body of the report file stored at report_file_path."""
    project = await project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    records = await research_service.list_research(db, project_id)
    record = next((r for r in records if r.id == research_id), None)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Research not found")
    if not record.report_file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No report file recorded")

    # Defense in depth: only allow reading files under the project or Eagle
    # reports directory. Prevents accidental path traversal if report_file_path
    # were ever poisoned by a future bug.
    report_path = Path(record.report_file_path).resolve()
    allowed_roots = [eagle_dir().resolve()]
    if project.folder_path:
        allowed_roots.append(Path(project.folder_path).resolve())
    if not any(str(report_path).startswith(str(root)) for root in allowed_roots):
        logger.warning(f"Refusing to read report outside allowed roots: {report_path}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Path not allowed")

    if not report_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report file missing on disk")

    content = report_path.read_text(encoding="utf-8")
    return {"content": content, "path": str(report_path)}
