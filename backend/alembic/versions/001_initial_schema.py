"""initial schema (SQLite)

Revision ID: 001
Revises:
Create Date: 2026-04-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # projects
    op.create_table(
        "projects",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("client_name", sa.String(255), nullable=False),
        sa.Column("project_name", sa.String(255), nullable=False),
        sa.Column("jd_raw", sa.Text, nullable=True),
        sa.Column("requirement_profile", sa.JSON(), nullable=True),
        sa.Column("mode", sa.String(50), nullable=False, server_default="precise"),
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
        sa.Column("folder_path", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )

    # candidates
    op.create_table(
        "candidates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("current_title", sa.String(255), nullable=True),
        sa.Column("current_company", sa.String(255), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("years_experience", sa.Float, nullable=True),
        sa.Column("salary_range", sa.String(255), nullable=True),
        sa.Column("education", sa.String(500), nullable=True),
        sa.Column("linkedin_url", sa.String(1000), nullable=True),
        sa.Column("liepin_url", sa.String(1000), nullable=True),
        sa.Column("raw_structured_data", sa.JSON(), nullable=True),
        sa.Column("experience_summary", sa.Text, nullable=True),
        sa.Column("confidence_score", sa.Float, nullable=True),
        sa.Column("source_platform", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )

    # project_candidates
    op.create_table(
        "project_candidates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("candidate_id", sa.String(36), sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("match_score", sa.Float, nullable=True),
        sa.Column("dimension_scores", sa.JSON(), nullable=True),
        sa.Column("recommendation", sa.Text, nullable=True),
        sa.Column("risk_flags", sa.Text, nullable=True),
        sa.Column("hunter_feedback", sa.Text, nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("project_id", "candidate_id", name="uq_project_candidate"),
    )
    op.create_index("ix_project_candidates_project_id", "project_candidates", ["project_id"])
    op.create_index("ix_project_candidates_candidate_id", "project_candidates", ["candidate_id"])

    # preference_logs
    op.create_table(
        "preference_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("candidate_id", sa.String(36), sa.ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True),
        sa.Column("feedback_type", sa.String(100), nullable=False),
        sa.Column("hunter_comment", sa.Text, nullable=False),
        sa.Column("weight_adjustment", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )

    # skill_ontology
    op.create_table(
        "skill_ontology",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("industry", sa.String(255), nullable=False),
        sa.Column("concept", sa.String(255), nullable=False),
        sa.Column("synonyms", sa.JSON(), nullable=True),
        sa.Column("tech_stack", sa.JSON(), nullable=True),
        sa.Column("prerequisites", sa.JSON(), nullable=True),
        sa.Column("key_positions", sa.JSON(), nullable=True),
        sa.Column("skill_relations", sa.JSON(), nullable=True),
        sa.Column("jargon", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )

    # project_research
    op.create_table(
        "project_research",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ontology_id", sa.String(36), sa.ForeignKey("skill_ontology.id", ondelete="CASCADE"), nullable=False),
        sa.Column("report_file_path", sa.String(1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )

    # conversation_logs
    op.create_table(
        "conversation_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("intent_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_index("ix_conversation_logs_project_id", "conversation_logs", ["project_id"])


def downgrade() -> None:
    op.drop_table("conversation_logs")
    op.drop_table("project_research")
    op.drop_table("skill_ontology")
    op.drop_table("preference_logs")
    op.drop_table("project_candidates")
    op.drop_table("candidates")
    op.drop_table("projects")
