"""
Evaluator Agent (EA)

Evaluates candidates against project requirements using multi-dimensional scoring.
Uses LLM for deep semantic analysis combined with:
- Project requirement profile
- Candidate data
- Hunter preference weights (from preference_logs)
- Industry knowledge context (from industry_knowledge via vector search)
"""

import json
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.project_candidate import ProjectCandidate
from app.services import candidate_service, evaluation_service, preference_service, project_service
from app.services.embedding_service import EmbeddingService
from app.services.llm_client import LLMClient
from app.utils.logger import logger

# TODO: Tune this evaluation prompt through testing with real candidates and projects
EA_SYSTEM_PROMPT = """你是 Eagle 系统的 Evaluator Agent（评估者）。
你的任务是对候选人进行多维度的深度评估，判断其与项目需求的匹配程度。

## 评估框架
请对候选人进行以下维度的评估，每个维度给出0-100的分数：
- **技能匹配**：技术栈、专业知识与岗位要求的吻合程度
- **经验年限**：工作年限是否符合要求
- **地点匹配**：工作地点是否符合要求
- **行业背景**：所在行业/公司与目标行业的相关程度
- **管理经验**：管理能力与岗位级别的匹配度（如适用）
- **薪资匹配**：期望薪资是否在客户预算内（如有信息）

## 输出格式
请严格按照以下JSON格式输出：
```json
{
  "match_score": <0-100的总体匹配分，加权平均>,
  "dimension_scores": {
    "技能匹配": <0-100>,
    "经验年限": <0-100>,
    "地点匹配": <0-100>,
    "行业背景": <0-100>,
    "管理经验": <0-100>,
    "薪资匹配": <0-100>
  },
  "recommendation": "<专业、简练、有说服力的推荐理由，适合发送给客户，100-200字>",
  "risk_flags": "<面试中需要深挖的风险点和注意事项，50-100字>"
}
```

## 权重调整
如果猎头有历史偏好记录，需要根据权重调整相应维度的重要性。
总体匹配分 = Σ(维度分 × 权重) / Σ权重

请只输出JSON，不要添加其他内容。
"""


class EvaluatorAgent:
    def __init__(self, db: AsyncSession):
        self.llm = LLMClient()
        self.db = db
        self.embedding_svc = EmbeddingService()

    async def evaluate(self, project_id: uuid.UUID, candidate_id: uuid.UUID) -> ProjectCandidate:
        try:
            # 1. Load project requirements
            project = await project_service.get_project(self.db, project_id)
            if not project:
                raise ValueError(f"Project {project_id} not found")

            # 2. Load candidate data
            candidate = await candidate_service.get_candidate(self.db, candidate_id)
            if not candidate:
                raise ValueError(f"Candidate {candidate_id} not found")

            # 3. Load hunter preference weights for this project
            weight_context = await preference_service.get_weight_context(self.db, project_id)

            # 4. Load relevant industry knowledge via vector search
            industry_context = await self._get_industry_context(project)

            # 5. Build evaluation prompt
            prompt = self._build_evaluation_prompt(project, candidate, weight_context, industry_context)

            # 6. Call LLM for evaluation
            reply_text = await self.llm.simple_chat([
                {"role": "system", "content": EA_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ])

            # 7. Parse JSON response
            reply_text = reply_text.strip()
            if reply_text.startswith("```"):
                reply_text = reply_text.split("```")[1]
                if reply_text.startswith("json"):
                    reply_text = reply_text[4:]
            evaluation = json.loads(reply_text)

            # 8. Save evaluation result
            pc = await evaluation_service.save_evaluation(
                db=self.db,
                project_id=project_id,
                candidate_id=candidate_id,
                match_score=float(evaluation["match_score"]),
                dimension_scores=evaluation["dimension_scores"],
                recommendation=evaluation["recommendation"],
                risk_flags=evaluation["risk_flags"],
            )
            logger.info(f"EA evaluated candidate {candidate_id} for project {project_id}: score={evaluation['match_score']}")
            return pc

        except Exception as e:
            logger.error(f"EA evaluation failed for {candidate_id} / {project_id}: {e}")
            raise

    def _build_evaluation_prompt(self, project, candidate, weight_context: dict, industry_context: str) -> str:
        requirement_str = json.dumps(project.requirement_profile or {}, ensure_ascii=False, indent=2)
        weight_str = json.dumps(weight_context, ensure_ascii=False) if weight_context else "无特殊权重调整"

        candidate_info = f"""
姓名: {candidate.full_name}
当前职位: {candidate.current_title or '未知'}
当前公司: {candidate.current_company or '未知'}
地点: {candidate.location or '未知'}
工作年限: {candidate.years_experience or '未知'} 年
期望薪资: {candidate.salary_range or '未知'}
教育背景: {candidate.education or '未知'}
工作经历摘要:
{candidate.experience_summary or '无详细描述'}
"""

        return f"""## 项目信息
客户: {project.client_name}
项目: {project.project_name}
职位描述: {project.jd_raw or '未提供'}
结构化需求: {requirement_str}

## 猎头权重偏好
{weight_str}

## 候选人信息
{candidate_info}

## 相关行业知识
{industry_context or '无相关行业知识'}

请对此候选人进行评估，严格按照JSON格式输出。"""

    async def _get_industry_context(self, project) -> str:
        if not project.requirement_profile:
            return ""
        try:
            query_text = f"{project.jd_raw or ''} {str(project.requirement_profile)}"
            query_embedding = await self.embedding_svc.get_embedding(query_text[:2000])

            stmt = text("""
                SELECT content_text, embedding <=> CAST(:query_vec AS vector) AS distance
                FROM industry_knowledge
                ORDER BY embedding <=> CAST(:query_vec AS vector)
                LIMIT 3
            """)
            result = await self.db.execute(stmt, {"query_vec": str(query_embedding)})
            rows = result.fetchall()
            if not rows:
                return ""
            return "\n\n".join(row.content_text for row in rows)
        except Exception as e:
            logger.warning(f"Failed to get industry context: {e}")
            return ""
