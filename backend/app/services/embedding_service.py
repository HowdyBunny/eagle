import uuid
from typing import Any

from openai import AsyncOpenAI

from app.config import settings
from app.services.lancedb_service import (
    delete_candidate_chunks_async,
    get_candidate_table,
    get_industry_table,
    get_requirement_table,
    table_add_async,
    upsert_row_async,
)
from app.utils.logger import logger


def candidate_to_index_snapshot(candidate: Any) -> dict:
    """
    Capture an immutable snapshot of the fields used to build embedding
    chunks. Returning a plain dict means callers can hand it to a background
    task without worrying about ORM session lifetime.
    """
    return {
        "id": str(candidate.id),
        "full_name": candidate.full_name,
        "current_title": candidate.current_title,
        "current_company": candidate.current_company,
        "location": candidate.location,
        "years_experience": candidate.years_experience,
        "education": candidate.education,
        "experience_summary": candidate.experience_summary,
        "raw_structured_data": candidate.raw_structured_data,
    }


def build_candidate_chunks(snapshot: dict) -> list[dict]:
    """
    Break a candidate into retrievable chunks.

    Returns a list of {"type", "index", "document"}.  Empty list means there's
    nothing worth embedding (no name, no summary, no experiences).

    Chunking strategy:
      - One "profile" chunk: name + current role + location + years + education
        + experience_summary in a single document. This is the chunk most
        queries should hit because it covers identity + headline info.
      - One "experience" chunk per item in raw_structured_data.experiences.
        Each experience chunk is self-contained (carries the candidate name
        and current title as light context) so it makes sense when retrieved
        in isolation.

    At retrieval time the chunks are looked up independently and grouped back
    by candidate_id, taking the closest chunk's distance as the candidate's
    score. This means a candidate with deep relevant experience in a single
    past role wins over one with a vague summary mentioning the same term.
    """
    chunks: list[dict] = []

    profile_lines: list[str] = []
    if snapshot.get("full_name"):
        profile_lines.append(f"姓名: {snapshot['full_name']}")
    current_title = snapshot.get("current_title")
    current_company = snapshot.get("current_company")
    if current_title or current_company:
        company = current_company or "—"
        title = current_title or "—"
        profile_lines.append(f"现任: {company} / {title}")
    if snapshot.get("location"):
        profile_lines.append(f"地点: {snapshot['location']}")
    if snapshot.get("years_experience") is not None:
        profile_lines.append(f"经验: {snapshot['years_experience']}年")
    if snapshot.get("education"):
        profile_lines.append(f"教育: {snapshot['education']}")
    if snapshot.get("experience_summary"):
        profile_lines.append(f"经验摘要: {snapshot['experience_summary']}")

    if profile_lines:
        chunks.append({
            "type": "profile",
            "index": 0,
            "document": "\n".join(profile_lines),
        })

    raw = snapshot.get("raw_structured_data") or {}
    experiences = raw.get("experiences") if isinstance(raw, dict) else None
    if isinstance(experiences, list):
        # Light identity context so an experience chunk retrieved alone still
        # makes sense to the embedding model.
        identity_bits: list[str] = []
        if snapshot.get("full_name"):
            identity_bits.append(snapshot["full_name"])
        if current_title:
            identity_bits.append(f"现任{current_title}")
        identity = " · ".join(identity_bits)

        for i, exp in enumerate(experiences):
            if not isinstance(exp, dict):
                continue
            title = (exp.get("title") or "").strip()
            company = (exp.get("company") or "").strip()
            duration = (exp.get("duration") or "").strip()
            description = (exp.get("description") or "").strip()

            body_lines: list[str] = []
            head = " / ".join(p for p in (company, title) if p)
            if head:
                body_lines.append(head)
            if duration:
                body_lines.append(f"时间: {duration}")
            if description:
                body_lines.append(f"职责: {description}")

            if not body_lines:
                continue

            document = "\n".join(body_lines)
            if identity:
                document = f"{identity}\n工作经历:\n{document}"
            chunks.append({"type": "experience", "index": i, "document": document})

    return chunks


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

    async def get_embeddings_batch(self, texts: list[str]) -> list[list[float]]:
        """Single API call for a batch of texts. Order is preserved."""
        if not texts:
            return []
        client = self._get_client()
        response = await client.embeddings.create(
            input=texts,
            model=settings.EMBEDDING_MODEL,
        )
        # OpenAI guarantees `data` order matches input order but we double-check via index.
        ordered = sorted(response.data, key=lambda d: d.index)
        return [d.embedding for d in ordered]

    async def embed_candidate(self, snapshot: dict) -> None:
        """
        Replace all chunks for a candidate with freshly embedded ones.

        Idempotent: deletes the candidate's existing chunks first so re-running
        after a profile edit doesn't leave stale fragments behind.
        """
        candidate_id = str(snapshot["id"])
        chunks = build_candidate_chunks(snapshot)
        try:
            await delete_candidate_chunks_async(get_candidate_table(), candidate_id)
            if not chunks:
                return
            documents = [c["document"] for c in chunks]
            vectors = await self.get_embeddings_batch(documents)
            rows = [
                {
                    "id": str(uuid.uuid4()),
                    "candidate_id": candidate_id,
                    "chunk_type": c["type"],
                    "chunk_index": c["index"],
                    "vector": vec,
                    "document": c["document"],
                    "embedding_model_version": settings.EMBEDDING_MODEL,
                }
                for c, vec in zip(chunks, vectors)
            ]
            await table_add_async(get_candidate_table(), rows)
            logger.info(f"Embedded candidate {candidate_id} with {len(rows)} chunks")
        except Exception as e:
            logger.error(f"Failed to embed candidate {candidate_id}: {e}")

    async def embed_requirement(self, project_id: uuid.UUID, requirement_text: str) -> None:
        try:
            embedding = await self.get_embedding(requirement_text)
            await upsert_row_async(
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
    ) -> dict | None:
        try:
            chunk_id = str(uuid.uuid4())
            embedding = await self.get_embedding(content_text)
            await table_add_async(
                get_industry_table(),
                [
                    {
                        "id": chunk_id,
                        "vector": embedding,
                        "document": content_text,
                        "source_ontology_id": str(ontology_id),
                        "embedding_model_version": settings.EMBEDDING_MODEL,
                    }
                ],
            )
            logger.info(f"Embedded industry knowledge chunk for ontology {ontology_id}")
            return {"chunk_id": chunk_id, "source_ontology_id": str(ontology_id), "content_text": content_text}
        except Exception as e:
            logger.error(f"Failed to embed industry chunk for ontology {ontology_id}: {e}")
            return None
