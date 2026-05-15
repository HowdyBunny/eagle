from pydantic import BaseModel

from app.schemas.candidate import CandidateResponse


class ExperienceItem(BaseModel):
    title: str | None = None
    company: str | None = None
    duration: str | None = None
    description: str | None = None


class ParsedCandidateData(BaseModel):
    full_name: str | None = None
    current_title: str | None = None
    current_company: str | None = None
    location: str | None = None
    years_experience: float | None = None
    salary_range: str | None = None
    education: str | None = None
    phone: str | None = None
    email: str | None = None
    experience_summary: str | None = None
    experiences: list[ExperienceItem] | None = None


class DuplicateConflict(BaseModel):
    existing_candidate: CandidateResponse
    match_reason: str  # "phone" | "email" | "name_company"


class ParseResult(BaseModel):
    parsed_data: ParsedCandidateData
    conflicts: list[DuplicateConflict] = []


class ParseResponse(BaseModel):
    results: list[ParseResult]
    error: str | None = None


class ParseTextRequest(BaseModel):
    text: str


class ConfirmCandidateItem(BaseModel):
    parsed_data: ParsedCandidateData
    action: str  # "create" | "skip" | "overwrite"
    existing_id: str | None = None
    source_platform: str = "manual_import"


class ConfirmImportRequest(BaseModel):
    candidates: list[ConfirmCandidateItem]


class ConfirmImportResponse(BaseModel):
    created: int = 0
    updated: int = 0
    skipped: int = 0


class ExtractDocResponse(BaseModel):
    text: str
    filename: str
