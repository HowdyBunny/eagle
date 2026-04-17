"""
Tool definitions for the Coordinator Agent (CA) — OpenAI function-calling format.

These tools bridge the LLM's function calls to actual service layer operations.
"""

import asyncio
import uuid
from typing import Any

# Keeps strong references to fire-and-forget tasks so they are not GC-collected
# before they complete (asyncio itself keeps references, but this is defensive).
_background_tasks: set[asyncio.Task] = set()

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.candidate import CandidateSearchRequest
from app.schemas.preference import PreferenceCreate
from app.schemas.project import ProjectUpdate
from app.services import (
    candidate_service,
    preference_service,
    project_service,
    evaluation_service,
)
from app.services.search_service import SearchService

# ──────────────────────────────────────────────
# OpenAI function-calling tool definitions
# ──────────────────────────────────────────────

CA_TOOLS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "clarify_requirement",
            "description": (
                "Save the structured requirement profile to the project. "
                "Call this as soon as you have enough info to fill the known fields — "
                "unknown/optional fields can be omitted or set to null. "
                "Do NOT wait until every field is confirmed before calling."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {"type": "string", "description": "UUID of the project"},
                    "requirement_profile": {
                        "type": "object",
                        "description": "Structured requirement profile. Fill what you know; omit unknown fields.",
                        "properties": {
                            "role_summary": {"type": "string", "description": "One-line summary of the role, e.g. '米哈游-开放世界游戏总制作人'"},
                            "location": {"type": "string", "description": "Work location(s), e.g. '上海/不限/可远程'"},
                            "min_years_experience": {"type": "number", "description": "Minimum years of relevant experience"},
                            "max_years_experience": {"type": "number", "description": "Maximum years of experience (optional)"},
                            "salary_range": {"type": "string", "description": "Salary range, e.g. '80万-120万+期权'"},
                            "education": {"type": "string", "description": "Minimum education requirement, e.g. '本科及以上'"},
                            "employment_type": {"type": "string", "description": "e.g. '全职', '兼职', '顾问'"},
                            "hard_requirements": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Non-negotiable must-have conditions as a list of strings",
                            },
                            "soft_requirements": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Nice-to-have or preferred conditions as a list of strings",
                            },
                            "industry_background": {"type": "string", "description": "Required industry or domain background"},
                            "team_size": {"type": "string", "description": "Expected team size to manage, e.g. '50-200人（含外包）'"},
                            "notes": {"type": "string", "description": "Any other important context or constraints"},
                        },
                    },
                },
                "required": ["project_id", "requirement_profile"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_talent_pool",
            "description": "Search the talent pool using hybrid search (SQL filter + semantic). Call when hunter wants to find candidates.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Semantic search query describing the ideal candidate"},
                    "location": {"type": "string", "description": "Filter by location"},
                    "min_years_experience": {"type": "number", "description": "Minimum years of experience"},
                    "max_years_experience": {"type": "number", "description": "Maximum years of experience"},
                    "current_company": {"type": "string", "description": "Filter by current company"},
                    "limit": {"type": "integer", "description": "Max results to return", "default": 10},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "trigger_evaluation",
            "description": "Trigger the Evaluator Agent to score a candidate against a project. Use after finding a promising candidate.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {"type": "string", "description": "UUID of the project"},
                    "candidate_id": {"type": "string", "description": "UUID of the candidate to evaluate"},
                },
                "required": ["project_id", "candidate_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "request_industry_research",
            "description": "Trigger the Research Agent to research an industry/topic and build knowledge base. Use when hunter asks about a new domain.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {"type": "string", "description": "UUID of the project"},
                    "topic": {"type": "string", "description": "Industry or role direction to research. Keep concise: industry + sub-field, e.g. '高端医疗影像设备（CT/MRI）研发' or '储能行业电池管理系统'"},
                    "additional_context": {"type": "string", "description": "Optional 1-2 sentence focus hint, e.g. '重点关注外资背景候选人的技能路径和关键岗位'. Do NOT paste full JDs or long requirement lists."},
                },
                "required": ["project_id", "topic"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_preference",
            "description": "Record hunter feedback and weight adjustments when hunter reacts to a candidate. Use to capture implicit preferences.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {"type": "string", "description": "UUID of the project"},
                    "candidate_id": {"type": "string", "description": "UUID of the candidate being commented on (optional)"},
                    "feedback_type": {
                        "type": "string",
                        "enum": ["weight_adjustment", "positive_signal", "negative_signal", "general"],
                    },
                    "hunter_comment": {"type": "string", "description": "Original hunter comment verbatim"},
                    "weight_adjustment": {
                        "type": "object",
                        "description": "Dimension weight changes, e.g. {'管理经验': 15, '技术深度': -5}",
                    },
                },
                "required": ["project_id", "feedback_type", "hunter_comment"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_project",
            "description": (
                "Update the current project's metadata. "
                "Use this as the FIRST action when the project's client_name is '待 CA 解析' — "
                "parse the hunter's message to extract real client name, project name, and "
                "requirement profile, then call this tool to replace the placeholders. "
                "Also use this when the hunter asks to modify project details."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {"type": "string", "description": "UUID of the project to update"},
                    "client_name": {"type": "string", "description": "Real client company name"},
                    "project_name": {"type": "string", "description": "Descriptive project name, e.g. '某公司-技术VP'"},
                    "requirement_profile": {
                        "type": "object",
                        "description": "Structured requirement profile JSON (hard + soft requirements). Use same schema as clarify_requirement.",
                        "properties": {
                            "role_summary": {"type": "string"},
                            "location": {"type": "string"},
                            "min_years_experience": {"type": "number"},
                            "salary_range": {"type": "string"},
                            "hard_requirements": {"type": "array", "items": {"type": "string"}},
                            "soft_requirements": {"type": "array", "items": {"type": "string"}},
                        },
                    },
                },
                "required": ["project_id"],
            },
        },
    },
]


