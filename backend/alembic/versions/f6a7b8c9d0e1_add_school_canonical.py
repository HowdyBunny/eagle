"""add school_canonical column

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-05-20

Adds a normalized school slug column (e.g. "tsinghua", "stanford") so
recruiters can filter by alma mater without relying on substring or
embedding-based matching.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(conn, table: str, column: str) -> bool:
    cols = [c["name"] for c in sa.inspect(conn).get_columns(table)]
    return column in cols


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, "candidates", "school_canonical"):
        with op.batch_alter_table("candidates") as batch_op:
            batch_op.add_column(sa.Column("school_canonical", sa.String(64), nullable=True))

    # Backfill existing rows using the same helper used at write time.
    from app.services.school_normalizer import canonicalize_school

    rows = conn.execute(
        sa.text("SELECT id, education FROM candidates WHERE education IS NOT NULL")
    ).fetchall()
    for row in rows:
        slug = canonicalize_school(row.education)
        if slug:
            conn.execute(
                sa.text("UPDATE candidates SET school_canonical = :s WHERE id = :i"),
                {"s": slug, "i": row.id},
            )


def downgrade() -> None:
    conn = op.get_bind()
    if _column_exists(conn, "candidates", "school_canonical"):
        with op.batch_alter_table("candidates") as batch_op:
            batch_op.drop_column("school_canonical")
