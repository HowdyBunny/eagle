"""add talent lists and members

Revision ID: a1b2c3d4e5f7
Revises: f6a7b8c9d0e1
Create Date: 2026-05-22

Adds two tables for recruiter-curated candidate lists:
- talent_lists: a saved snapshot of a search (filters + name + optional project tag)
- talent_list_members: the candidates pinned into a list, with per-candidate outreach
  status and notes. A candidate may belong to multiple lists.

Lists with project_id=NULL are "orphan" lists (created from the talent pool view
without a project context). They are global by design — the sidebar tab shows
all lists regardless of currentProject.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(conn, name: str) -> bool:
    return sa.inspect(conn).has_table(name)


def _index_exists(conn, table: str, index: str) -> bool:
    return any(i["name"] == index for i in sa.inspect(conn).get_indexes(table))


def upgrade() -> None:
    conn = op.get_bind()

    if not _table_exists(conn, "talent_lists"):
        op.create_table(
            "talent_lists",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column(
                "project_id",
                sa.String(36),
                sa.ForeignKey("projects.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("filters_json", sa.JSON(), nullable=True),
            sa.Column("source", sa.String(50), nullable=False, server_default="manual"),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
        )

    if not _index_exists(conn, "talent_lists", "ix_talent_lists_project_id"):
        op.create_index("ix_talent_lists_project_id", "talent_lists", ["project_id"])

    if not _table_exists(conn, "talent_list_members"):
        op.create_table(
            "talent_list_members",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column(
                "list_id",
                sa.String(36),
                sa.ForeignKey("talent_lists.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "candidate_id",
                sa.String(36),
                sa.ForeignKey("candidates.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "status", sa.String(50), nullable=False, server_default="not_contacted"
            ),
            sa.Column("hunter_note", sa.Text, nullable=True),
            sa.Column(
                "added_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
            sa.UniqueConstraint("list_id", "candidate_id", name="uq_talent_list_candidate"),
        )

    if not _index_exists(conn, "talent_list_members", "ix_talent_list_members_list_id"):
        op.create_index(
            "ix_talent_list_members_list_id", "talent_list_members", ["list_id"]
        )
    if not _index_exists(conn, "talent_list_members", "ix_talent_list_members_candidate_id"):
        op.create_index(
            "ix_talent_list_members_candidate_id", "talent_list_members", ["candidate_id"]
        )


def downgrade() -> None:
    conn = op.get_bind()

    if _index_exists(conn, "talent_list_members", "ix_talent_list_members_candidate_id"):
        op.drop_index("ix_talent_list_members_candidate_id", "talent_list_members")
    if _index_exists(conn, "talent_list_members", "ix_talent_list_members_list_id"):
        op.drop_index("ix_talent_list_members_list_id", "talent_list_members")
    if _table_exists(conn, "talent_list_members"):
        op.drop_table("talent_list_members")

    if _index_exists(conn, "talent_lists", "ix_talent_lists_project_id"):
        op.drop_index("ix_talent_lists_project_id", "talent_lists")
    if _table_exists(conn, "talent_lists"):
        op.drop_table("talent_lists")
