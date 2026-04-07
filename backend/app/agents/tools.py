"""
Tool definitions for the Coordinator Agent (CA) — OpenAI function-calling format.

These tools bridge the LLM's function calls to actual service layer operations.
"""

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.candidate import CandidateSearchRequest
from app.schemas.preference import PreferenceCreate
from app.schemas.project import ProjectCreate, ProjectUpdate
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
            "name": "create_project",
            "description": "Create a new headhunting project for a client. Use when the hunter explicitly wants to start a new project.",
            "parameters": {
                "type": "object",
                "properties": {
                    "client_name": {"type": "string", "description": "Name of the client company"},
                    "project_name": {"type": "string", "description": "Descriptive name for the project"},
                    "jd_raw": {"type": "string", "description": "Raw job description text from the client"},
                    "mode": {
                        "type": "string",
                        "enum": ["precise", "explore"],
                        "description": "precise: ask structured questions first; explore: search immediately and refine via feedback",
                    },
                },
                "required": ["client_name", "project_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "clarify_requirement",
            "description": "Update the project's requirement_profile with clarified structured requirements. Call after gathering enough info from the hunter.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {"type": "string", "description": "UUID of the project"},
                    "requirement_profile": {
                        "type": "object",
                        "description": "Structured requirement profile JSON with hard requirements (location, experience, salary) and soft requirements",
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
                    "topic": {"type": "string", "description": "Industry or topic to research (e.g. '储能行业', '大模型部署')"},
                    "additional_context": {"type": "string", "description": "Optional context about what specifically to focus on"},
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
                        "description": "Structured requirement profile JSON (hard + soft requirements)",
                    },
                },
                "required": ["project_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "change_project_context",
            "description": "Switch the active project context. Use when hunter mentions switching to a different project.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {"type": "string", "description": "UUID of the project to switch to"},
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

    async def execute(self, tool_name: str, arguments: dict) -> Any:
        handler = getattr(self, f"_handle_{tool_name}", None)
        if not handler:
            return {"error": f"Unknown tool: {tool_name}"}
        return await handler(**arguments)

    async def _handle_create_project(self, client_name: str, project_name: str, jd_raw: str | None = None, mode: str = "precise") -> dict:
        from app.models.project import ProjectMode
        # Guard: if the current project is a stub created by the frontend,
        # update it in place rather than creating a duplicate.
        if self.current_project_id:
            current = await project_service.get_project(self.db, self.current_project_id)
            if current and current.client_name == "待 CA 解析":
                data = ProjectUpdate(
                    client_name=client_name,
                    project_name=project_name,
                    jd_raw=jd_raw,
                )
                project = await project_service.update_project(self.db, self.current_project_id, data)
                return {"project_id": str(project.id), "project_name": project.project_name, "status": "updated_stub"}
        data = ProjectCreate(
            client_name=client_name,
            project_name=project_name,
            jd_raw=jd_raw,
            mode=ProjectMode(mode),
        )
        project = await project_service.create_project(self.db, data)
        return {"project_id": str(project.id), "project_name": project.project_name, "status": "created"}

    async def _handle_clarify_requirement(self, project_id: str, requirement_profile: dict | None = None) -> dict:
        if not requirement_profile:
            return {"error": "requirement_profile is required"}

        data = ProjectUpdate(requirement_profile=requirement_profile)
        project = await project_service.update_project(self.db, uuid.UUID(project_id), data)
        if not project:
            return {"error": f"Project {project_id} not found"}
        return {"project_id": project_id, "status": "requirement_updated"}

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
        from app.agents.evaluator import EvaluatorAgent
        agent = EvaluatorAgent(self.db)
        pc = await agent.evaluate(uuid.UUID(project_id), uuid.UUID(candidate_id))
        return {
            "project_id": project_id,
            "candidate_id": candidate_id,
            "match_score": pc.match_score,
            "status": "evaluation_complete",
        }

    async def _handle_request_industry_research(
        self, project_id: str, topic: str, additional_context: str | None = None
    ) -> dict:
        from app.agents.research import ResearchAgent
        agent = ResearchAgent(self.db)
        research = await agent.research(uuid.UUID(project_id), topic, additional_context)
        return {
            "project_id": project_id,
            "topic": topic,
            "research_id": str(research.id),
            "status": "research_complete",
        }

    async def _handle_update_preference(
        self,
        project_id: str,
        feedback_type: str,
        hunter_comment: str,
        candidate_id: str | None = None,
        weight_adjustment: dict | None = None,
    ) -> dict:
        data = PreferenceCreate(
            candidate_id=uuid.UUID(candidate_id) if candidate_id else None,
            feedback_type=feedback_type,
            hunter_comment=hunter_comment,
            weight_adjustment=weight_adjustment,
        )
        log = await preference_service.create_preference(self.db, uuid.UUID(project_id), data)
        return {"preference_id": str(log.id), "status": "preference_recorded"}

    async def _handle_update_project(
        self,
        project_id: str,
        client_name: str | None = None,
        project_name: str | None = None,
        requirement_profile: dict | None = None,
    ) -> dict:
        data = ProjectUpdate(
            client_name=client_name,
            project_name=project_name,
            requirement_profile=requirement_profile,
        )
        project = await project_service.update_project(self.db, uuid.UUID(project_id), data)
        if not project:
            return {"error": f"Project {project_id} not found"}
        return {
            "project_id": project_id,
            "client_name": project.client_name,
            "project_name": project.project_name,
            "status": "project_updated",
        }

    async def _handle_change_project_context(self, project_id: str) -> dict:
        project = await project_service.get_project(self.db, uuid.UUID(project_id))
        if not project:
            return {"error": f"Project {project_id} not found"}
        return {
            "project_id": project_id,
            "project_name": project.project_name,
            "status": "context_switched",
        }
