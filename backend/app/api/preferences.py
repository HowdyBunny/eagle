import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import verify_api_key
from app.database import get_db
from app.schemas.preference import PreferenceCreate, PreferenceResponse
from app.services import project_service, preference_service

router = APIRouter(prefix="/projects", tags=["preferences"])


@router.post("/{project_id}/preferences", response_model=PreferenceResponse, status_code=status.HTTP_201_CREATED)
async def add_preference(
    project_id: uuid.UUID,
    data: PreferenceCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_api_key),
):
    project = await project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return await preference_service.create_preference(db, project_id, data)


@router.get("/{project_id}/preferences", response_model=list[PreferenceResponse])
async def list_preferences(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_api_key),
):
    project = await project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return await preference_service.list_preferences(db, project_id)
