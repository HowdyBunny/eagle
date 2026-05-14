"""add conversation threads

Revision ID: d2e3f4a5b6c7
Revises: c1a2b3d4e5f6
Create Date: 2026-05-13

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d2e3f4a5b6c7"
down_revision: Union[str, None] = "c1a2b3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(conn, name: str) -> bool:
    return sa.inspect(conn).has_table(name)


def _column_exists(conn, table: str, column: str) -> bool:
    cols = [c["name"] for c in sa.inspect(conn).get_columns(table)]
    return column in cols


def _index_exists(conn, table: str, index: str) -> bool:
    return any(i["name"] == index for i in sa.inspect(conn).get_indexes(table))


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Create conversation_threads table (idempotent)
    if not _table_exists(conn, "conversation_threads"):
        op.create_table(
            "conversation_threads",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(200), nullable=False, server_default="新对话"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if not _index_exists(conn, "conversation_threads", "ix_conversation_threads_project_id"):
        op.create_index("ix_conversation_threads_project_id", "conversation_threads", ["project_id"])

    # 2. Add thread_id column to conversation_logs (idempotent)
    if not _column_exists(conn, "conversation_logs", "thread_id"):
        with op.batch_alter_table("conversation_logs") as batch_op:
            batch_op.add_column(
                sa.Column("thread_id", sa.String(36), nullable=True)
            )

    if not _index_exists(conn, "conversation_logs", "ix_conversation_logs_thread_id"):
        op.create_index("ix_conversation_logs_thread_id", "conversation_logs", ["thread_id"])


def downgrade() -> None:
    conn = op.get_bind()

    if _index_exists(conn, "conversation_logs", "ix_conversation_logs_thread_id"):
        op.drop_index("ix_conversation_logs_thread_id", "conversation_logs")

    if _column_exists(conn, "conversation_logs", "thread_id"):
        with op.batch_alter_table("conversation_logs") as batch_op:
            batch_op.drop_column("thread_id")

    if _index_exists(conn, "conversation_threads", "ix_conversation_threads_project_id"):
        op.drop_index("ix_conversation_threads_project_id", "conversation_threads")

    if _table_exists(conn, "conversation_threads"):
        op.drop_table("conversation_threads")
