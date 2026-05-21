"""add candidates_fts virtual table and sync triggers

Revision ID: e5f6a7b8c9d0
Revises: d2e3f4a5b6c7
Create Date: 2026-05-20

Creates an FTS5 virtual table over searchable candidate fields plus a
flattened JSON dump of `raw_structured_data.experiences`, and three
triggers that keep it in sync with the canonical `candidates` table.

The tokenizer is `trigram`, which gives reasonable substring matching for
both Chinese and English content without needing an external segmenter.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d2e3f4a5b6c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_EXPERIENCES_TEXT_EXPR = """COALESCE(
    (SELECT group_concat(
        IFNULL(json_extract(value, '$.company'), '') || ' ' ||
        IFNULL(json_extract(value, '$.title'), '') || ' ' ||
        IFNULL(json_extract(value, '$.duration'), '') || ' ' ||
        IFNULL(json_extract(value, '$.description'), ''),
        char(10)
     )
     FROM json_each(json_extract({source}.raw_structured_data, '$.experiences'))
    ),
    ''
)"""


def _table_exists(conn, name: str) -> bool:
    return sa.inspect(conn).has_table(name)


def upgrade() -> None:
    conn = op.get_bind()

    # 1. FTS5 virtual table. `candidate_id` is UNINDEXED — we still want it
    #    in the row, but we never search by it via MATCH.
    if not _table_exists(conn, "candidates_fts"):
        op.execute(
            """
            CREATE VIRTUAL TABLE candidates_fts USING fts5(
                candidate_id UNINDEXED,
                full_name,
                current_title,
                current_company,
                location,
                education,
                experience_summary,
                experiences_text,
                tokenize = 'trigram'
            )
            """
        )

    # 2. Triggers keep candidates_fts in sync with the canonical table.
    #    Drop-then-create so re-running the migration is safe even if Alembic
    #    half-applied last time.
    op.execute("DROP TRIGGER IF EXISTS candidates_after_insert")
    op.execute("DROP TRIGGER IF EXISTS candidates_after_update")
    op.execute("DROP TRIGGER IF EXISTS candidates_after_delete")

    new_exp = _EXPERIENCES_TEXT_EXPR.format(source="NEW")
    old_exp_unused = _EXPERIENCES_TEXT_EXPR.format(source="OLD")  # noqa: F841
    op.execute(
        f"""
        CREATE TRIGGER candidates_after_insert
        AFTER INSERT ON candidates
        BEGIN
            INSERT INTO candidates_fts(
                candidate_id, full_name, current_title, current_company,
                location, education, experience_summary, experiences_text
            ) VALUES (
                NEW.id,
                IFNULL(NEW.full_name, ''),
                IFNULL(NEW.current_title, ''),
                IFNULL(NEW.current_company, ''),
                IFNULL(NEW.location, ''),
                IFNULL(NEW.education, ''),
                IFNULL(NEW.experience_summary, ''),
                {new_exp}
            );
        END
        """
    )

    op.execute(
        f"""
        CREATE TRIGGER candidates_after_update
        AFTER UPDATE ON candidates
        BEGIN
            DELETE FROM candidates_fts WHERE candidate_id = OLD.id;
            INSERT INTO candidates_fts(
                candidate_id, full_name, current_title, current_company,
                location, education, experience_summary, experiences_text
            ) VALUES (
                NEW.id,
                IFNULL(NEW.full_name, ''),
                IFNULL(NEW.current_title, ''),
                IFNULL(NEW.current_company, ''),
                IFNULL(NEW.location, ''),
                IFNULL(NEW.education, ''),
                IFNULL(NEW.experience_summary, ''),
                {new_exp}
            );
        END
        """
    )

    op.execute(
        """
        CREATE TRIGGER candidates_after_delete
        AFTER DELETE ON candidates
        BEGIN
            DELETE FROM candidates_fts WHERE candidate_id = OLD.id;
        END
        """
    )

    # 3. Backfill from existing rows.
    backfill_exp = _EXPERIENCES_TEXT_EXPR.format(source="c")
    op.execute(
        f"""
        INSERT INTO candidates_fts(
            candidate_id, full_name, current_title, current_company,
            location, education, experience_summary, experiences_text
        )
        SELECT
            c.id,
            IFNULL(c.full_name, ''),
            IFNULL(c.current_title, ''),
            IFNULL(c.current_company, ''),
            IFNULL(c.location, ''),
            IFNULL(c.education, ''),
            IFNULL(c.experience_summary, ''),
            {backfill_exp}
        FROM candidates c
        WHERE NOT EXISTS (
            SELECT 1 FROM candidates_fts f WHERE f.candidate_id = c.id
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS candidates_after_insert")
    op.execute("DROP TRIGGER IF EXISTS candidates_after_update")
    op.execute("DROP TRIGGER IF EXISTS candidates_after_delete")
    op.execute("DROP TABLE IF EXISTS candidates_fts")
