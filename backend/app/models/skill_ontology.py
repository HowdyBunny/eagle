import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SkillOntology(Base):
    __tablename__ = "skill_ontology"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    industry: Mapped[str] = mapped_column(String(255), nullable=False)
    concept: Mapped[str] = mapped_column(String(255), nullable=False)
    synonyms: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    tech_stack: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    prerequisites: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    key_positions: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    skill_relations: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    jargon: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    project_research: Mapped[list["ProjectResearch"]] = relationship(back_populates="ontology")  # noqa: F821
    industry_knowledge: Mapped[list["IndustryKnowledge"]] = relationship(back_populates="ontology", cascade="all, delete-orphan")  # noqa: F821
