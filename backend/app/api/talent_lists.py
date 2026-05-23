"""
Talent Lists REST API.

Routes live under /talent-lists (separate from /talent, which hosts the
candidate-import endpoints).
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.project_candidate import ProjectCandidate
from app.models.talent_list import TalentList
from app.schemas.evaluation import ProjectCandidateResponse
from app.schemas.talent_list import (
    TalentListCreate,
    TalentListDetailResponse,
    TalentListMemberResponse,
    TalentListMembersAdd,
    TalentListMemberUpdate,
    TalentListSummaryResponse,
    TalentListUpdate,
)
from app.services import talent_list_service

router = APIRouter(prefix="/talent-lists", tags=["talent-lists"])


# ── Response builders ─────────────────────────────────────────────────────────


def _to_summary(tl: TalentList) -> TalentListSummaryResponse:
    return TalentListSummaryResponse(
        id=tl.id,
        name=tl.name,
        project_id=tl.project_id,
        project_name=tl.project.project_name if tl.project else None,
        client_name=tl.project.client_name if tl.project else None,
        filters_json=tl.filters_json,
        source=tl.source,
        member_count=talent_list_service.member_count(tl),
        status_counts=talent_list_service.status_counts(tl),
        created_at=tl.created_at,
        updated_at=tl.updated_at,
    )


async def _fetch_project_evaluations(
    db: AsyncSession, project_id: uuid.UUID, candidate_ids: list[uuid.UUID]
) -> dict[uuid.UUID, ProjectCandidate]:
    """
    Look up project_candidates rows for the given (project_id, candidate_id) pairs.
    Returns a dict keyed by candidate_id for cheap lookup during response shaping.
    """
    if not candidate_ids:
        return {}
    result = await db.execute(
        select(ProjectCandidate)
        .where(
            ProjectCandidate.project_id == project_id,
            ProjectCandidate.candidate_id.in_(candidate_ids),
        )
        .options(selectinload(ProjectCandidate.candidate))
    )
    return {pc.candidate_id: pc for pc in result.scalars().all()}


async def _to_detail(db: AsyncSession, tl: TalentList) -> TalentListDetailResponse:
    # When the list is bound to a project, join in project_candidates so each
    # member can render its EA evaluation state (评估中 / 已评估 / 失败) and
    # the project-level workflow status (recommended / interviewed / ...).
    evals: dict[uuid.UUID, ProjectCandidate] = {}
    if tl.project_id and tl.members:
        evals = await _fetch_project_evaluations(
            db, tl.project_id, [m.candidate_id for m in tl.members]
        )

    members: list[TalentListMemberResponse] = []
    for m in tl.members or []:
        member_resp = TalentListMemberResponse.model_validate(m, from_attributes=True)
        pc = evals.get(m.candidate_id)
        if pc is not None:
            member_resp.project_evaluation = ProjectCandidateResponse.model_validate(
                pc, from_attributes=True
            )
        members.append(member_resp)

    return TalentListDetailResponse(
        **_to_summary(tl).model_dump(),
        members=members,
    )


# ── Lists ─────────────────────────────────────────────────────────────────────


@router.post(
    "",
    response_model=TalentListDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_talent_list(
    data: TalentListCreate,
    db: AsyncSession = Depends(get_db),
):
    talent_list = await talent_list_service.create_list(db, data)
    # Re-fetch with relationships populated so the response includes members & project.
    refreshed = await talent_list_service.get_list(db, talent_list.id)
    assert refreshed is not None  # just created
    return await _to_detail(db, refreshed)


@router.get("", response_model=list[TalentListSummaryResponse])
async def list_talent_lists(
    project_id: uuid.UUID | None = Query(default=None, description="Filter to lists tagged with this project"),
    unassigned: bool = Query(default=False, description="If true, return only orphan lists (project_id is null)"),
    db: AsyncSession = Depends(get_db),
):
    if project_id is not None and unassigned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="project_id and unassigned are mutually exclusive",
        )
    lists = await talent_list_service.list_lists(
        db, project_id=project_id, unassigned=unassigned
    )
    return [_to_summary(tl) for tl in lists]


@router.get("/{list_id}", response_model=TalentListDetailResponse)
async def get_talent_list(
    list_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    tl = await talent_list_service.get_list(db, list_id)
    if not tl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
    return await _to_detail(db, tl)


@router.patch("/{list_id}", response_model=TalentListDetailResponse)
async def update_talent_list(
    list_id: uuid.UUID,
    data: TalentListUpdate,
    db: AsyncSession = Depends(get_db),
):
    tl = await talent_list_service.update_list(db, list_id, data)
    if not tl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
    refreshed = await talent_list_service.get_list(db, list_id)
    assert refreshed is not None
    return await _to_detail(db, refreshed)


@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_talent_list(
    list_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    deleted = await talent_list_service.delete_list(db, list_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")


# ── Members ───────────────────────────────────────────────────────────────────


@router.post(
    "/{list_id}/members",
    response_model=list[TalentListMemberResponse],
    status_code=status.HTTP_201_CREATED,
)
async def add_list_members(
    list_id: uuid.UUID,
    data: TalentListMembersAdd,
    db: AsyncSession = Depends(get_db),
):
    tl = await talent_list_service.get_list(db, list_id)
    if not tl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
    new_members = await talent_list_service.add_members(db, list_id, data.candidate_ids)
    # The newly-added rows don't have their candidate relation loaded; refetch them.
    enriched: list[TalentListMemberResponse] = []
    for m in new_members:
        loaded = await talent_list_service.get_member(db, list_id, m.candidate_id)
        if loaded:
            enriched.append(TalentListMemberResponse.model_validate(loaded, from_attributes=True))
    return enriched


@router.patch(
    "/{list_id}/members/{candidate_id}",
    response_model=TalentListMemberResponse,
)
async def update_list_member(
    list_id: uuid.UUID,
    candidate_id: uuid.UUID,
    data: TalentListMemberUpdate,
    db: AsyncSession = Depends(get_db),
):
    member = await talent_list_service.update_member(db, list_id, candidate_id, data)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    return TalentListMemberResponse.model_validate(member, from_attributes=True)


@router.delete(
    "/{list_id}/members/{candidate_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_list_member(
    list_id: uuid.UUID,
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    removed = await talent_list_service.remove_member(db, list_id, candidate_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
