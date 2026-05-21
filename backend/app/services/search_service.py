"""
Hybrid candidate search: SQL filter + FTS5 BM25 + LanceDB vector, fused with RRF.

Pipeline for a free-text query:

  1.  detect_identifier(query)
        → phone / email / linkedin / liepin URL
        → SQL exact-match path, skip everything else.

  2.  Hard SQL filter (location / years / company / source_platform / exclusions)
        → set of candidate IDs that satisfy the recruiter's filter chips.

  3.  Two retrieval passes in parallel (only if there is text to search on):
        - FTS5 BM25 over the candidates_fts virtual table → ranked candidate IDs
        - LanceDB cosine search over chunked candidate embeddings, grouped
          back by candidate_id taking the closest chunk's distance.

  4.  Reciprocal Rank Fusion combines the two retrieval rankings (k = 60).
        - If the SQL filter set is empty the fused score is used as-is.
        - Otherwise we intersect with the SQL set: hard filters are HARD.

  5.  Optional semantic exclusion (`exclude_query`) is embedded and any
        candidate whose chunk lies within cosine distance 0.45 of it gets
        dropped.

  6.  Fused scores are min-max scaled to [0, 100], with a small SQL bonus
        so a candidate that hits every filter beats one that only matched
        the free text.
"""

import asyncio
import re
import uuid

from sqlalchemy import or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import Candidate
from app.schemas.candidate import CandidateResponse, CandidateSearchRequest, CandidateSearchResult
from app.services.embedding_service import EmbeddingService
from app.services.lancedb_service import get_candidate_table, vector_search
from app.services.query_router import Identifier, detect_identifier

# RRF constant. 60 is the textbook value from Cormack et al. — high enough
# that no single retriever's #1 hit can fully dominate the fusion.
_RRF_K = 60

# How wide we cast each retrieval net before fusion. Over-fetch so RRF has
# enough overlap to work with.
_RETRIEVAL_LIMIT = 50

# A candidate gets bumped above pure-retrieval matches when it also satisfies
# every hard filter. Tuned to be smaller than the spread of fused scores so
# RRF still drives the ordering.
_SQL_FILTER_BONUS = 10.0

# Cosine distance threshold for "this candidate matches the exclusion concept".
_EXCLUDE_SIM_THRESHOLD = 0.45

# Cosine distance threshold for positive matches. Smaller distance = more
# similar (0 = identical, 1 = orthogonal). For OpenAI text-embedding-3-small
# on professional profile text, distances above ~0.82 are typically noise —
# "vaguely person-shaped text" with no real topical overlap. Drop them from
# the vector ranking instead of letting RRF rank pure noise into the result.
_VECTOR_MAX_DISTANCE = 0.82

# Tokens shorter than this make trigram FTS5 useless (trigram needs ≥3 chars).
# For 1-2 char queries we bypass FTS + vector and use SQL ILIKE instead — that
# matches the user's literal intent ("李" should find 娜李, not the model's
# guess at the closest cross-lingual Chinese surname).
_TRIGRAM_MIN_TOKEN_LEN = 3


def _is_all_short_query(query_text: str) -> bool:
    """
    True when every token in the query is below the trigram FTS minimum.

    Mixed queries like "李 Coupa" stay on the FTS path so the long token can
    still do work — losing the literal-char benefit for the short token is
    less harmful than disabling FTS entirely on the long one.
    """
    tokens = re.findall(r"[一-鿿]+|[A-Za-z0-9]+", query_text or "")
    if not tokens:
        return False
    return all(len(t) < _TRIGRAM_MIN_TOKEN_LEN for t in tokens)


def _build_fts_query(query_text: str) -> str:
    """
    Build a safe FTS5 MATCH expression from a user query.

    The trigram tokenizer treats every character run as searchable, so we
    just need to keep the user's tokens together (each quoted to avoid
    treating reserved characters as FTS syntax) and OR them so any token
    can hit.
    """
    tokens = re.findall(r"[一-鿿]+|[A-Za-z0-9]+", query_text)
    tokens = [t for t in tokens if t]
    if not tokens:
        return ""
    quoted = [f'"{t}"' for t in tokens]
    return " OR ".join(quoted)


