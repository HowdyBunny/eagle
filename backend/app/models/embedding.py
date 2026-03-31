import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config import settings
from app.database import Base


class CandidateEmbedding(Base):
    __tablename__ = "candidate_embeddings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidates.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    embedding: Mapped[list] = mapped_column(Vector(settings.EMBEDDING_DIMENSIONS), nullable=False)
    embedding_model_version: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    candidate: Mapped["Candidate"] = relationship(back_populates="candidate_embedding")  # noqa: F821


class IndustryKnowledge(Base):
    __tablename__ = "industry_knowledge"

    chunk_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_ontology_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("skill_ontology.id", ondelete="CASCADE"), nullable=False
    )
    content_text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list] = mapped_column(Vector(settings.EMBEDDING_DIMENSIONS), nullable=False)
    embedding_model_version: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    ontology: Mapped["SkillOntology"] = relationship(back_populates="industry_knowledge")  # noqa: F821


class RequirementEmbedding(Base):
    __tablename__ = "requirement_embeddings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    embedding: Mapped[list] = mapped_column(Vector(settings.EMBEDDING_DIMENSIONS), nullable=False)
    embedding_model_version: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="requirement_embedding")  # noqa: F821
