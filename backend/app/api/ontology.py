import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.ontology import OntologyResponse
from app.services import ontology_service

router = APIRouter(prefix="/ontology", tags=["ontology"])


@router.get("", response_model=list[OntologyResponse])
async def list_ontology(
    industry: str | None = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),

):
    return await ontology_service.list_ontology(db, industry=industry, skip=skip, limit=limit)


@router.get("/{ontology_id}", response_model=OntologyResponse)
async def get_ontology(
    ontology_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),

):
    entry = await ontology_service.get_ontology(db, ontology_id)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ontology entry not found")
    return entry
