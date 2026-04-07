"""
WebSocket endpoint for project bootstrap flow.

Replaces the REST sequence (POST /projects → POST /chat) with a single
WebSocket connection that streams structured metadata events to the frontend,
giving real-time feedback during project creation.

Protocol (server → client JSON events):
  {type: "status",          message: str}            — transient progress indicator
  {type: "project_created", project: ProjectResponse} — stub project created
  {type: "project_updated", project: ProjectResponse} — CA filled in real metadata
  {type: "tool_call",       tool: str, args: list}    — CA called a tool (optional UI)
  {type: "ca_reply",        content: str, actions_taken: list, intent_json: dict|null}
  {type: "done"}
  {type: "error",           message: str}

Client → server (single JSON message after connect):
  {message: str, mode?: "precise"|"explore", api_key?: str}
"""

import json
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.tools import CA_TOOLS, ToolExecutor
from app.config import settings
from app.database import async_session_maker
from app.models.conversation_log import ConversationRole
from app.schemas.project import ProjectCreate, ProjectResponse
from app.services import conversation_service, project_service
from app.services.llm_client import LLMClient
from app.utils.logger import logger

router = APIRouter(tags=["websocket"])

PLACEHOLDER_CLIENT = "待 CA 解析"


def _derive_stub_name(text: str) -> str:
    line = text.split("\n")[0].strip()
    return (line[:40] + "…") if len(line) > 40 else (line or PLACEHOLDER_CLIENT)


class WsToolExecutor(ToolExecutor):
    """ToolExecutor subclass that pushes metadata events over WebSocket."""

    def __init__(self, db: AsyncSession, ws: WebSocket):
        super().__init__(db)
        self._ws = ws

    async def execute(self, tool_name: str, arguments: dict):
        # Notify client about tool call
        await self._ws.send_json({
            "type": "tool_call",
            "tool": tool_name,
            "args": list(arguments.keys()),
        })

        result = await super().execute(tool_name, arguments)

        # If CA just updated the project, push the refreshed project data
        if tool_name == "update_project" and "error" not in result:
            project_id = arguments.get("project_id")
            if project_id:
                project = await project_service.get_project(
                    self.db, uuid.UUID(project_id)
                )
                if project:
                    resp = ProjectResponse.model_validate(project)
                    await self._ws.send_json({
                        "type": "project_updated",
                        "project": json.loads(resp.model_dump_json()),
                    })

        return result


@router.websocket("/projects/bootstrap")
async def bootstrap_project(ws: WebSocket):
    await ws.accept()

    try:
        # 1. Receive initial payload
        raw = await ws.receive_json()
        message: str = raw.get("message", "")
        mode: str = raw.get("mode", "precise")
        api_key: str = raw.get("api_key", "") or ws.headers.get("x-api-key", "")

        if not message.strip():
            await ws.send_json({"type": "error", "message": "消息不能为空"})
            await ws.close()
            return

        # 2. Auth
        if api_key != settings.API_KEY:
            await ws.send_json({"type": "error", "message": "认证失败，请检查 API Key"})
            await ws.close()
            return

        # 3. Create stub project
        await ws.send_json({"type": "status", "message": "正在创建项目…"})

        async with async_session_maker() as db:
            from app.models.project import ProjectMode

            stub_data = ProjectCreate(
                client_name=PLACEHOLDER_CLIENT,
                project_name=_derive_stub_name(message),
                jd_raw=message,
                mode=ProjectMode(mode),
            )
            project = await project_service.create_project(db, stub_data)
            project_resp = ProjectResponse.model_validate(project)

            await ws.send_json({
                "type": "project_created",
                "project": json.loads(project_resp.model_dump_json()),
            })

            # 4. Run CA chat with WS-aware executor
            await ws.send_json({"type": "status", "message": "正在分析需求…"})

            llm = LLMClient()
            executor = WsToolExecutor(db, ws)

            # Build system prompt with project context (same as CoordinatorAgent.chat)
            from app.agents.coordinator import CA_SYSTEM_PROMPT

            project_context = (
                f"\n\n## 当前项目\n- 项目ID: {project.id}\n- 客户: {project.client_name}"
                f"\n- 项目名: {project.project_name}\n- 模式: {project.mode.value}"
                f"\n- 状态: {project.status.value}"
            )

            messages = [
                {"role": "system", "content": CA_SYSTEM_PROMPT + project_context},
                {"role": "user", "content": message},
            ]

            # Save user message
            await conversation_service.save_message(
                db, project.id, ConversationRole.HUNTER, message
            )

            await ws.send_json({"type": "status", "message": "CA 正在思考…"})

            reply_text, actions_taken, intent_json = await llm.agentic_loop(
                messages, CA_TOOLS, executor
            )

            # Save assistant reply
            await conversation_service.save_message(
                db, project.id, ConversationRole.ASSISTANT, reply_text, intent_json
            )

            # 5. Send final reply
            await ws.send_json({
                "type": "ca_reply",
                "content": reply_text,
                "actions_taken": actions_taken,
                "intent_json": intent_json,
            })

            await ws.send_json({"type": "done"})

    except WebSocketDisconnect:
        logger.info("WS bootstrap: client disconnected")
    except Exception as e:
        logger.error(f"WS bootstrap error: {e}")
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        try:
            await ws.close()
        except Exception:
            pass
