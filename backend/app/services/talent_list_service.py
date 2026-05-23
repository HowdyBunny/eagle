"""
Talent List service.

Lists are global entities; project_id is an optional tag. Lists with project_id=NULL
remain visible in the sidebar regardless of which project the recruiter has selected.

Members carry their own outreach-progress status (talent_list_members.status), which
is intentionally separate from project_candidates.status — see PRD.md and the
TalentListMemberStatus enum docstring for the rationale.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.candidate import Candidate
from app.models.project import Project
from app.models.talent_list import (
    TalentList,
    TalentListMember,
    TalentListMemberStatus,
)
from app.schemas.talent_list import (
    TalentListCreate,
    TalentListMemberUpdate,
    TalentListUpdate,
)


# ── Lists ─────────────────────────────────────────────────────────────────────


async def create_list(db: AsyncSession, data: TalentListCreate) -> TalentList:
    talent_list = TalentList(
        id=uuid.uuid4(),
        name=data.name.strip(),
        project_id=data.project_id,
        filters_json=data.filters_json,
        source=data.source,
    )
    db.add(talent_list)

    # Initial members. Duplicate candidate_ids in the request are de-duplicated;
    # silently dropping unknown candidate ids would mask bugs, so we let the
    # FK constraint fail loudly instead.
    seen: set[uuid.UUID] = set()
    for cid in data.candidate_ids:
        if cid in seen:
            continue
        seen.add(cid)
        db.add(
            TalentListMember(
                id=uuid.uuid4(),
                list_id=talent_list.id,
                candidate_id=cid,
            )
        )

    await db.commit()
    await db.refresh(talent_list)
    return talent_list


async def get_list(db: AsyncSession, list_id: uuid.UUID) -> TalentList | None:
    result = await db.execute(
        select(TalentList)
        .where(TalentList.id == list_id)
        .options(
            joinedload(TalentList.project),
            selectinload(TalentList.members).joinedload(TalentListMember.candidate),
        )
    )
    return result.unique().scalar_one_or_none()


async def list_lists(
    db: AsyncSession,
    *,
    project_id: uuid.UUID | None = None,
    unassigned: bool = False,
) -> list[TalentList]:
    """
    List all talent lists, newest first.

    - project_id set → only lists tagged with that project
    - unassigned=True → only orphan lists (project_id IS NULL)
    - both unset → all lists

    Note: project_id is mutually exclusive with unassigned at the route layer.
    """
    query = (
        select(TalentList)
        .options(
            joinedload(TalentList.project),
            selectinload(TalentList.members),
        )
        .order_by(TalentList.updated_at.desc())
    )
    if unassigned:
        query = query.where(TalentList.project_id.is_(None))
    elif project_id is not None:
        query = query.where(TalentList.project_id == project_id)

    result = await db.execute(query)
    return list(result.unique().scalars().all())


async def update_list(
    db: AsyncSession, list_id: uuid.UUID, data: TalentListUpdate
) -> TalentList | None:
    talent_list = await get_list(db, list_id)
    if not talent_list:
        return None

    # exclude_unset distinguishes "field omitted" from "field set to null".
    # Setting project_id=null explicitly is how an orphan list gets created
    # from a previously-bound list.
    update_data = data.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] is not None:
        update_data["name"] = update_data["name"].strip()

    for field, value in update_data.items():
        setattr(talent_list, field, value)
    talent_list.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(talent_list)
    return talent_list


async def delete_list(db: AsyncSession, list_id: uuid.UUID) -> bool:
    talent_list = await get_list(db, list_id)
    if not talent_list:
        return False
    await db.delete(talent_list)
    await db.commit()
    return True


# ── Members ───────────────────────────────────────────────────────────────────


async def add_members(
    db: AsyncSession, list_id: uuid.UUID, candidate_ids: list[uuid.UUID]
) -> list[TalentListMember]:
    """
    Add candidates to a list. Already-present candidates are silently skipped
    (idempotent on duplicates so the UI can re-add freely without 409s).
    Returns the newly-added member rows only.
    """
    existing = await db.execute(
        select(TalentListMember.candidate_id).where(TalentListMember.list_id == list_id)
    )
    existing_ids = {row[0] for row in existing.all()}

    new_members: list[TalentListMember] = []
    seen: set[uuid.UUID] = set()
    for cid in candidate_ids:
        if cid in seen or cid in existing_ids:
            continue
        seen.add(cid)
        m = TalentListMember(id=uuid.uuid4(), list_id=list_id, candidate_id=cid)
        db.add(m)
        new_members.append(m)

    if new_members:
        # Bump the list's updated_at so the index page re-orders.
        list_obj = await db.execute(select(TalentList).where(TalentList.id == list_id))
        list_row = list_obj.scalar_one_or_none()
        if list_row:
            list_row.updated_at = datetime.now(timezone.utc)

    await db.commit()
    for m in new_members:
        await db.refresh(m)
    return new_members


async def get_member(
    db: AsyncSession, list_id: uuid.UUID, candidate_id: uuid.UUID
) -> TalentListMember | None:
    result = await db.execute(
        select(TalentListMember)
        .where(
            TalentListMember.list_id == list_id,
            TalentListMember.candidate_id == candidate_id,
        )
        .options(joinedload(TalentListMember.candidate))
    )
    return result.scalar_one_or_none()


async def update_member(
    db: AsyncSession,
    list_id: uuid.UUID,
    candidate_id: uuid.UUID,
    data: TalentListMemberUpdate,
) -> TalentListMember | None:
    member = await get_member(db, list_id, candidate_id)
    if not member:
        return None
    if data.status is not None:
        member.status = data.status
    if data.hunter_note is not None:
        # Empty string = clear the note (intentional). Distinct from omitted.
        member.hunter_note = data.hunter_note or None
    member.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(member)
    return member


async def remove_member(
    db: AsyncSession, list_id: uuid.UUID, candidate_id: uuid.UUID
) -> bool:
    member = await get_member(db, list_id, candidate_id)
    if not member:
        return False
    await db.delete(member)
    await db.commit()
    return True


async def mark_member_added_to_project(
    db: AsyncSession, list_id: uuid.UUID, candidate_id: uuid.UUID
) -> TalentListMember | None:
    """
    Called from the evaluate endpoint when source_list_id is supplied.
    Idempotent: re-marking has no effect.
    """
    member = await get_member(db, list_id, candidate_id)
    if not member:
        return None
    if member.status != TalentListMemberStatus.ADDED_TO_PROJECT:
        member.status = TalentListMemberStatus.ADDED_TO_PROJECT
        member.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(member)
    return member


# ── Helpers for response shaping ──────────────────────────────────────────────


def member_count(talent_list: TalentList) -> int:
    return len(talent_list.members) if talent_list.members is not None else 0


def status_counts(talent_list: TalentList) -> dict[str, int]:
    counts: dict[str, int] = {}
    for m in talent_list.members or []:
        key = m.status.value if hasattr(m.status, "value") else str(m.status)
        counts[key] = counts.get(key, 0) + 1
    return counts
