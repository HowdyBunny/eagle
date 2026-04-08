import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import verify_api_key
from app.database import get_db
from app.schemas.evaluation import EvaluationStatusResponse, ProjectCandidateResponse, ProjectCandidateUpdate
from app.services import candidate_service, evaluation_service, project_service

router = APIRouter(prefix="/projects", tags=["evaluations"])


@router.post("/{project_id}/evaluate/{candidate_id}", status_code=status.HTTP_202_ACCEPTED)
async def trigger_evaluation(
    project_id: uuid.UUID,
    candidate_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_api_key),
):
    project = await project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    candidate = await candidate_service.get_candidate(db, candidate_id)
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    # Pre-create the project_candidate record with status=pending so polling can start immediately
    await evaluation_service.get_or_create_project_candidate(db, project_id, candidate_id)

    from app.agents.evaluator import EvaluatorAgent
    agent = EvaluatorAgent(db)
    background_tasks.add_task(agent.evaluate, project_id, candidate_id)

    return {
        "message": "Evaluation triggered",
        "project_id": str(project_id),
        "candidate_id": str(candidate_id),
        "status_url": f"/api/projects/{project_id}/candidates/{candidate_id}/status",
        "poll_interval_seconds": 5,
    }


@router.get("/{project_id}/candidates/{candidate_id}/status", response_model=EvaluationStatusResponse)
async def get_evaluation_status(
    project_id: uuid.UUID,
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_api_key),
):
    """
    Poll this endpoint every 5s after triggering an evaluation.
    Returns is_complete=true once the Evaluator Agent has finished.
    """
    pc = await evaluation_service.get_project_candidate(db, project_id, candidate_id)
    if not pc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No evaluation found for this project/candidate pair. Trigger one first.",
        )
    from app.models.project_candidate import ProjectCandidateStatus
    is_failed = pc.status == ProjectCandidateStatus.FAILED
    return EvaluationStatusResponse(
        project_id=project_id,
        candidate_id=candidate_id,
        is_complete=pc.evaluated_at is not None or is_failed,
        status=pc.status,
        match_score=pc.match_score,
        evaluated_at=pc.evaluated_at,
        poll_interval_seconds=5,
        error_message="评估任务失败，请重试" if is_failed else None,
    )


@router.get("/{project_id}/candidates", response_model=list[ProjectCandidateResponse])
async def list_project_candidates(
    project_id: uuid.UUID,
    sort_by_score: bool = True,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_api_key),
):
    project = await project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return await evaluation_service.list_project_candidates(db, project_id, sort_by_score=sort_by_score)


@router.post("/{project_id}/candidates/{candidate_id}/link", status_code=status.HTTP_201_CREATED)
async def link_candidate_to_project(
    project_id: uuid.UUID,
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_api_key),
):
    """Link a candidate to a project without triggering evaluation."""
    project = await project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    candidate = await candidate_service.get_candidate(db, candidate_id)
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    pc = await evaluation_service.get_or_create_project_candidate(db, project_id, candidate_id)
    return {
        "project_id": str(project_id),
        "candidate_id": str(candidate_id),
        "status": pc.status.value if hasattr(pc.status, 'value') else str(pc.status),
        "message": "Candidate linked to project",
    }


@router.patch("/{project_id}/candidates/{candidate_id}", response_model=ProjectCandidateResponse)
async def update_project_candidate(
    project_id: uuid.UUID,
    candidate_id: uuid.UUID,
    data: ProjectCandidateUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_api_key),
):
    pc = await evaluation_service.update_project_candidate(db, project_id, candidate_id, data)
    if not pc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project candidate not found")
    return pc