# ──────────────────────────────────────────────
# Tool executor: bridges LLM calls → services
# ──────────────────────────────────────────────

class ToolExecutor:
    def __init__(self, db: AsyncSession, current_project_id: uuid.UUID | None = None):
        self.db = db
        self.current_project_id = current_project_id
        self.search_svc = SearchService()

    def _resolve_project_id(self, project_id: str | None) -> uuid.UUID | None:
        """Parse project_id from LLM, fall back to current_project_id on bad input."""
        if project_id:
            try:
                return uuid.UUID(str(project_id))
            except (ValueError, AttributeError):
                pass
        return self.current_project_id

    async def execute(self, tool_name: str, arguments: dict) -> Any:
        handler = getattr(self, f"_handle_{tool_name}", None)
        if not handler:
            return {"error": f"Unknown tool: {tool_name}"}
        return await handler(**arguments)

    async def _handle_clarify_requirement(self, project_id: str, requirement_profile: dict | None = None) -> dict:
        if not requirement_profile:
            return {"error": "requirement_profile is required"}

        resolved_id = self._resolve_project_id(project_id)
        if resolved_id is None:
            return {"error": "project_id is required"}

        data = ProjectUpdate(requirement_profile=requirement_profile)
        project = await project_service.update_project(self.db, resolved_id, data)
        if not project:
            return {"error": f"Project {project_id} not found"}

        # Re-embed the updated requirement profile so vector search stays current.
        from app.services.embedding_service import EmbeddingService
        import asyncio
        asyncio.create_task(
            EmbeddingService().embed_requirement(project.id, str(requirement_profile))
        )

        return {"project_id": str(resolved_id), "status": "requirement_updated"}

    async def _handle_search_talent_pool(
        self,
        query: str | None = None,
        location: str | None = None,
        min_years_experience: float | None = None,
        max_years_experience: float | None = None,
        current_company: str | None = None,
        limit: int = 10,
    ) -> dict:
        request = CandidateSearchRequest(
            query=query,
            location=location,
            min_years_experience=min_years_experience,
            max_years_experience=max_years_experience,
            current_company=current_company,
            limit=limit,
        )
        results = await self.search_svc.hybrid_search(self.db, request)
        return {
            "total": len(results),
            "candidates": [
                {
                    "candidate_id": str(r.candidate.id),
                    "full_name": r.candidate.full_name,
                    "current_title": r.candidate.current_title,
                    "current_company": r.candidate.current_company,
                    "location": r.candidate.location,
                    "years_experience": r.candidate.years_experience,
                    "confidence_score": r.candidate.confidence_score,
                    "vector_score": r.vector_score,
                }
                for r in results
            ],
        }

    async def _handle_trigger_evaluation(self, project_id: str, candidate_id: str) -> dict:
        resolved_id = self._resolve_project_id(project_id)
        if resolved_id is None:
            return {"error": "project_id is required"}
        try:
            cid = uuid.UUID(str(candidate_id))
        except (ValueError, AttributeError):
            return {"error": f"Invalid candidate_id: {candidate_id}"}
        from app.agents.evaluator import EvaluatorAgent
        agent = EvaluatorAgent(self.db)
        pc = await agent.evaluate(resolved_id, cid, trigger_source="ca")
        return {
            "project_id": str(resolved_id),
            "candidate_id": str(cid),
            "match_score": pc.match_score,
            "status": "evaluation_complete",
        }

    async def _handle_request_industry_research(
        self, project_id: str, topic: str, additional_context: str | None = None
    ) -> dict:
        resolved_id = self._resolve_project_id(project_id)
        if resolved_id is None:
            return {"error": "project_id is required"}

        # Fire-and-forget: RA runs in its own DB session so the CA stream
        # returns immediately instead of blocking for 20-120 s of web search.
        from app.database import async_session_maker
        from app.utils.logger import logger

        async def _run_ra():
            async with async_session_maker() as db:
                from app.agents.research import ResearchAgent
                agent = ResearchAgent(db)
                try:
                    await agent.research(resolved_id, topic, additional_context)
                except Exception:
                    logger.exception(
                        f"RA background task failed for project {resolved_id}, topic='{topic}'"
                    )

        task = asyncio.create_task(_run_ra())
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)

        return {
            "project_id": str(resolved_id),
            "topic": topic,
            "status": "research_triggered",
        }

    async def _handle_update_preference(
        self,
        project_id: str,
        feedback_type: str,
        hunter_comment: str,
        candidate_id: str | None = None,
        weight_adjustment: dict | None = None,
    ) -> dict:
        resolved_id = self._resolve_project_id(project_id)
        if resolved_id is None:
            return {"error": "project_id is required"}
        data = PreferenceCreate(
            candidate_id=uuid.UUID(str(candidate_id)) if candidate_id else None,
            feedback_type=feedback_type,
            hunter_comment=hunter_comment,
            weight_adjustment=weight_adjustment,
        )
        log = await preference_service.create_preference(self.db, resolved_id, data)
        return {"preference_id": str(log.id), "status": "preference_recorded"}

    async def _handle_update_project(
        self,
        project_id: str | None = None,
        client_name: str | None = None,
        project_name: str | None = None,
        requirement_profile: dict | None = None,
    ) -> dict:
        # Resolve project UUID: trust LLM value first, fallback to known current project
        resolved_id: uuid.UUID | None = None
        if project_id:
            try:
                resolved_id = uuid.UUID(project_id)
            except (ValueError, AttributeError):
                pass
        if resolved_id is None:
            resolved_id = self.current_project_id
        if resolved_id is None:
            return {"error": "project_id is required"}

        data = ProjectUpdate(
            client_name=client_name,
            project_name=project_name,
            requirement_profile=requirement_profile,
        )
        project = await project_service.update_project(self.db, resolved_id, data)
        if not project:
            return {"error": f"Project {resolved_id} not found"}
        return {
            "project_id": str(resolved_id),
            "client_name": project.client_name,
            "project_name": project.project_name,
            "status": "project_updated",
        }

