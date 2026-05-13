"""add_research_task_status

Revision ID: b7d4e1f92c05
Revises: 99c6c81aed9f
Create Date: 2026-04-26 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b7d4e1f92c05"
down_revision: Union[str, None] = "b3e8f2a91c05"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("project_research", schema=None) as batch_op:
        batch_op.add_column(sa.Column("topic", sa.String(length=500), nullable=True))
        batch_op.add_column(
            sa.Column(
                "status",
                sa.Enum("RUNNING", "COMPLETED", "FAILED", name="researchtaskstatus"),
                nullable=False,
                server_default="COMPLETED",  # existing rows were already successful
            )
        )
        batch_op.add_column(sa.Column("error_message", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True))
        # Make ontology_id nullable (was NOT NULL; now RA creates the record before research starts)
        batch_op.alter_column(
            "ontology_id",
            existing_type=sa.String(36),
            nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("project_research", schema=None) as batch_op:
        batch_op.alter_column(
            "ontology_id",
            existing_type=sa.String(36),
            nullable=False,
        )
        batch_op.drop_column("finished_at")
        batch_op.drop_column("error_message")
        batch_op.drop_column("status")
        batch_op.drop_column("topic")
