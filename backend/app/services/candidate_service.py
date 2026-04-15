import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import Candidate
from app.schemas.candidate import CandidateCreate, CandidateUpdate
from app.services.confidence_service import calculate_confidence_score


async def create_candidate(db: AsyncSession, data: CandidateCreate) -> Candidate:
    # Derive tenure from raw_structured_data if available
    tenure_months = _extract_tenure_months(data.raw_structured_data)

    now = datetime.now(tz=timezone.utc)
    confidence = calculate_confidence_score(created_at=now, current_tenure_months=tenure_months)

    candidate = Candidate(
        full_name=data.full_name,
        current_title=data.current_title,
        current_company=data.current_company,
        location=data.location,
        years_experience=data.years_experience,
        salary_range=data.salary_range,
        education=data.education,
        linkedin_url=data.linkedin_url,
        liepin_url=data.liepin_url,
        phone=data.phone,
        email=data.email,
        raw_structured_data=data.raw_structured_data,
        experience_summary=data.experience_summary,
        confidence_score=confidence,
        source_platform=data.source_platform,
    )
    db.add(candidate)
    await db.commit()
    await db.refresh(candidate)
    return candidate


async def get_candidate(db: AsyncSession, candidate_id: uuid.UUID) -> Candidate | None:
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if candidate:
        _refresh_confidence(candidate)
    return candidate


async def list_candidates(
    db: AsyncSession,
    location: str | None = None,
    min_years_experience: float | None = None,
    max_years_experience: float | None = None,
    current_company: str | None = None,
    source_platform: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> list[Candidate]:
    query = select(Candidate)
    if location:
        query = query.where(Candidate.location.ilike(f"%{location}%"))
    if min_years_experience is not None:
        query = query.where(Candidate.years_experience >= min_years_experience)
    if max_years_experience is not None:
        query = query.where(Candidate.years_experience <= max_years_experience)
    if current_company:
        query = query.where(Candidate.current_company.ilike(f"%{current_company}%"))
    if source_platform:
        query = query.where(Candidate.source_platform == source_platform)

    query = query.order_by(Candidate.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    candidates = list(result.scalars().all())
    for c in candidates:
        _refresh_confidence(c)
    return candidates


async def update_candidate(
    db: AsyncSession, candidate_id: uuid.UUID, data: CandidateUpdate
) -> Candidate | None:
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        return None

    patch = data.model_dump(exclude_unset=True)
    for field, value in patch.items():
        setattr(candidate, field, value)
    candidate.updated_at = datetime.now(tz=timezone.utc)
    await db.commit()
    await db.refresh(candidate)
    _refresh_confidence(candidate)
    return candidate


async def delete_candidate(db: AsyncSession, candidate_id: uuid.UUID) -> bool:
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        return False
    await db.delete(candidate)
    await db.commit()
    return True


def _refresh_confidence(candidate: Candidate) -> None:
    """Recompute confidence score using current time (time-decay is dynamic)."""
    tenure_months = _extract_tenure_months(candidate.raw_structured_data)
    candidate.confidence_score = calculate_confidence_score(
        created_at=candidate.created_at,
        current_tenure_months=tenure_months,
    )


def _extract_tenure_months(raw_data: dict | None) -> float | None:
    """Extract current tenure in months from raw_structured_data if available."""
    if not raw_data:
        return None
    return raw_data.get("current_tenure_months")
