import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CandidateCreate(BaseModel):
    full_name: str
    current_title: str | None = None
    current_company: str | None = None
    location: str | None = None
    years_experience: float | None = None
    salary_range: str | None = None
    education: str | None = None
    linkedin_url: str | None = None
    liepin_url: str | None = None
    phone: str | None = None
    email: str | None = None
    raw_structured_data: dict | None = None
    experience_summary: str | None = None
    source_platform: str | None = None


class CandidateUpdate(BaseModel):
    full_name: str | None = None
    current_title: str | None = None
    current_company: str | None = None
    location: str | None = None
    years_experience: float | None = None
    salary_range: str | None = None
    education: str | None = None
    linkedin_url: str | None = None
    liepin_url: str | None = None
    phone: str | None = None
    email: str | None = None
    raw_structured_data: dict | None = None
    experience_summary: str | None = None


class CandidateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    current_title: str | None
    current_company: str | None
    location: str | None
    years_experience: float | None
    salary_range: str | None
    education: str | None
    school_canonical: str | None = None
    linkedin_url: str | None
    liepin_url: str | None
    phone: str | None
    email: str | None
    experience_summary: str | None
    raw_structured_data: dict | None
    confidence_score: float | None
    source_platform: str | None
    created_at: datetime
    updated_at: datetime


class CandidateSearchRequest(BaseModel):
    query: str | None = None  # Semantic search text (will be embedded)
    location: str | None = None
    min_years_experience: float | None = None
    max_years_experience: float | None = None
    current_company: str | None = None
    source_platform: str | None = None
    schools: list[str] | None = None  # Exact-match on canonical school slugs (e.g. ["tsinghua", "stanford"])
    limit: int = 20
    offset: int = 0
    # Exclusion filters
    exclude_query: str | None = None        # Semantic: exclude candidates whose experience matches this description
    exclude_companies: list[str] | None = None  # SQL: exclude candidates currently at these companies
    exclude_locations: list[str] | None = None  # SQL: exclude candidates in these locations


class CandidateSearchResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    candidate: CandidateResponse
    sql_matched: bool = False
    fts_matched: bool = False
    vector_score: float | None = None  # Cosine distance from LanceDB (lower = more similar, range 0-2)
    combined_score: float = 0.0        # Final ranking score 0-100 (higher = better match)
    # Score: Reciprocal Rank Fusion of BM25 (FTS5) and vector rankings, then
    # min-max scaled into the [0, 100] range across the current result set. A
    # small bonus is added when the candidate also satisfies every hard SQL
    # filter so multi-signal hits still rank above one-signal hits.
