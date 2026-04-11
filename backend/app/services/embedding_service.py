import uuid

from openai import AsyncOpenAI

from app.config import settings
from app.services.lancedb_service import (
    get_candidate_table,
    get_industry_table,
    get_requirement_table,
    upsert_row,
)
from app.utils.logger import logger


class EmbeddingService:
    def _get_client(self) -> AsyncOpenAI:
        return AsyncOpenAI(
            api_key=settings.EMBEDDING_API_KEY,
            base_url=settings.EMBEDDING_BASE_URL,
        )

    async def get_embedding(self, text: str) -> list[float]:
        client = self._get_client()
        response = await client.embeddings.create(
            input=text,
            model=settings.EMBEDDING_MODEL,
        )
        return response.data[0].embedding

    async def embed_candidate(self, candidate_id: uuid.UUID, experience_summary: str) -> None:
        try:
            embedding = await self.get_embedding(experience_summary)
            upsert_row(
                get_candidate_table(),
                {
                    "id": str(candidate_id),
                    "vector": embedding,
                    "document": experience_summary,
                    "embedding_model_version": settings.EMBEDDING_MODEL,
                },
            )
            logger.info(f"Embedded candidate {candidate_id}")
        except Exception as e:
            logger.error(f"Failed to embed candidate {candidate_id}: {e}")

    async def embed_requirement(self, project_id: uuid.UUID, requirement_text: str) -> None:
        try:
            embedding = await self.get_embedding(requirement_text)
            upsert_row(
                get_requirement_table(),
                {
                    "id": str(project_id),
                    "vector": embedding,
                    "document": requirement_text,
                    "embedding_model_version": settings.EMBEDDING_MODEL,
                },
            )
            logger.info(f"Embedded requirement for project {project_id}")
        except Exception as e:
            logger.error(f"Failed to embed requirement for project {project_id}: {e}")

    async def embed_industry_chunk(
        self,
        ontology_id: uuid.UUID,
        content_text: str,
    ) -> dict:
        chunk_id = str(uuid.uuid4())
        embedding = await self.get_embedding(content_text)
        get_industry_table().add(
            [
                {
                    "id": chunk_id,
                    "vector": embedding,
                    "document": content_text,
                    "source_ontology_id": str(ontology_id),
                    "embedding_model_version": settings.EMBEDDING_MODEL,
                }
            ]
        )
        logger.info(f"Embedded industry knowledge chunk for ontology {ontology_id}")
        return {"chunk_id": chunk_id, "source_ontology_id": str(ontology_id), "content_text": content_text}
