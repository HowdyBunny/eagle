from __future__ import annotations

"""
LanceDB service — replaces ChromaDB for vector storage.

Three tables (fixed schemas, cosine distance):
  - candidate_embeddings   : (id, candidate_id, chunk_type, chunk_index,
                              vector, document, embedding_model_version)
                              — multiple chunks per candidate (profile +
                              one per work experience). Group by candidate_id.
  - requirement_embeddings : (id, vector, document, embedding_model_version)
  - industry_knowledge     : (id, vector, document, source_ontology_id,
                              embedding_model_version)

LanceDB's cosine distance is in [0, 2] (1 - cosine_similarity, same range
as Chroma/pgvector), so downstream scoring formulas are unchanged.
"""

import asyncio

import lancedb
import pyarrow as pa
from lancedb.table import Table

# LanceDB does not support concurrent writes — serialize all write operations.
_write_lock = asyncio.Lock()

from app.config import settings

_db: lancedb.DBConnection | None = None

CANDIDATE_TABLE = "candidate_embeddings"
INDUSTRY_TABLE = "industry_knowledge"
REQUIREMENT_TABLE = "requirement_embeddings"


def _vector_field() -> pa.Field:
    return pa.field("vector", pa.list_(pa.float32(), list_size=settings.EMBEDDING_DIMENSIONS))


def _simple_schema() -> pa.Schema:
    return pa.schema(
        [
            pa.field("id", pa.string()),
            _vector_field(),
            pa.field("document", pa.string()),
            pa.field("embedding_model_version", pa.string()),
        ]
    )


def _candidate_schema() -> pa.Schema:
    """Multi-chunk schema: one row per (candidate, chunk). Group by candidate_id."""
    return pa.schema(
        [
            pa.field("id", pa.string()),               # chunk uuid
            pa.field("candidate_id", pa.string()),     # group key
            pa.field("chunk_type", pa.string()),       # "profile" | "experience"
            pa.field("chunk_index", pa.int32()),       # ordinal within candidate
            _vector_field(),
            pa.field("document", pa.string()),
            pa.field("embedding_model_version", pa.string()),
        ]
    )


def _industry_schema() -> pa.Schema:
    return pa.schema(
        [
            pa.field("id", pa.string()),
            _vector_field(),
            pa.field("document", pa.string()),
            pa.field("source_ontology_id", pa.string()),
            pa.field("embedding_model_version", pa.string()),
        ]
    )


def get_db() -> lancedb.DBConnection:
    global _db
    if _db is None:
        _db = lancedb.connect(settings.LANCEDB_PERSIST_DIR)
    return _db


def _check_and_reset_schema(
    db: lancedb.DBConnection,
    name: str,
    expected_dim: int,
    required_fields: tuple[str, ...] = (),
) -> None:
    """
    Drop `name` if either:
      - its stored vector dim doesn't match expected_dim
      - any of `required_fields` is missing from its schema

    Called at startup so schema mismatches (e.g. after changing EMBEDDING_DIMENSIONS,
    switching embedding models, or upgrading the chunked-candidate schema) are caught
    early rather than crashing on first write.
    """
    if name not in db.table_names():
        return
    try:
        from app.utils.logger import logger

        tbl = db.open_table(name)
        schema = tbl.schema
        stored_dim: int = schema.field("vector").type.list_size
        existing_names = {f.name for f in schema}
        missing = [f for f in required_fields if f not in existing_names]
        if stored_dim != expected_dim:
            logger.warning(
                f"LanceDB table '{name}' has vector dim={stored_dim} but "
                f"EMBEDDING_DIMENSIONS={expected_dim}. Dropping and recreating."
            )
            db.drop_table(name)
        elif missing:
            logger.warning(
                f"LanceDB table '{name}' is missing fields {missing}; "
                f"dropping so the new chunked schema can be recreated. "
                f"Run scripts/reembed_candidates.py to repopulate."
            )
            db.drop_table(name)
    except Exception:
        pass  # If we can't read schema, let _open_or_create handle it


def validate_schemas() -> None:
    """
    Run at app startup. Drops any LanceDB table whose vector dimension or
    required field set no longer matches the current code.
    """
    db = get_db()
    dim = settings.EMBEDDING_DIMENSIONS
    _check_and_reset_schema(
        db, CANDIDATE_TABLE, dim,
        required_fields=("candidate_id", "chunk_type", "chunk_index"),
    )
    _check_and_reset_schema(db, REQUIREMENT_TABLE, dim)
    _check_and_reset_schema(db, INDUSTRY_TABLE, dim)


def _open_or_create(name: str, schema: pa.Schema) -> Table:
    db = get_db()
    if name in db.table_names():
        return db.open_table(name)
    return db.create_table(name, schema=schema)


def get_candidate_table() -> Table:
    return _open_or_create(CANDIDATE_TABLE, _candidate_schema())


def get_industry_table() -> Table:
    return _open_or_create(INDUSTRY_TABLE, _industry_schema())


def get_requirement_table() -> Table:
    return _open_or_create(REQUIREMENT_TABLE, _simple_schema())


def upsert_row(table: Table, row: dict) -> None:
    """
    Delete-then-add upsert keyed on `id`.
    Avoids merge_insert's DataFusion MERGE query which triggers LanceDB Spill errors
    on some versions. Both operations are simple log appends with no DataFusion overhead.
    Use upsert_row_async from async contexts.
    """
    row_id = str(row["id"])
    table.delete(f"id = '{row_id}'")
    table.add([row])


async def upsert_row_async(table: Table, row: dict) -> None:
    """Async-safe upsert: serializes writes via _write_lock, runs in thread pool."""
    loop = asyncio.get_running_loop()
    async with _write_lock:
        await loop.run_in_executor(None, lambda: upsert_row(table, row))


async def table_add_async(table: Table, rows: list[dict]) -> None:
    """Async-safe table.add: serializes writes via _write_lock, runs in thread pool."""
    loop = asyncio.get_running_loop()
    async with _write_lock:
        await loop.run_in_executor(None, lambda: table.add(rows))


async def delete_candidate_chunks_async(table: Table, candidate_id: str) -> None:
    """Delete every chunk belonging to a single candidate from the chunked table."""
    loop = asyncio.get_running_loop()
    async with _write_lock:
        await loop.run_in_executor(
            None, lambda: table.delete(f"candidate_id = '{candidate_id}'")
        )


def vector_search(table: Table, query_vector: list[float], limit: int) -> list[dict]:
    """
    Cosine-distance kNN search. Each row has `_distance` plus all columns.

    Synchronous — blocks the calling thread (and the asyncio event loop if
    called from a coroutine). Prefer `vector_search_async` from async paths;
    using this directly inside an async handler stalls every other in-flight
    request (Network Errors on concurrent calls, etc.).
    """
    return (
        table.search(query_vector)
        .metric("cosine")
        .limit(limit)
        .to_list()
    )


async def vector_search_async(
    table: Table, query_vector: list[float], limit: int
) -> list[dict]:
    """
    Async-safe wrapper: runs the sync LanceDB query in a thread pool so the
    event loop keeps accepting other requests while the search is in flight.
    Reads don't need _write_lock — LanceDB supports concurrent readers.
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None, lambda: vector_search(table, query_vector, limit)
    )


async def get_table_async(getter) -> Table:
    """
    Async-safe wrapper for the sync `get_*_table()` helpers. The first call
    for a given table may hit disk (open or create), which blocks the loop.
    Once opened the underlying connection caches the handle so subsequent
    calls are cheap, but we still go through the executor for consistency.
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, getter)
