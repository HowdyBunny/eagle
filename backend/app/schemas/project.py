import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.project import ProjectMode, ProjectStatus


class ProjectCreate(BaseModel):
    client_name: str
    project_name: str
    jd_raw: str | None = None
    requirement_profile: dict | None = None
    mode: ProjectMode = ProjectMode.PRECISE


class ProjectUpdate(BaseModel):
    client_name: str | None = None
    project_name: str | None = None
    jd_raw: str | None = None
    requirement_profile: dict | None = None
    mode: ProjectMode | None = None
    status: ProjectStatus | None = None


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_name: str
    project_name: str
    jd_raw: str | None
    requirement_profile: dict | None
    mode: ProjectMode
    status: ProjectStatus
    folder_path: str | None
    created_at: datetime
    updated_at: datetime
