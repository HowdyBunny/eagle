import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PreferenceCreate(BaseModel):
    candidate_id: uuid.UUID | None = None
    feedback_type: str
    hunter_comment: str
    weight_adjustment: dict | None = None


class PreferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    candidate_id: uuid.UUID | None
    feedback_type: str
    hunter_comment: str
    weight_adjustment: dict | None
    created_at: datetime
