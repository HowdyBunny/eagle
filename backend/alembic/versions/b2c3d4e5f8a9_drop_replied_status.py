"""drop 'replied' from talent_list_members.status

Revision ID: b2c3d4e5f8a9
Revises: a1b2c3d4e5f7
Create Date: 2026-05-23

The recruiter said 'replied' (已回复) isn't a useful distinct state —
'contacted' (已联系) already covers it. Collapse any existing 'replied'
rows into 'contacted' first, then drop the value from the enum at the
application layer.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "b2c3d4e5f8a9"
down_revision: Union[str, None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    # Status column is stored as String (TalentListMemberStatus enum values).
    # Idempotent: no-op on a DB that never had any 'replied' rows.
    conn.execute(
        sa.text(
            "UPDATE talent_list_members SET status = 'contacted' WHERE status = 'replied'"
        )
    )


def downgrade() -> None:
    # No-op: once collapsed into 'contacted' we can't recover the original
    # 'replied' vs 'contacted' distinction.
    pass
