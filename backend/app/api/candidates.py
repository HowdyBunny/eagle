import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import verify_api_key
from app.database import get_db
from app.schemas.candidate import CandidateCreate, CandidateResponse, CandidateSearchRequest, CandidateSearchResult
from app.services import candidate_service
from app.services.search_service import SearchService

router = APIRouter(prefix="/candidates", tags=["candidates"])


@router.post("", response_model=CandidateResponse, status_code=status.HTTP_201_CREATED)
async def create_candidate(
    data: CandidateCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_api_key),
):
    candidate = await candidate_service.create_candidate(db, data)
    # Embed experience_summary in background
    if candidate.experience_summary:
        from app.services.embedding_service import EmbeddingService
        svc = EmbeddingService()
        background_tasks.add_task(svc.embed_candidate, db, candidate.id, candidate.experience_summary)
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
    _: str = Depends(verify_api_key),
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
    _: str = Depends(verify_api_key),
):
    candidate = await candidate_service.get_candidate(db, candidate_id)
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    return candidate


@router.post("/search", response_model=list[CandidateSearchResult])
async def search_candidates(
    request: CandidateSearchRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_api_key),
):
    svc = SearchService()
    return await svc.hybrid_search(db, request)