def _rrf_fuse(rankings: list[dict[uuid.UUID, int]], k: int = _RRF_K) -> dict[uuid.UUID, float]:
    """Reciprocal Rank Fusion. `rankings[i][cid]` is the 0-indexed rank of cid in retriever i."""
    fused: dict[uuid.UUID, float] = {}
    for ranking in rankings:
        for cid, rank in ranking.items():
            fused[cid] = fused.get(cid, 0.0) + 1.0 / (k + rank + 1)
    return fused


def _scale_to_100(scores: dict[uuid.UUID, float]) -> dict[uuid.UUID, float]:
    """Min-max scale the fused scores into [0, 100] for the UI."""
    if not scores:
        return {}
    values = list(scores.values())
    lo, hi = min(values), max(values)
    if hi - lo < 1e-9:
        return {cid: 75.0 for cid in scores}
    return {cid: (v - lo) / (hi - lo) * 100.0 for cid, v in scores.items()}


class SearchService:
    def __init__(self):
        self.embedding_svc = EmbeddingService()

    async def hybrid_search(
        self,
        db: AsyncSession,
        request: CandidateSearchRequest,
        project_id: uuid.UUID | None = None,
    ) -> list[CandidateSearchResult]:
        # 1. Identifier short-circuit — exact key lookup, skip vector + FTS.
        if request.query:
            identifier = detect_identifier(request.query)
            if identifier:
                return await self._identifier_search(db, identifier, request)

        # 2. Hard SQL filter (returns the set of IDs that pass every filter).
        sql_ids = await self._sql_filter(db, request)

        has_query = bool(request.query and request.query.strip())

        # 2b. Short-query path. Trigram FTS can't generate tokens for queries
        # under 3 chars, and pure vector retrieval misranks literal-character
        # intent on tiny libraries (the embedding model puts cross-lingual
        # surname matches above same-character matches). SQL ILIKE on the
        # identifying columns is what the user actually meant.
        if has_query and _is_all_short_query(request.query):
            return await self._short_query_search(db, request, sql_ids)

        # 3. Retrieval pass: FTS BM25 + vector, in parallel.
        fts_ranking: dict[uuid.UUID, int] = {}
        vector_ranking: dict[uuid.UUID, int] = {}
        vector_distances: dict[uuid.UUID, float] = {}

        if has_query:
            fts_task = asyncio.create_task(self._fts_search(db, request.query, _RETRIEVAL_LIMIT))
            vec_task = asyncio.create_task(self._vector_search(request.query, _RETRIEVAL_LIMIT))
            fts_ranking, vector_distances = await fts_task, {}
            vector_distances = await vec_task
            # Convert vector distances to a rank dict (lower distance = better rank).
            sorted_cids = sorted(vector_distances.keys(), key=lambda c: vector_distances[c])
            vector_ranking = {cid: i for i, cid in enumerate(sorted_cids)}

        # 4. Semantic exclusion.
        exclude_ids: set[uuid.UUID] = set()
        if request.exclude_query:
            exclude_dist = await self._raw_vector_distances(request.exclude_query, _RETRIEVAL_LIMIT * 2)
            exclude_ids = {cid for cid, d in exclude_dist.items() if d < _EXCLUDE_SIM_THRESHOLD}

        # 5. Combine rankings.
        if has_query:
            fused = _rrf_fuse([fts_ranking, vector_ranking])
            # Apply hard SQL filter. If no SQL filter was supplied (sql_ids is
            # the universe), this intersect is a no-op anyway.
            if self._has_active_filters(request):
                fused = {cid: s for cid, s in fused.items() if cid in sql_ids}
            all_ids = set(fused.keys()) - exclude_ids
            scaled = _scale_to_100({cid: fused[cid] for cid in all_ids})
        else:
            # No query text — list passes through SQL only, ordered by recency.
            return await self._sql_only_listing(db, request, exclude_ids)

        if not scaled:
            return []

        # 6. Fetch candidate rows and assemble results.
        result = await db.execute(select(Candidate).where(Candidate.id.in_(scaled.keys())))
        candidates_map = {c.id: c for c in result.scalars().all()}

        search_results: list[CandidateSearchResult] = []
        for cid, candidate in candidates_map.items():
            sql_matched = cid in sql_ids
            fts_matched = cid in fts_ranking
            vector_dist = vector_distances.get(cid)
            score = scaled.get(cid, 0.0)
            if sql_matched and self._has_active_filters(request):
                score = min(100.0, score + _SQL_FILTER_BONUS)
            search_results.append(
                CandidateSearchResult(
                    candidate=CandidateResponse.model_validate(candidate),
                    sql_matched=sql_matched,
                    fts_matched=fts_matched,
                    vector_score=vector_dist,
                    combined_score=round(score, 2),
                )
            )

        search_results.sort(key=lambda r: r.combined_score, reverse=True)
        return search_results[request.offset : request.offset + request.limit]

    # ── Identifier path ────────────────────────────────────────────────────

    async def _identifier_search(
        self,
        db: AsyncSession,
        identifier: Identifier,
        request: CandidateSearchRequest,
    ) -> list[CandidateSearchResult]:
        col_map = {
            "phone": Candidate.phone,
            "email": Candidate.email,
            "linkedin_url": Candidate.linkedin_url,
            "liepin_url": Candidate.liepin_url,
        }
        col = col_map[identifier.kind]
        result = await db.execute(
            select(Candidate)
            .where(or_(col == identifier.value, col.ilike(f"%{identifier.value}%")))
            .limit(request.limit)
        )
        return [
            CandidateSearchResult(
                candidate=CandidateResponse.model_validate(c),
                sql_matched=True,
                fts_matched=False,
                vector_score=None,
                combined_score=100.0,
            )
            for c in result.scalars().all()
        ]

    async def _short_query_search(
        self,
        db: AsyncSession,
        request: CandidateSearchRequest,
        sql_ids: set[uuid.UUID],
    ) -> list[CandidateSearchResult]:
        """
        SQL ILIKE substring match across name / title / company / phone / email.

        Used for queries too short for the trigram FTS tokenizer. Results are
        tiered by where the match landed so an exact-name hit beats a buried
        title substring even though they're both "contains" matches.
        """
        q = request.query.strip()
        needle = f"%{q}%"
        result = await db.execute(
            select(Candidate).where(
                or_(
                    Candidate.full_name.ilike(needle),
                    Candidate.current_title.ilike(needle),
                    Candidate.current_company.ilike(needle),
                    Candidate.phone.ilike(needle),
                    Candidate.email.ilike(needle),
                )
            )
        )
        candidates = list(result.scalars().all())

        # Honour hard filters if any are set.
        if self._has_active_filters(request):
            candidates = [c for c in candidates if c.id in sql_ids]

        ql = q.lower()

        def score_for(c: Candidate) -> float:
            """Higher = better. Tiered by where the match landed."""
            name = (c.full_name or "").lower()
            if name == ql:
                return 100.0
            if name.startswith(ql) or ql in name:
                # Subscore by position so '李' in '李华' beats '李' in '王李'
                # (the rest comes later: name length tiebreaker).
                idx = name.find(ql)
                return 90.0 - min(idx, 10) * 1.5
            # Match must have landed in title/company/phone/email.
            return 60.0

        scored = sorted(
            ((c, score_for(c)) for c in candidates),
            key=lambda pair: pair[1],
            reverse=True,
        )
        return [
            CandidateSearchResult(
                candidate=CandidateResponse.model_validate(c),
                sql_matched=True,
                fts_matched=False,
                vector_score=None,
                combined_score=round(score, 2),
            )
            for c, score in scored[request.offset : request.offset + request.limit]
        ]

    # ── Retrieval primitives ───────────────────────────────────────────────

    def _has_active_filters(self, request: CandidateSearchRequest) -> bool:
        return any(
            v not in (None, "", [], {})
            for v in (
                request.location,
                request.min_years_experience,
                request.max_years_experience,
                request.current_company,
                request.source_platform,
                request.schools,
                request.exclude_companies,
                request.exclude_locations,
            )
        )

    async def _sql_filter(self, db: AsyncSession, request: CandidateSearchRequest) -> set[uuid.UUID]:
        """Return the set of IDs that pass every hard filter (empty filters = all candidates)."""
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
        if request.schools:
            query = query.where(Candidate.school_canonical.in_(request.schools))
        if request.exclude_companies:
            for company in request.exclude_companies:
                query = query.where(
                    or_(Candidate.current_company.is_(None), ~Candidate.current_company.ilike(f"%{company}%"))
                )
        if request.exclude_locations:
            for loc in request.exclude_locations:
                query = query.where(
                    or_(Candidate.location.is_(None), ~Candidate.location.ilike(f"%{loc}%"))
                )

        result = await db.execute(query)
        return {row[0] for row in result.fetchall()}

    async def _sql_only_listing(
        self,
        db: AsyncSession,
        request: CandidateSearchRequest,
        exclude_ids: set[uuid.UUID],
    ) -> list[CandidateSearchResult]:
        """Filter-only listing (no free-text query). Ordered by recency."""
        query = select(Candidate)
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
        if request.schools:
            query = query.where(Candidate.school_canonical.in_(request.schools))
        if request.exclude_companies:
            for company in request.exclude_companies:
                query = query.where(
                    or_(Candidate.current_company.is_(None), ~Candidate.current_company.ilike(f"%{company}%"))
                )
        if request.exclude_locations:
            for loc in request.exclude_locations:
                query = query.where(
                    or_(Candidate.location.is_(None), ~Candidate.location.ilike(f"%{loc}%"))
                )

        query = query.order_by(Candidate.created_at.desc()).offset(request.offset).limit(request.limit)
        rows = (await db.execute(query)).scalars().all()
        return [
            CandidateSearchResult(
                candidate=CandidateResponse.model_validate(c),
                sql_matched=True,
                fts_matched=False,
                vector_score=None,
                combined_score=50.0,
            )
            for c in rows
            if c.id not in exclude_ids
        ]

    async def _fts_search(
        self, db: AsyncSession, query_text: str, limit: int
    ) -> dict[uuid.UUID, int]:
        fts_query = _build_fts_query(query_text)
        if not fts_query:
            return {}
        sql = text(
            """
            SELECT candidate_id, bm25(candidates_fts) AS score
            FROM candidates_fts
            WHERE candidates_fts MATCH :q
            ORDER BY score ASC
            LIMIT :limit
            """
        )
        result = await db.execute(sql, {"q": fts_query, "limit": limit})
        ranking: dict[uuid.UUID, int] = {}
        for rank, row in enumerate(result.fetchall()):
            try:
                cid = uuid.UUID(row[0])
            except (TypeError, ValueError):
                continue
            ranking[cid] = rank
        return ranking

    async def _vector_search(self, query_text: str, limit: int) -> dict[uuid.UUID, float]:
        """Vector search across chunks, grouped back to candidate by min distance."""
        return await self._raw_vector_distances(query_text, limit)

    async def _raw_vector_distances(
        self, query_text: str, limit: int
    ) -> dict[uuid.UUID, float]:
        query_embedding = await self.embedding_svc.get_embedding(query_text)
        # Over-fetch because multiple chunks share a candidate_id.
        rows = vector_search(get_candidate_table(), query_embedding, limit=limit * 4)
        best: dict[uuid.UUID, float] = {}
        for r in rows:
            cid_raw = r.get("candidate_id") or r.get("id")
            try:
                cid = uuid.UUID(cid_raw)
            except (TypeError, ValueError):
                continue
            dist = float(r["_distance"])
            if dist > _VECTOR_MAX_DISTANCE:
                # Too far to be a meaningful match — drop instead of letting
                # RRF pull this candidate into the result as relative noise.
                continue
            if cid not in best or dist < best[cid]:
                best[cid] = dist
        items = sorted(best.items(), key=lambda kv: kv[1])[:limit]
        return dict(items)
