import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.conversation_log import ConversationRole


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    intent_json: dict | None = None
    actions_taken: list[str] = []


class ConversationLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    role: ConversationRole
    content: str
    intent_json: dict | None
    created_at: datetime
