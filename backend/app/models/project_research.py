import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, UUIDString


class ResearchTaskStatus(str, enum.Enum):
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ProjectResearch(Base):
    __tablename__ = "project_research"

    id: Mapped[uuid.UUID] = mapped_column(UUIDString(), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    # nullable: record is created before research starts; filled in on completion
    ontology_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("skill_ontology.id", ondelete="SET NULL"), nullable=True)
    topic: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[ResearchTaskStatus] = mapped_column(
        Enum(ResearchTaskStatus, name="researchtaskstatus"),
        nullable=False,
        default=ResearchTaskStatus.RUNNING,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    report_file_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="project_research")  # noqa: F821
    ontology: Mapped["SkillOntology | None"] = relationship(back_populates="project_research")  # noqa: F821
