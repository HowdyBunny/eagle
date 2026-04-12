import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.skill_ontology import SkillOntology


async def create_ontology(db: AsyncSession, data: dict) -> SkillOntology:
    valid_columns = {c.key for c in SkillOntology.__table__.columns}
    filtered = {k: v for k, v in data.items() if k in valid_columns}
    entry = SkillOntology(**filtered)
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def get_ontology(db: AsyncSession, ontology_id: uuid.UUID) -> SkillOntology | None:
    result = await db.execute(select(SkillOntology).where(SkillOntology.id == ontology_id))
    return result.scalar_one_or_none()


async def list_ontology(
    db: AsyncSession, industry: str | None = None, skip: int = 0, limit: int = 50
) -> list[SkillOntology]:
    query = select(SkillOntology)
    if industry:
        query = query.where(SkillOntology.industry.ilike(f"%{industry}%"))
    query = query.order_by(SkillOntology.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())
