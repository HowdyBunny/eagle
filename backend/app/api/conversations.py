import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
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


@router.post("/{project_id}/chat/stream")
async def chat_stream(
    project_id: uuid.UUID,
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_api_key),
):
    """
    SSE streaming version of /chat.

    Each event is a JSON line in the format:
      data: {"type": "tool_call", "name": "...", "label": "..."}\n\n
      data: {"type": "text",      "delta": "..."}\n\n
      data: {"type": "done",      "reply_text": "...", "actions_taken": [...],
             "intent_json": {...}, "conversation_id": "..."}\n\n
      data: {"type": "error",     "message": "..."}\n\n
    """
    project = await project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    from app.agents.coordinator import CoordinatorAgent

    async def event_generator():
        agent = CoordinatorAgent(db)
        try:
            async for event in agent.chat_stream(project_id, request.message):
                yield f"data: {json.dumps(event, ensure_ascii=False, default=str)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


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
