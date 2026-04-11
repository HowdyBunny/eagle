import asyncio
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import Candidate
from app.schemas.candidate import CandidateResponse, CandidateSearchRequest, CandidateSearchResult
from app.services.lancedb_service import get_candidate_table, vector_search
from app.services.embedding_service import EmbeddingService


class SearchService:
    def __init__(self):
        self.embedding_svc = EmbeddingService()

    async def hybrid_search(
        self,
        db: AsyncSession,
        request: CandidateSearchRequest,
        project_id: uuid.UUID | None = None,
    ) -> list[CandidateSearchResult]:
        """
        Hybrid search: SQL filter (hard constraints) + LanceDB semantic search run in parallel.
        Results are merged, deduplicated, and ranked.
        """
        sql_task = asyncio.create_task(self._sql_search(db, request))

        vector_task = None
        if request.query:
            vector_task = asyncio.create_task(self._vector_search(request.query, limit=request.limit * 2))

        sql_ids = await sql_task
        vector_results: dict[uuid.UUID, float] = {}
        if vector_task:
            vector_results = await vector_task

        # Merge: union of both sets
        all_ids = set(sql_ids) | set(vector_results.keys())
        if not all_ids:
            return []

        # Fetch candidates
        result = await db.execute(select(Candidate).where(Candidate.id.in_(all_ids)))
        candidates_map = {c.id: c for c in result.scalars().all()}

        search_results: list[CandidateSearchResult] = []
        for candidate_id, candidate in candidates_map.items():
            sql_matched = candidate_id in sql_ids
            vector_score = vector_results.get(candidate_id)
            combined_score = _compute_combined_score(sql_matched, vector_score)
            search_results.append(
                CandidateSearchResult(
                    candidate=CandidateResponse.model_validate(candidate),
                    sql_matched=sql_matched,
                    vector_score=vector_score,
                    combined_score=combined_score,
                )
            )

        # Sort by combined_score descending
        search_results.sort(key=lambda r: r.combined_score, reverse=True)
        return search_results[request.offset: request.offset + request.limit]

    async def _sql_search(self, db: AsyncSession, request: CandidateSearchRequest) -> set[uuid.UUID]:
        query = select(Candidate.id)
        if request.location:
            query = query.where(Candidate.location.ilike(f"%{request.location}%"))
        if request.min_years_experience is not None:
            query = query.where(Candidate.years_experience >= request.min_years_experience)
        if request.max_years_experience is not None:
            query = query.where(Candidate.years_experience <= request.max_years_experience)
        if request.current_company:
            query = query.where(Candidate.current_company.ilike(f"%{request.current_company}%"))
        if request.source_platform:
            query = query.where(Candidate.source_platform == request.source_platform)

        result = await db.execute(query)
        return {row[0] for row in result.fetchall()}

    async def _vector_search(self, query_text: str, limit: int = 40) -> dict[uuid.UUID, float]:
        query_embedding = await self.embedding_svc.get_embedding(query_text)
        # LanceDB cosine distance (lower = more similar), same range as pgvector <=>
        rows = vector_search(get_candidate_table(), query_embedding, limit=limit)
        return {uuid.UUID(r["id"]): float(r["_distance"]) for r in rows}


def _compute_combined_score(sql_matched: bool, vector_score: float | None) -> float:
    """
    Combined ranking score (0-100, higher = better).

    Formula:
      - sql_bonus    = 40 pts  (candidate passed all hard SQL filters)
      - vector_part  = (1 - cosine_distance) * 60, clamped to [0, 60]
                       (cosine distance range: 0=identical, 1=orthogonal, 2=opposite)

    Examples:
      SQL only (no query text):          40
      Vector only, distance=0.1:         0 + 0.9*60 = 54
      Both, distance=0.2:                40 + 0.8*60 = 88
      Both, distance=0.0 (perfect):      40 + 60    = 100
    """
    sql_bonus = 40.0 if sql_matched else 0.0
    vector_part = 0.0
    if vector_score is not None:
        similarity = max(0.0, 1.0 - vector_score)  # convert distance → similarity
        vector_part = similarity * 60.0
    return round(min(100.0, sql_bonus + vector_part), 2)
