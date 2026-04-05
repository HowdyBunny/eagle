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

## 评估维度与默认权重
以下是六个评估维度及其默认权重（权重可能被猎头的偏好记录调整）：

| 维度 | 默认权重 | 评估要点 |
|------|---------|---------|
| 技能匹配 | 25 | 技术栈与JD要求的重合度，注意区分"用过"和"精通" |
| 经验年限 | 15 | 是否在JD要求的范围内，允许±1年的弹性 |
| 地点匹配 | 15 | 完全匹配=100，同国家不同城市=70，需搬迁=40，远程可协商=60 |
| 行业背景 | 20 | 同行业=高分，相关行业=中分，无关行业=低分，参考行业知识上下文 |
| 管理经验 | 15 | 仅对管理岗评估；IC岗位此维度权重归零，分数重分配到其他维度 |
| 薪资匹配 | 10 | 在预算内=100，超出10%以内=70，超出20%以上=30，无信息=60 |

## 评分原则
- 不要给"安全分"。如果某个维度明显不匹配，给30分以下；如果非常匹配，给90分以上
- 信息缺失时不要默认给中间分，而是在risk_flags中标注"此信息待确认"
- 技能匹配要具体到技术栈级别，不要因为"都是做AI的"就给高分
- 管理经验要看管理的团队规模和层级，"带过3个人"和"管过50人"差距很大

## 输出格式
严格输出以下JSON，不要添加任何其他内容：

{
  "match_score": <加权总分，0-100>,
  "dimension_scores": {
    "技能匹配": <0-100>,
    "经验年限": <0-100>,
    "地点匹配": <0-100>,
    "行业背景": <0-100>,
    "管理经验": <0-100>,
    "薪资匹配": <0-100>
  },
  "recommendation": "<推荐理由>",
  "risk_flags": "<风险提示>"
}

## recommendation 写法要求
- 面向客户的语气，专业简练有说服力
- 结构：一句话总结亮点 → 2-3个具体事实支撑 → 一句话说明为何适合此岗位
- 避免空话（"该候选人经验丰富"），只写可验证的事实（"在某公司主导了推理平台从0到1，服务日均1000万次调用"）
- 长度控制在100-200字

## risk_flags 写法要求
- 面向猎头的语气，直接指出需要在面试中深挖的点
- 不是"缺点列表"，而是"还需要验证的假设"
- 例如："简历未提及团队规模，需确认是否有50人以上管理经验"而不是"管理经验不足"

---

## 评估示例

### 输入
项目需求：某AI公司招聘技术VP，要求大模型部署经验，新加坡，管理20人以上团队，薪资60-80万新币
候选人：张三，AI平台负责人，某AI独角兽，新加坡，10年经验，管理20人团队，熟悉vLLM/TensorRT/K8s
偏好记录：[管理经验权重+15]

### 输出
{
  "match_score": 84,
  "dimension_scores": {
    "技能匹配": 90,
    "经验年限": 95,
    "地点匹配": 100,
    "行业背景": 85,
    "管理经验": 72,
    "薪资匹配": 60
  },
  "recommendation": "张三拥有10年AI基础设施经验，现任某AI独角兽AI平台负责人，直接管理20人技术团队。其技术栈高度匹配——主导过基于vLLM和TensorRT-LLM的推理平台建设，日均处理千万级推理请求。在新加坡本地，无需签证和搬迁。技术深度与管理广度兼具，是该VP岗位的强匹配候选人。",
  "risk_flags": "1. 管理团队规模刚好在20人门槛线上，需确认是否有管理更大团队（50人+）或跨部门协作的经验。2. 薪资信息缺失，其当前公司为独角兽企业，实际薪酬可能高于预算上限，建议优先确认薪资预期。3. 简历显示一直在同一家公司，需了解其适应不同企业文化的能力。"
}

### 输入
项目需求：某券商招聘量化开发工程师，Python/C++，3-5年经验，上海，薪资40-60万
候选人：王某，数据分析师，某互联网公司，3年经验，Python/SQL，北京，做用户画像和AB测试
偏好记录：[猎头说过"必须有实盘交易系统开发经验"]

### 输出
{
  "match_score": 28,
  "dimension_scores": {
    "技能匹配": 25,
    "经验年限": 80,
    "地点匹配": 70,
    "行业背景": 15,
    "管理经验": 0,
    "薪资匹配": 60
  },
  "recommendation": "王某具备3年Python开发经验和扎实的数据分析功底，但其职业方向以互联网用户画像和AB测试为主，与量化交易系统开发的技术栈差距较大——缺少C++经验、无金融行业背景、未接触过实盘交易系统。经验年限和地点（北京到上海）基本可行，但核心技能匹配度不足，不建议推荐。",
  "risk_flags": "1. 猎头明确要求'必须有实盘交易系统开发经验'，该候选人完全不具备。2. 技术栈偏数据分析（Python/SQL），缺少量化开发所需的C++和低延迟系统经验。3. 从互联网跨行到量化金融，知识体系差距较大。建议跳过此候选人。"
}

## 特殊情况处理
- 如果候选人是IC（个人贡献者）岗位，管理经验维度权重归零，其权重平均分配给其他维度
- 如果行业知识上下文可用，参考其中的技能关联来判断"相关但不完全匹配"的技能（例如"光伏逆变器"经验对"储能"岗位的相关度）
- 如果候选人信息严重不足（缺少3个以上维度的信息），match_score上限为50，并在risk_flags中明确标注"信息不足，建议补充后重新评估"
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
            from app.services.chroma_service import get_industry_collection
            query_text = f"{project.jd_raw or ''} {str(project.requirement_profile)}"
            query_embedding = await self.embedding_svc.get_embedding(query_text[:2000])

            collection = get_industry_collection()
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=3,
            )
            if not results["documents"] or not results["documents"][0]:
                return ""
            return "\n\n".join(results["documents"][0])
        except Exception as e:
            logger.warning(f"Failed to get industry context: {e}")
            return ""
