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

    def __init__(self, db: AsyncSession, ws: WebSocket, project_id: uuid.UUID):
        super().__init__(db, current_project_id=project_id)
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
            # Use resolved project_id from result (handles LLM passing garbage UUID)
            resolved_id = result.get("project_id") or arguments.get("project_id")
            if resolved_id:
                try:
                    project = await project_service.get_project(
                        self.db, uuid.UUID(str(resolved_id))
                    )
                    if project:
                        resp = ProjectResponse.model_validate(project)
                        await self._ws.send_json({
                            "type": "project_updated",
                            "project": json.loads(resp.model_dump_json()),
                        })
                except (ValueError, AttributeError):
                    pass

        return result


@router.websocket("/projects/bootstrap")
async def bootstrap_project(ws: WebSocket):
    await ws.accept()

    try:
        # 1. Receive initial payload
        raw = await ws.receive_json()
        message: str = raw.get("message", "")
        mode: str = raw.get("mode", "precise")

        if not message.strip():
            await ws.send_json({"type": "error", "message": "消息不能为空"})
            await ws.close()
            return

        # 2. Create stub project
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
            executor = WsToolExecutor(db, ws, project.id)

            # Build system prompt with project context (same as CoordinatorAgent.chat)
            from app.agents.coordinator import CA_SYSTEM_PROMPT

            project_context = (
                f"\n\n## 当前项目\n- 项目ID: {project.id}\n- 客户: {project.client_name}"
                f"\n- 项目名: {project.project_name}\n- 模式: {project.mode.value}"
                f"\n- 状态: {project.status.value}"
                f"\n\n**[系统指令] 当前项目是占位项目（client_name='待 CA 解析'）。"
                f"你的第一个动作必须是调用 `update_project`（project_id={project.id}），"
                f"从猎头消息中提取真实客户名和岗位名后立即调用，不得跳过。**"
            )

            messages = [
                {"role": "system", "content": CA_SYSTEM_PROMPT + project_context},
                {"role": "user", "content": message},
            ]

            # Save user message
            await conversation_service.save_message(
                db, project.id, ConversationRole.HUNTER, message
            )

            await ws.send_json({"type": "status", "message": "CA 正在思考…需要花费时间去操作工具和检索回答，请耐心等待"})

            reply_text = ""
            actions_taken: list = []
            intent_json = None

            async for event in llm.agentic_loop_stream(messages, CA_TOOLS, executor):
                if event["type"] == "text":
                    await ws.send_json({"type": "text", "delta": event["delta"]})
                elif event["type"] == "tool_call":
                    # WsToolExecutor already sent this event; skip to avoid duplicate
                    pass
                elif event["type"] == "done":
                    reply_text = event["reply_text"]
                    actions_taken = event.get("actions_taken", [])
                    intent_json = event.get("intent_json")
                    break
                elif event["type"] == "error":
                    raise RuntimeError(event.get("message", "LLM streaming error"))

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
