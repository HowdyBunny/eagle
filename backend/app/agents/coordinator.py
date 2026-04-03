"""
Coordinator Agent (CA)

Two-layer architecture:
- Dialogue layer: LLM handles hunter interaction, intent recognition, requirement clarification
- Orchestration layer: Tool use loop executes actions and manages state
"""

import json
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.tools import CA_TOOLS, ToolExecutor
from app.models.conversation_log import ConversationRole
from app.schemas.conversation import ChatResponse
from app.services import conversation_service, project_service
from app.services.llm_client import LLMClient
from app.utils.logger import logger

# TODO: Tune this system prompt through real-world testing with hunters
CA_SYSTEM_PROMPT = """你是 Eagle 系统的 Coordinator Agent（协调者），一个专为猎头设计的智能 AI 助手。

## 你的角色
你帮助猎头（Hunter）完成人才搜寻工作，包括：
- 创建和管理招聘项目
- 理解需求并进行澄清
- 搜索人才库
- 触发候选人评估
- 记录猎头的偏好反馈
- 调研行业知识

## 工作模式
你有两种工作模式：
- **精准模式（precise）**：主导提问，用3-5个问题构建完整候选人画像再搜索。先问清硬性条件（地区、薪资、经验年限、学历）。
- **探索模式（explore）**：接受粗略需求，先搜索出初步结果，再通过猎头的"点赞/淘汰"行为学习偏好。

## 需求澄清原则
- 第一轮务必问清**硬性条件**：地区、薪资范围、经验年限
- 软性条件（行业背景、管理经验、文化适配）可以通过候选人反馈逐步精炼
- 猎头说"先搜索吧"时，立刻行动，不要继续追问
- 解读猎头的隐晦表达，例如"懂大模型部署"需要进一步确认深度

## 反馈解读
当猎头评价候选人时（例如"技术够了但管理经验太少"），你应该：
1. 调用 `update_preference` 记录这个偏好
2. 提取维度权重调整，例如 `{"管理经验": +15}`
3. 后续评估会自动纳入这些权重

## 工具使用规则
- 创建项目前确认基本信息已足够
- 搜索前确认有基本的搜索条件
- 触发评估前确认项目需求已有基本结构化信息
- 对话保持简洁专业，避免不必要的废话

当前项目上下文将在每次对话中提供。
"""


class CoordinatorAgent:
    def __init__(self, db: AsyncSession):
        self.llm = LLMClient()
        self.tool_executor = ToolExecutor(db)
        self.db = db

    async def chat(self, project_id: uuid.UUID, user_message: str) -> ChatResponse:
        # 1. Load project context
        project = await project_service.get_project(self.db, project_id)
        project_context = ""
        if project:
            project_context = f"\n\n## 当前项目\n- 项目ID: {project.id}\n- 客户: {project.client_name}\n- 项目名: {project.project_name}\n- 模式: {project.mode.value}\n- 状态: {project.status.value}"
            if project.requirement_profile:
                project_context += f"\n- 需求画像: {json.dumps(project.requirement_profile, ensure_ascii=False)}"

        # 2. Build messages
        messages: list[dict] = [
            {"role": "system", "content": CA_SYSTEM_PROMPT + project_context},
        ]

        # 3. Load conversation history
        history = await conversation_service.get_history(self.db, project_id, limit=20)
        for log in history:
            messages.append({
                "role": "user" if log.role == ConversationRole.HUNTER else "assistant",
                "content": log.content,
            })

        # 4. Add current message and persist
        messages.append({"role": "user", "content": user_message})
        await conversation_service.save_message(
            self.db, project_id, ConversationRole.HUNTER, user_message
        )

        # 5. Run agentic tool-use loop
        reply_text, actions_taken, intent_json = await self.llm.agentic_loop(
            messages, CA_TOOLS, self.tool_executor
        )

        # 6. Persist assistant reply
        await conversation_service.save_message(
            self.db, project_id, ConversationRole.ASSISTANT, reply_text, intent_json
        )

        return ChatResponse(
            reply=reply_text,
            intent_json=intent_json,
            actions_taken=actions_taken,
        )
