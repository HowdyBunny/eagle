import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, UUIDString


class TalentListMemberStatus(str, enum.Enum):
    """
    Outreach-workflow status, distinct from ProjectCandidateStatus.

    project_candidates.status tracks business milestones (recommended / interviewed / eliminated).
    These values track recruiter-side outreach progress for a candidate inside one list.
    """
    NOT_CONTACTED = "not_contacted"
    CONTACTED = "contacted"
    SCHEDULED = "scheduled"
    DECLINED = "declined"
    # Hunter promoted this candidate to project-level evaluation. From this point
    # forward the project_candidates row is the source of truth for next steps.
    ADDED_TO_PROJECT = "added_to_project"


class TalentListSource(str, enum.Enum):
    MANUAL = "manual"
    CA_CONVERSATION = "ca_conversation"


class TalentList(Base):
    __tablename__ = "talent_lists"

    id: Mapped[uuid.UUID] = mapped_column(UUIDString(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Nullable: list can be orphan (created from talent pool without a project context).
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDString(), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Snapshot of the search filters that produced this list. Mirrors the
    # CandidateSearchRequest shape on the frontend so the list can be "re-run".
    filters_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    source: Mapped[TalentListSource] = mapped_column(
        Enum(TalentListSource),
        default=TalentListSource.MANUAL,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    members: Mapped[list["TalentListMember"]] = relationship(
        back_populates="talent_list",
        cascade="all, delete-orphan",
        order_by="TalentListMember.added_at",
    )
    project: Mapped["Project"] = relationship(lazy="joined")  # noqa: F821


class TalentListMember(Base):
    __tablename__ = "talent_list_members"
    __table_args__ = (
        UniqueConstraint("list_id", "candidate_id", name="uq_talent_list_candidate"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUIDString(), primary_key=True, default=uuid.uuid4)
    list_id: Mapped[uuid.UUID] = mapped_column(
        UUIDString(), ForeignKey("talent_lists.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUIDString(), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[TalentListMemberStatus] = mapped_column(
        Enum(TalentListMemberStatus),
        default=TalentListMemberStatus.NOT_CONTACTED,
        nullable=False,
    )
    hunter_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    talent_list: Mapped["TalentList"] = relationship(back_populates="members")
    candidate: Mapped["Candidate"] = relationship(lazy="joined")  # noqa: F821
