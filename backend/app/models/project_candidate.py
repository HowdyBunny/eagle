import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ProjectCandidateStatus(str, enum.Enum):
    PENDING = "pending"
    RECOMMENDED = "recommended"
    ELIMINATED = "eliminated"
    INTERVIEWED = "interviewed"


class ProjectCandidate(Base):
    __tablename__ = "project_candidates"
    __table_args__ = (UniqueConstraint("project_id", "candidate_id", name="uq_project_candidate"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False)
    match_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    dimension_scores: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)
    risk_flags: Mapped[str | None] = mapped_column(Text, nullable=True)
    hunter_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ProjectCandidateStatus] = mapped_column(
        Enum(ProjectCandidateStatus, name="project_candidate_status", values_callable=lambda x: [e.value for e in x]),
        default=ProjectCandidateStatus.PENDING,
        nullable=False,
    )
    evaluated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="project_candidates")  # noqa: F821
    candidate: Mapped["Candidate"] = relationship(back_populates="project_candidates")  # noqa: F821
