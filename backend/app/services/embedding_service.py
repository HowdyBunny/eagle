import uuid

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.embedding import CandidateEmbedding, IndustryKnowledge, RequirementEmbedding
from app.utils.logger import logger


class EmbeddingService:
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.EMBEDDING_API_KEY,
            base_url=settings.EMBEDDING_BASE_URL,  # None = OpenAI official; include /v1 for compatible endpoints
        )
        self.model = settings.EMBEDDING_MODEL

    async def get_embedding(self, text: str) -> list[float]:
        response = await self.client.embeddings.create(
            input=text,
            model=self.model,
        )
        return response.data[0].embedding

    async def embed_candidate(self, db: AsyncSession, candidate_id: uuid.UUID, experience_summary: str) -> None:
        try:
            embedding = await self.get_embedding(experience_summary)

            # Upsert: check existing
            result = await db.execute(
                select(CandidateEmbedding).where(CandidateEmbedding.candidate_id == candidate_id)
            )
            existing = result.scalar_one_or_none()

            if existing:
                existing.embedding = embedding
                existing.embedding_model_version = self.model
            else:
                db.add(CandidateEmbedding(
                    candidate_id=candidate_id,
                    embedding=embedding,
                    embedding_model_version=self.model,
                ))
            await db.commit()
            logger.info(f"Embedded candidate {candidate_id}")
        except Exception as e:
            logger.error(f"Failed to embed candidate {candidate_id}: {e}")

    async def embed_requirement(self, db: AsyncSession, project_id: uuid.UUID, requirement_text: str) -> None:
        try:
            embedding = await self.get_embedding(requirement_text)

            result = await db.execute(
                select(RequirementEmbedding).where(RequirementEmbedding.project_id == project_id)
            )
            existing = result.scalar_one_or_none()

            if existing:
                existing.embedding = embedding
                existing.embedding_model_version = self.model
            else:
                db.add(RequirementEmbedding(
                    project_id=project_id,
                    embedding=embedding,
                    embedding_model_version=self.model,
                ))
            await db.commit()
            logger.info(f"Embedded requirement for project {project_id}")
        except Exception as e:
            logger.error(f"Failed to embed requirement for project {project_id}: {e}")

    async def embed_industry_chunk(
        self,
        db: AsyncSession,
        ontology_id: uuid.UUID,
        content_text: str,
    ) -> IndustryKnowledge:
        embedding = await self.get_embedding(content_text)
        chunk = IndustryKnowledge(
            source_ontology_id=ontology_id,
            content_text=content_text,
            embedding=embedding,
            embedding_model_version=self.model,
        )
        db.add(chunk)
        await db.commit()
        await db.refresh(chunk)
        logger.info(f"Embedded industry knowledge chunk for ontology {ontology_id}")
        return chunk
