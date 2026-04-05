from __future__ import annotations

"""
ChromaDB service — replaces pgvector for vector storage.

Three collections:
  - candidate_embeddings  : candidate experience summary embeddings (ID = candidate_id)
  - industry_knowledge    : industry knowledge chunk embeddings (ID = auto UUID)
  - requirement_embeddings: project requirement profile embeddings (ID = project_id)

All collections use cosine distance (hnsw:space = cosine) to match the
behaviour of pgvector's <=> cosine distance operator.
"""

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config import settings

_client: chromadb.PersistentClient | None = None

CANDIDATE_EMBEDDINGS = "candidate_embeddings"
INDUSTRY_KNOWLEDGE = "industry_knowledge"
REQUIREMENT_EMBEDDINGS = "requirement_embeddings"


def get_chroma_client() -> chromadb.PersistentClient:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIR,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
    return _client


def get_candidate_collection() -> chromadb.Collection:
    return get_chroma_client().get_or_create_collection(
        name=CANDIDATE_EMBEDDINGS,
        metadata={"hnsw:space": "cosine"},
    )


def get_industry_collection() -> chromadb.Collection:
    return get_chroma_client().get_or_create_collection(
        name=INDUSTRY_KNOWLEDGE,
        metadata={"hnsw:space": "cosine"},
    )


def get_requirement_collection() -> chromadb.Collection:
    return get_chroma_client().get_or_create_collection(
        name=REQUIREMENT_EMBEDDINGS,
        metadata={"hnsw:space": "cosine"},
    )
