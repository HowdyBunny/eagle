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

import lancedb
import pyarrow as pa
from lancedb.table import Table

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
    """Merge-insert a single row keyed on `id`."""
    (
        table.merge_insert("id")
        .when_matched_update_all()
        .when_not_matched_insert_all()
        .execute([row])
    )


def vector_search(table: Table, query_vector: list[float], limit: int) -> list[dict]:
    """Cosine-distance kNN search. Each row has `_distance` plus all columns."""
    return (
        table.search(query_vector)
        .metric("cosine")
        .limit(limit)
        .to_list()
    )
