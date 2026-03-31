import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import verify_api_key
from app.database import get_db
from app.schemas.conversation import ChatRequest, ChatResponse, ConversationLogResponse
from app.services import project_service, conversation_service

router = APIRouter(prefix="/projects", tags=["conversations"])


@router.post("/{project_id}/chat", response_model=ChatResponse)
async def chat(
    project_id: uuid.UUID,
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_api_key),
):
    project = await project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    from app.agents.coordinator import CoordinatorAgent
    agent = CoordinatorAgent(db)
    return await agent.chat(project_id, request.message)


@router.get("/{project_id}/conversations", response_model=list[ConversationLogResponse])
async def list_conversations(
    project_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_api_key),
):
    project = await project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return await conversation_service.list_conversations(db, project_id, skip=skip, limit=limit)
