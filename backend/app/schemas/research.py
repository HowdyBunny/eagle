import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.ontology import OntologyResponse


class ResearchTriggerRequest(BaseModel):
    topic: str
    additional_context: str | None = None


class ResearchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    ontology_id: uuid.UUID
    report_file_path: str | None
    created_at: datetime
    ontology: OntologyResponse | None = None
