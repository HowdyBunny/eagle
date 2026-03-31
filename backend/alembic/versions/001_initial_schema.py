"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-31

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EMBEDDING_DIMENSIONS = 1536


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # Enum types — created explicitly with checkfirst=True.
    # create_type=False prevents op.create_table from trying to re-emit CREATE TYPE.
    project_mode = postgresql.ENUM("precise", "explore", name="project_mode", create_type=False)
    project_status = postgresql.ENUM("active", "completed", "archived", name="project_status", create_type=False)
    project_candidate_status = postgresql.ENUM(
        "pending", "recommended", "eliminated", "interviewed", name="project_candidate_status", create_type=False
    )
    conversation_role = postgresql.ENUM("hunter", "assistant", name="conversation_role", create_type=False)

    postgresql.ENUM("precise", "explore", name="project_mode").create(op.get_bind(), checkfirst=True)
    postgresql.ENUM("active", "completed", "archived", name="project_status").create(op.get_bind(), checkfirst=True)
    postgresql.ENUM(
        "pending", "recommended", "eliminated", "interviewed", name="project_candidate_status"
    ).create(op.get_bind(), checkfirst=True)
    postgresql.ENUM("hunter", "assistant", name="conversation_role").create(op.get_bind(), checkfirst=True)

    # projects
    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("client_name", sa.String(255), nullable=False),
        sa.Column("project_name", sa.String(255), nullable=False),
        sa.Column("jd_raw", sa.Text, nullable=True),
        sa.Column("requirement_profile", postgresql.JSONB, nullable=True),
        sa.Column("mode", project_mode, nullable=False, server_default="precise"),
        sa.Column("status", project_status, nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # candidates
    op.create_table(
        "candidates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("current_title", sa.String(255), nullable=True),
        sa.Column("current_company", sa.String(255), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("years_experience", sa.Float, nullable=True),
        sa.Column("salary_range", sa.String(255), nullable=True),
        sa.Column("education", sa.String(500), nullable=True),
        sa.Column("linkedin_url", sa.String(1000), nullable=True),
        sa.Column("liepin_url", sa.String(1000), nullable=True),
        sa.Column("raw_structured_data", postgresql.JSONB, nullable=True),
        sa.Column("experience_summary", sa.Text, nullable=True),
        sa.Column("confidence_score", sa.Float, nullable=True),
        sa.Column("source_platform", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # project_candidates
    op.create_table(
        "project_candidates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("match_score", sa.Float, nullable=True),
        sa.Column("dimension_scores", postgresql.JSONB, nullable=True),
        sa.Column("recommendation", sa.Text, nullable=True),
        sa.Column("risk_flags", sa.Text, nullable=True),
        sa.Column("hunter_feedback", sa.Text, nullable=True),
        sa.Column("status", project_candidate_status, nullable=False, server_default="pending"),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("project_id", "candidate_id", name="uq_project_candidate"),
    )
    op.create_index("ix_project_candidates_project_id", "project_candidates", ["project_id"])
    op.create_index("ix_project_candidates_candidate_id", "project_candidates", ["candidate_id"])

    # preference_logs
    op.create_table(
        "preference_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True),
        sa.Column("feedback_type", sa.String(100), nullable=False),
        sa.Column("hunter_comment", sa.Text, nullable=False),
        sa.Column("weight_adjustment", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # skill_ontology
    op.create_table(
        "skill_ontology",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("industry", sa.String(255), nullable=False),
        sa.Column("concept", sa.String(255), nullable=False),
        sa.Column("synonyms", postgresql.JSONB, nullable=True),
        sa.Column("tech_stack", postgresql.JSONB, nullable=True),
        sa.Column("prerequisites", postgresql.JSONB, nullable=True),
        sa.Column("key_positions", postgresql.JSONB, nullable=True),
        sa.Column("skill_relations", postgresql.JSONB, nullable=True),
        sa.Column("jargon", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # project_research
    op.create_table(
        "project_research",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ontology_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("skill_ontology.id", ondelete="CASCADE"), nullable=False),
        sa.Column("report_file_path", sa.String(1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # conversation_logs
    op.create_table(
        "conversation_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", conversation_role, nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("intent_json", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_conversation_logs_project_id", "conversation_logs", ["project_id"])

    # candidate_embeddings
    op.create_table(
        "candidate_embeddings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("embedding", Vector(EMBEDDING_DIMENSIONS), nullable=False),
        sa.Column("embedding_model_version", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # industry_knowledge
    op.create_table(
        "industry_knowledge",
        sa.Column("chunk_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source_ontology_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("skill_ontology.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content_text", sa.Text, nullable=False),
        sa.Column("embedding", Vector(EMBEDDING_DIMENSIONS), nullable=False),
        sa.Column("embedding_model_version", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # requirement_embeddings
    op.create_table(
        "requirement_embeddings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("embedding", Vector(EMBEDDING_DIMENSIONS), nullable=False),
        sa.Column("embedding_model_version", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # HNSW vector indexes for ANN search
    op.execute("CREATE INDEX ON candidate_embeddings USING hnsw (embedding vector_cosine_ops);")
    op.execute("CREATE INDEX ON industry_knowledge USING hnsw (embedding vector_cosine_ops);")
    op.execute("CREATE INDEX ON requirement_embeddings USING hnsw (embedding vector_cosine_ops);")


def downgrade() -> None:
    op.drop_table("requirement_embeddings")
    op.drop_table("industry_knowledge")
    op.drop_table("candidate_embeddings")
    op.drop_table("conversation_logs")
    op.drop_table("project_research")
    op.drop_table("skill_ontology")
    op.drop_table("preference_logs")
    op.drop_table("project_candidates")
    op.drop_table("candidates")
    op.drop_table("projects")

    op.execute("DROP TYPE IF EXISTS conversation_role;")
    op.execute("DROP TYPE IF EXISTS project_candidate_status;")
    op.execute("DROP TYPE IF EXISTS project_status;")
    op.execute("DROP TYPE IF EXISTS project_mode;")
