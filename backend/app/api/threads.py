import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services import project_service, thread_service

router = APIRouter(prefix="/projects", tags=["threads"])


class ThreadCreate(BaseModel):
    name: str = "新对话"


class ThreadRename(BaseModel):
    name: str


class ThreadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID | None
    project_id: uuid.UUID
    name: str
    created_at: str
    is_legacy: bool = False


@router.post("/{project_id}/threads", response_model=ThreadResponse, status_code=status.HTTP_201_CREATED)
async def create_thread(
    project_id: uuid.UUID,
    body: ThreadCreate,
    db: AsyncSession = Depends(get_db),
):
    project = await project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    thread = await thread_service.create_thread(db, project_id, body.name)
    return ThreadResponse(
        id=thread.id,
        project_id=thread.project_id,
        name=thread.name,
        created_at=thread.created_at.isoformat(),
    )


@router.get("/{project_id}/threads", response_model=list[ThreadResponse])
async def list_threads(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    project = await project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    threads = await thread_service.list_threads(db, project_id)
    result = [
        ThreadResponse(id=t.id, project_id=t.project_id, name=t.name, created_at=t.created_at.isoformat())
        for t in threads
    ]
    # Append a synthetic "初始对话" entry for messages that predate the thread feature
    if await thread_service.has_legacy_messages(db, project_id):
        result.append(ThreadResponse(
            id=None,
            project_id=project_id,
            name="初始对话",
            created_at="1970-01-01T00:00:00",
            is_legacy=True,
        ))
    return result


@router.patch("/{project_id}/threads/{thread_id}", response_model=ThreadResponse)
async def rename_thread(
    project_id: uuid.UUID,
    thread_id: uuid.UUID,
    body: ThreadRename,
    db: AsyncSession = Depends(get_db),
):
    thread = await thread_service.rename_thread(db, thread_id, body.name)
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    return ThreadResponse(
        id=thread.id,
        project_id=thread.project_id,
        name=thread.name,
        created_at=thread.created_at.isoformat(),
    )


@router.delete("/{project_id}/threads/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_thread(
    project_id: uuid.UUID,
    thread_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    deleted = await thread_service.delete_thread(db, thread_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
