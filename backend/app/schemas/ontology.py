import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class OntologyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    industry: str
    concept: str
    synonyms: list | None
    tech_stack: list | None
    prerequisites: list | None
    key_positions: list | None
    skill_relations: dict | None
    jargon: dict | None
    created_at: datetime
    updated_at: datetime
