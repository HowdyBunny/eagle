"""fix 'REPLIED' rows (uppercase) that the previous migration missed

Revision ID: c3d4e5f9a0b1
Revises: b2c3d4e5f8a9
Create Date: 2026-05-23

The b2c3d4e5f8a9 migration tried to collapse 'replied' → 'contacted', but
SQLAlchemy's default Enum type stores enum *names* (uppercase) rather than
*values* (lowercase). So the actual DB rows were 'REPLIED', not 'replied',
and the previous UPDATE matched nothing.

This migration is case-insensitive to clean up both forms. Belt-and-braces
to avoid the same trap if someone seeded rows via raw SQL with the value
form.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "c3d4e5f9a0b1"
down_revision: Union[str, None] = "b2c3d4e5f8a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "UPDATE talent_list_members SET status = 'CONTACTED' "
            "WHERE UPPER(status) = 'REPLIED'"
        )
    )


def downgrade() -> None:
    pass
