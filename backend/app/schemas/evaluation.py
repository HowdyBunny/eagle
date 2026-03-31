import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.project_candidate import ProjectCandidateStatus
from app.schemas.candidate import CandidateResponse


class ProjectCandidateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    candidate_id: uuid.UUID
    match_score: float | None
    dimension_scores: dict | None
    recommendation: str | None
    risk_flags: str | None
    hunter_feedback: str | None
    status: ProjectCandidateStatus
    evaluated_at: datetime | None
    candidate: CandidateResponse | None = None


class ProjectCandidateUpdate(BaseModel):
    status: ProjectCandidateStatus | None = None
    hunter_feedback: str | None = None


class EvaluationStatusResponse(BaseModel):
    project_id: uuid.UUID
    candidate_id: uuid.UUID
    is_complete: bool               # True once EA has finished and evaluated_at is set
    status: ProjectCandidateStatus
    match_score: float | None       # null until evaluation completes
    evaluated_at: datetime | None   # null until evaluation completes
    poll_interval_seconds: int = 5  # recommended polling interval
