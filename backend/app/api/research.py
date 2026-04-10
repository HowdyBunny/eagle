import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.research import ResearchTriggerRequest, ResearchResponse
from app.services import project_service, research_service

router = APIRouter(prefix="/projects", tags=["research"])


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

    from app.agents.research import ResearchAgent
    agent = ResearchAgent(db)
    background_tasks.add_task(agent.research, project_id, request.topic, request.additional_context)

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
