import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ProjectMode(str, enum.Enum):
    PRECISE = "precise"
    EXPLORE = "explore"


class ProjectStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    project_name: Mapped[str] = mapped_column(String(255), nullable=False)
    jd_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    requirement_profile: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    mode: Mapped[ProjectMode] = mapped_column(
        Enum(ProjectMode, name="project_mode", values_callable=lambda x: [e.value for e in x]),
        default=ProjectMode.PRECISE,
        nullable=False,
    )
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus, name="project_status", values_callable=lambda x: [e.value for e in x]),
        default=ProjectStatus.ACTIVE,
        nullable=False,
    )
    folder_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    project_candidates: Mapped[list["ProjectCandidate"]] = relationship(back_populates="project", cascade="all, delete-orphan")  # noqa: F821
    preference_logs: Mapped[list["PreferenceLog"]] = relationship(back_populates="project", cascade="all, delete-orphan")  # noqa: F821
    conversation_logs: Mapped[list["ConversationLog"]] = relationship(back_populates="project", cascade="all, delete-orphan")  # noqa: F821
    project_research: Mapped[list["ProjectResearch"]] = relationship(back_populates="project", cascade="all, delete-orphan")  # noqa: F821
    requirement_embedding: Mapped["RequirementEmbedding | None"] = relationship(back_populates="project", cascade="all, delete-orphan")  # noqa: F821
