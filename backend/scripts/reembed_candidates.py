"""
Reembed every candidate with the new multi-chunk strategy.

Run once after upgrading from the single-field embedding scheme. Safe to re-run:
each candidate's existing chunks are deleted before fresh ones are inserted.

Usage (from the backend/ directory):

    uv run python scripts/reembed_candidates.py
    uv run python scripts/reembed_candidates.py --batch-size 25
    uv run python scripts/reembed_candidates.py --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import select  # noqa: E402

from app.database import async_session_maker  # noqa: E402
from app.models.candidate import Candidate  # noqa: E402
from app.services.embedding_service import (  # noqa: E402
    EmbeddingService,
    build_candidate_chunks,
    candidate_to_index_snapshot,
)
from app.services.lancedb_service import (  # noqa: E402
    get_candidate_table,
    validate_schemas,
)


async def reembed_all(batch_size: int, dry_run: bool) -> None:
    # Make sure the LanceDB candidate table is on the new schema before we start.
    validate_schemas()
    get_candidate_table()  # warm up / create

    svc = EmbeddingService()

    async with async_session_maker() as db:
        rows = (await db.execute(select(Candidate))).scalars().all()

    total = len(rows)
    print(f"Found {total} candidate(s) to reembed.")
    if total == 0:
        return

    for i in range(0, total, batch_size):
        batch = rows[i : i + batch_size]
        print(f"  [{i + 1}-{i + len(batch)}/{total}] embedding...", flush=True)
        for cand in batch:
            snap = candidate_to_index_snapshot(cand)
            chunks = build_candidate_chunks(snap)
            if dry_run:
                print(f"    · {cand.full_name}: would write {len(chunks)} chunks")
                continue
            await svc.embed_candidate(snap)

    if dry_run:
        print("Dry run complete — no embeddings written.")
    else:
        print(f"Done. Reembedded {total} candidate(s).")


def main() -> None:
    parser = argparse.ArgumentParser(description="Reembed every candidate.")
    parser.add_argument(
        "--batch-size",
        type=int,
        default=20,
        help="How many candidates to process per progress log line (default: 20).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print chunk counts without calling the embedding API or writing to LanceDB.",
    )
    args = parser.parse_args()
    asyncio.run(reembed_all(batch_size=args.batch_size, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
