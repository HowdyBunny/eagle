import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.talent_list import TalentListMemberStatus, TalentListSource
from app.schemas.candidate import CandidateResponse
from app.schemas.evaluation import ProjectCandidateResponse


# ── Lists ─────────────────────────────────────────────────────────────────────


class TalentListCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    project_id: uuid.UUID | None = None
    filters_json: dict | None = None
    source: TalentListSource = TalentListSource.MANUAL
    # Optional initial members. If omitted, an empty list is created.
    candidate_ids: list[uuid.UUID] = Field(default_factory=list)


class TalentListUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    # Pass project_id=null explicitly to unbind a list. Pydantic's exclude_unset
    # is what the service uses to distinguish "unset" from "set to null".
    project_id: uuid.UUID | None = None
    filters_json: dict | None = None


class TalentListSummaryResponse(BaseModel):
    """Lightweight list summary used in the index page (no members)."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    project_id: uuid.UUID | None
    project_name: str | None = None
    client_name: str | None = None
    filters_json: dict | None
    source: TalentListSource
    member_count: int = 0
    # Outreach progress breakdown so the sidebar/index page can show
    # "12 人 · 已联系 4 · 已回复 2" without re-fetching every list.
    status_counts: dict[str, int] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class TalentListMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    list_id: uuid.UUID
    candidate_id: uuid.UUID
    status: TalentListMemberStatus
    hunter_note: str | None
    added_at: datetime
    updated_at: datetime
    candidate: CandidateResponse | None = None
    # Project-level evaluation joined in when the parent list is bound to a
    # project. Null otherwise. Once a member is promoted ("已推进"), this
    # carries the EA match_score, recommendation, project_candidate.status,
    # etc., so the list page can render the full follow-up state.
    project_evaluation: ProjectCandidateResponse | None = None


class TalentListDetailResponse(TalentListSummaryResponse):
    members: list[TalentListMemberResponse] = Field(default_factory=list)


# ── Members ───────────────────────────────────────────────────────────────────


class TalentListMembersAdd(BaseModel):
    candidate_ids: list[uuid.UUID] = Field(..., min_length=1)


class TalentListMemberUpdate(BaseModel):
    status: TalentListMemberStatus | None = None
    hunter_note: str | None = None
