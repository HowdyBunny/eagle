import uuid

from openai import AsyncOpenAI

from app.config import settings
from app.services.chroma_service import (
    get_candidate_collection,
    get_industry_collection,
    get_requirement_collection,
)
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

    async def embed_candidate(self, candidate_id: uuid.UUID, experience_summary: str) -> None:
        try:
            embedding = await self.get_embedding(experience_summary)
            collection = get_candidate_collection()
            collection.upsert(
                ids=[str(candidate_id)],
                embeddings=[embedding],
                documents=[experience_summary],
                metadatas=[{"candidate_id": str(candidate_id), "embedding_model_version": self.model}],
            )
            logger.info(f"Embedded candidate {candidate_id}")
        except Exception as e:
            logger.error(f"Failed to embed candidate {candidate_id}: {e}")

    async def embed_requirement(self, project_id: uuid.UUID, requirement_text: str) -> None:
        try:
            embedding = await self.get_embedding(requirement_text)
            collection = get_requirement_collection()
            collection.upsert(
                ids=[str(project_id)],
                embeddings=[embedding],
                documents=[requirement_text],
                metadatas=[{"project_id": str(project_id), "embedding_model_version": self.model}],
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
        collection = get_industry_collection()
        collection.add(
            ids=[chunk_id],
            embeddings=[embedding],
            documents=[content_text],
            metadatas=[{"source_ontology_id": str(ontology_id), "embedding_model_version": self.model}],
        )
        logger.info(f"Embedded industry knowledge chunk for ontology {ontology_id}")
        return {"chunk_id": chunk_id, "source_ontology_id": str(ontology_id), "content_text": content_text}
