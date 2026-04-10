import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.candidate import CandidateCreate, CandidateUpdate, CandidateResponse, CandidateSearchRequest, CandidateSearchResult
from app.schemas.evaluation import CandidateEvaluationResponse
from app.services import candidate_service, evaluation_service
from app.services.search_service import SearchService

router = APIRouter(prefix="/candidates", tags=["candidates"])


@router.post("", response_model=CandidateResponse, status_code=status.HTTP_201_CREATED)
async def create_candidate(
    data: CandidateCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),

):
    candidate = await candidate_service.create_candidate(db, data)
    # Embed experience_summary in background
    if candidate.experience_summary:
        from app.services.embedding_service import EmbeddingService
        svc = EmbeddingService()
        background_tasks.add_task(svc.embed_candidate, candidate.id, candidate.experience_summary)
    return candidate


@router.get("", response_model=list[CandidateResponse])
async def list_candidates(
    location: str | None = None,
    min_years: float | None = None,
    max_years: float | None = None,
    company: str | None = None,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),

):
    return await candidate_service.list_candidates(
        db,
        location=location,
        min_years_experience=min_years,
        max_years_experience=max_years,
        current_company=company,
        skip=skip,
        limit=limit,
    )


@router.get("/{candidate_id}", response_model=CandidateResponse)
async def get_candidate(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),

):
    candidate = await candidate_service.get_candidate(db, candidate_id)
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    return candidate


@router.patch("/{candidate_id}", response_model=CandidateResponse)
async def update_candidate(
    candidate_id: uuid.UUID,
    data: CandidateUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),

):
    candidate = await candidate_service.update_candidate(db, candidate_id, data)
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    # Re-embed if experience_summary was patched
    if "experience_summary" in data.model_fields_set and candidate.experience_summary:
        from app.services.embedding_service import EmbeddingService
        svc = EmbeddingService()
        background_tasks.add_task(svc.embed_candidate, candidate.id, candidate.experience_summary)
    return candidate


@router.delete("/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_candidate(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),

):
    deleted = await candidate_service.delete_candidate(db, candidate_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")


@router.get("/{candidate_id}/evaluations", response_model=list[CandidateEvaluationResponse])
async def list_candidate_evaluations(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),

):
    candidate = await candidate_service.get_candidate(db, candidate_id)
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    pcs = await evaluation_service.list_candidate_evaluations(db, candidate_id)
    return [
        CandidateEvaluationResponse(
            id=pc.id,
            project_id=pc.project_id,
            project_name=pc.project.project_name,
            client_name=pc.project.client_name,
            match_score=pc.match_score,
            recommendation=pc.recommendation,
            risk_flags=pc.risk_flags,
            trigger_source=pc.trigger_source,
            status=pc.status,
            evaluated_at=pc.evaluated_at,
        )
        for pc in pcs
    ]


@router.post("/search", response_model=list[CandidateSearchResult])
async def search_candidates(
    request: CandidateSearchRequest,
    db: AsyncSession = Depends(get_db),

):
    svc = SearchService()
    return await svc.hybrid_search(db, request)
