import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker, get_db
from app.schemas.evaluation import EvaluationStatusResponse, ProjectCandidateResponse, ProjectCandidateUpdate
from app.services import candidate_service, evaluation_service, project_service, talent_list_service
from app.utils.logger import logger

router = APIRouter(prefix="/projects", tags=["evaluations"])


# Strong refs to detached EA tasks so the asyncio loop's weak-ref tracking
# doesn't garbage-collect them mid-flight. Each task removes itself on done.
# (See https://docs.python.org/3/library/asyncio-task.html#asyncio.create_task
# "Important" note about saving a reference.)
_DETACHED_EVAL_TASKS: set[asyncio.Task] = set()


async def _run_evaluation_detached(
    project_id: uuid.UUID,
    candidate_id: uuid.UUID,
    trigger_source: str,
) -> None:
    """
    Run the Evaluator Agent in a fully-detached asyncio task with its own DB
    session.

    Two reasons we use asyncio.create_task rather than FastAPI's BackgroundTasks:

    1. Lifecycle decoupling. BackgroundTasks runs after the response is sent
       but still inside the request's coroutine — the task keeps the request's
       DB session alive until it completes. For a ~25s LLM call that means the
       request session sits open for ~25s, which would (a) keep its connection
       checked out of the pool and (b) interact badly with SQLite locking (the
       request session might still hold a transaction snapshot, blocking other
       writers; this is the bug class fixed by the explicit commit in EA — see
       evaluator.evaluate()).

    2. Own session. async_session_maker() inside this wrapper gives EA a fresh
       session that is independent of the request lifecycle. The request can
       return 202 and release everything immediately; EA runs on its own
       timeline. This is the standard FastAPI pattern for long-running work.
    """
    async with async_session_maker() as db:
        from app.agents.evaluator import EvaluatorAgent
        agent = EvaluatorAgent(db)
        try:
            await agent.evaluate(project_id, candidate_id, trigger_source)
        except Exception as e:
            # The EA already logs + marks the row as failed; this catch keeps
            # the create_task from emitting an "exception was never retrieved"
            # warning into asyncio.
            logger.error(f"Detached EA task failed for {candidate_id} / {project_id}: {e}")


@router.post("/{project_id}/evaluate/{candidate_id}", status_code=status.HTTP_202_ACCEPTED)
async def trigger_evaluation(
    project_id: uuid.UUID,
    candidate_id: uuid.UUID,
    source_list_id: uuid.UUID | None = Query(
        default=None,
        description=(
            "Optional. If the evaluation was triggered from a talent list, "
            "pass the list id so the member's status is updated to "
            "'added_to_project' atomically with the evaluation kickoff."
        ),
    ),
    db: AsyncSession = Depends(get_db),

):
    project = await project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    candidate = await candidate_service.get_candidate(db, candidate_id)
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    # Pre-create the project_candidate row + wipe any prior evaluation output
    # so the row presents a clean "评估中" state to the frontend until EA
    # writes new values. See reset_for_new_evaluation() for the rationale.
    await evaluation_service.get_or_create_project_candidate(db, project_id, candidate_id)
    await evaluation_service.reset_for_new_evaluation(db, project_id, candidate_id)

    # If invoked from a talent list, sync the member's outreach status.
    # 404 on mismatch rather than silently succeeding so the UI doesn't end up
    # with a "promoted" list row pointing at a candidate that isn't in the list.
    if source_list_id is not None:
        updated = await talent_list_service.mark_member_added_to_project(
            db, source_list_id, candidate_id
        )
        if updated is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="source_list_id does not contain this candidate",
            )

    # Fire-and-forget the EA. See _run_evaluation_detached for why we don't
    # use FastAPI's BackgroundTasks for this. Keep a strong ref so the task
    # doesn't get garbage-collected before it completes.
    task = asyncio.create_task(
        _run_evaluation_detached(project_id, candidate_id, "extension")
    )
    _DETACHED_EVAL_TASKS.add(task)
    task.add_done_callback(_DETACHED_EVAL_TASKS.discard)

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

):
    pc = await evaluation_service.update_project_candidate(db, project_id, candidate_id, data)
    if not pc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project candidate not found")
    return pc
