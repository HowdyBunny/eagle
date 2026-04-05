import uuid
from datetime import datetime

from sqlalchemy import DateTime, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, UUIDString


class SkillOntology(Base):
    __tablename__ = "skill_ontology"

    id: Mapped[uuid.UUID] = mapped_column(UUIDString(), primary_key=True, default=uuid.uuid4)
    industry: Mapped[str] = mapped_column(String(255), nullable=False)
    concept: Mapped[str] = mapped_column(String(255), nullable=False)
    synonyms: Mapped[list | None] = mapped_column(JSON, nullable=True)
    tech_stack: Mapped[list | None] = mapped_column(JSON, nullable=True)
    prerequisites: Mapped[list | None] = mapped_column(JSON, nullable=True)
    key_positions: Mapped[list | None] = mapped_column(JSON, nullable=True)
    skill_relations: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    jargon: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    project_research: Mapped[list["ProjectResearch"]] = relationship(back_populates="ontology")  # noqa: F821
