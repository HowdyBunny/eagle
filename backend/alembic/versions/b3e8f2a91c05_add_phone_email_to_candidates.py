"""add phone and email to candidates

Revision ID: b3e8f2a91c05
Revises: 99c6c81aed9f
Create Date: 2026-04-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b3e8f2a91c05"
down_revision: Union[str, None] = "99c6c81aed9f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("candidates", schema=None) as batch_op:
        batch_op.add_column(sa.Column("phone", sa.String(50), nullable=True))
        batch_op.add_column(sa.Column("email", sa.String(255), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("candidates", schema=None) as batch_op:
        batch_op.drop_column("email")
        batch_op.drop_column("phone")
