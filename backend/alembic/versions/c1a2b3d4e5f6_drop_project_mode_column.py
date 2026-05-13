"""drop project mode column

Revision ID: c1a2b3d4e5f6
Revises: b7d4e1f92c05
Create Date: 2026-05-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c1a2b3d4e5f6"
down_revision: Union[str, None] = "b7d4e1f92c05"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite does not support DROP COLUMN directly before version 3.35.
    # We use the batch mode which rewrites the table to achieve the same result.
    with op.batch_alter_table("projects") as batch_op:
        batch_op.drop_column("mode")


def downgrade() -> None:
    with op.batch_alter_table("projects") as batch_op:
        batch_op.add_column(
            sa.Column("mode", sa.String(50), nullable=False, server_default="precise")
        )
