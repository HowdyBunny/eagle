from __future__ import annotations

"""
LanceDB service — replaces ChromaDB for vector storage.

Three tables (fixed schemas, cosine distance):
  - candidate_embeddings   : (id, vector, document, embedding_model_version)
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


def _check_and_reset_schema(db: lancedb.DBConnection, name: str, expected_dim: int) -> None:
    """
    Drop `name` if its stored vector dimension doesn't match expected_dim.
    Called at startup so schema mismatches (e.g. after changing EMBEDDING_DIMENSIONS
    or switching embedding models) are caught early rather than crashing on first write.
    """
    if name not in db.table_names():
        return
    try:
        tbl = db.open_table(name)
        schema = tbl.schema
        vec_field = schema.field("vector")
        stored_dim: int = vec_field.type.list_size
        if stored_dim != expected_dim:
            from app.utils.logger import logger
            logger.warning(
                f"LanceDB table '{name}' has vector dim={stored_dim} but "
                f"EMBEDDING_DIMENSIONS={expected_dim}. Dropping and recreating."
            )
            db.drop_table(name)
    except Exception:
        pass  # If we can't read schema, let _open_or_create handle it


def validate_schemas() -> None:
    """
    Run at app startup. Drops any LanceDB table whose vector dimension
    doesn't match the current EMBEDDING_DIMENSIONS setting.
    """
    db = get_db()
    dim = settings.EMBEDDING_DIMENSIONS
    for table_name in (CANDIDATE_TABLE, REQUIREMENT_TABLE, INDUSTRY_TABLE):
        _check_and_reset_schema(db, table_name, dim)


def _open_or_create(name: str, schema: pa.Schema) -> Table:
    db = get_db()
    if name in db.table_names():
        return db.open_table(name)
    return db.create_table(name, schema=schema)


def get_candidate_table() -> Table:
    return _open_or_create(CANDIDATE_TABLE, _simple_schema())


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


def vector_search(table: Table, query_vector: list[float], limit: int) -> list[dict]:
    """Cosine-distance kNN search. Each row has `_distance` plus all columns."""
    return (
        table.search(query_vector)
        .metric("cosine")
        .limit(limit)
        .to_list()
    )
