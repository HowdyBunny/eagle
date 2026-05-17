"""
Research Agent (RA)

Researches industry knowledge using LLM + Tavily web search.
Produces three outputs:
1. Markdown report (saved to file, path stored in project_research)
2. Structured ontology JSON (saved to skill_ontology table)
3. Semantic knowledge chunks (embedded and stored in industry_knowledge table)

Architecture: Plan → Search → Synthesize
  1. Plan:       LLM emits a list of search queries for the topic.
  2. Search:     Tavily runs all queries in parallel (auto_parameters=True).
  3. Synthesize: LLM produces the final structured JSON using the search results.
"""

import json
import uuid
from datetime import datetime
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.project_research import ProjectResearch
from app.services import ontology_service, project_service, research_service
from app.services.research_service import complete_research_task, fail_research_task
from app.services.embedding_service import EmbeddingService
from app.services.llm_client import LLMClient
from app.services import tavily_service
from app.utils.logger import logger
from app.utils.paths import eagle_dir

# Plan step: ask the LLM to emit a JSON list of search queries.
RA_PLAN_PROMPT = """你是 Eagle 系统 Research Agent 的"查询规划者"。
给定一个调研主题，你需要输出一组覆盖不同角度的网络搜索查询，由系统提交给搜索引擎执行。

## 要求
- 每个 query 应该 5-25 个字，**具体、可搜**（避免空泛的"……是什么"）
- 覆盖维度：核心技术/产品、关键岗位/职责、行业术语与黑话、市场格局与代表公司、最新动态
- 数量：5-{max_queries} 条；不要超过 {max_queries} 条
- 用中文或英文均可，按主题语言决定

## 输出格式
只输出一个 JSON 对象，不要任何前后缀、markdown 包裹、解释文字：
{{"queries": ["query1", "query2", ...]}}
"""


# TODO: Tune this research prompt through testing with different industries
RA_SYSTEM_PROMPT = """你是 Eagle 系统的 Research Agent（调研者，RA），专门为猎头研究行业知识。负责为猎头调研行业知识。你的输出将被系统解析并存入知识库，因此必须严格按照指定的JSON格式输出。

## 任务
针对给定的行业或技术方向进行深度调研。用户消息中会附带网络搜索结果（来自 Tavily），你需要基于这些搜索结果整理输出一个严格的 JSON 对象。

## 调研要求
- 所有内容必须基于提供的搜索结果，不要编造不存在的技术或岗位
- 如果搜索结果中信息不全，可以用模型已有的可靠知识补充，但优先采用搜索结果
- 关注：核心技术栈、关键岗位、行业术语/黑话、技能之间的关联关系
- 技能图谱要体现岗位之间的差异，不要所有岗位都列相同的技能


## 输出格式
你必须且只能输出一个JSON对象，不要输出任何其他内容（不要有```json标记，不要有前言后语）。JSON结构如下：

{
  "markdown_report": "完整的Markdown格式行业报告，用\\n表示换行",
  "ontology": {
    "industry": "行业名称",
    "concept": "核心概念 (中文和英文名)",
    "synonyms": ["同义词/别称列表"],
    "tech_stack": ["核心技术/工具列表"],
    "prerequisites": ["从业者需要的前置技能"],
    "key_positions": ["该领域的关键岗位"],
    "skill_relations": {
      "技能类别1": ["相关具体技能"],
      "技能类别2": ["相关具体技能"]
    },
    "jargon": {
      "行业术语、黑话": "通俗解释"
    }
  },
  "knowledge_chunks": [
    "知识块1：200-500字的独立知识单元",
    "知识块2：200-500字的独立知识单元"
  ]
}

---

## 输出示例

调研主题："大模型部署"

{
  "markdown_report": "# 大模型部署（LLM Deployment）行业调研\\n\\n## 市场概况\\n随着大语言模型从实验室走向生产环境，模型部署和推理优化已成为AI基础设施领域的核心方向。2024-2025年，企业对大模型私有化部署的需求激增，推动了一批推理框架和优化工具的快速发展。\\n\\n## 核心技术栈\\n- **推理引擎**：vLLM、TensorRT-LLM、SGLang、TGI（Text Generation Inference）\\n- **模型压缩**：GPTQ、AWQ、GGUF量化方案\\n- **服务化框架**：Triton Inference Server、Ray Serve、BentoML\\n- **基础设施**：CUDA、Docker、Kubernetes、GPU集群调度\\n\\n## 关键岗位\\n1. **大模型推理优化工程师** — 核心是GPU性能调优和推理框架的深度使用\\n2. **AI平台工程师** — 偏向MLOps，负责模型的CI/CD和线上监控\\n3. **模型部署架构师** — 高级岗位，需要设计整体推理架构和成本优化方案\\n\\n## 行业黑话速查\\n| 术语 | 含义 |\\n|------|------|\\n| Serving | 模型服务/上线 |\\n| Inference | 模型推理 |\\n| Throughput | 吞吐量，单位时间处理的请求数 |\\n| Latency | 延迟，单次推理的耗时 |\\n| KV Cache | 键值缓存，加速自回归生成 |\\n| Batching | 批处理，合并多个请求一起推理 |\\n| Quantization | 量化，降低模型精度以减少显存占用 |",
  "ontology": {
    "industry": "人工智能",
    "concept": "大模型部署 (LLM Deployment)",
    "synonyms": ["模型推理", "LLM Inference", "模型服务化", "大模型上线", "端侧部署"],
    "tech_stack": ["vLLM", "TensorRT-LLM", "SGLang", "TGI", "Triton", "Ray Serve", "BentoML", "CUDA", "Docker", "Kubernetes"],
    "prerequisites": ["Python", "C++/CUDA编程", "Linux系统", "Docker/K8s", "深度学习基础", "GPU架构理解"],
    "key_positions": ["大模型推理优化工程师", "AI平台工程师", "模型部署架构师", "GPU集群运维工程师"],
    "skill_relations": {
      "推理优化": ["vLLM", "TensorRT-LLM", "量化(GPTQ/AWQ)", "KV Cache优化", "Continuous Batching", "Tensor并行"],
      "模型服务化": ["Triton", "Ray Serve", "FastAPI", "gRPC", "负载均衡", "A/B测试"],
      "基础设施": ["Docker", "Kubernetes", "GPU调度(NVIDIA MPS/MIG)", "监控(Prometheus/Grafana)"],
      "MLOps": ["模型版本管理", "CI/CD", "日志追踪", "自动化发布", "模型注册表"]
    },
    "jargon": {
      "Serving": "模型服务化，将模型部署为可调用的API",
      "Inference": "模型推理，用训练好的模型进行预测",
      "Throughput": "吞吐量，每秒处理的token数或请求数",
      "Latency": "延迟，从请求发出到收到响应的时间",
      "KV Cache": "键值缓存，存储已计算的注意力键值对避免重复计算",
      "Batching": "批处理，将多个请求合并推理以提升GPU利用率",
      "Quantization": "量化，将FP16/FP32模型压缩为INT8/INT4以减少显存",
      "TTFT": "Time To First Token，首个token的生成延迟",
      "TPS": "Tokens Per Second，每秒生成的token数"
    }
  },
  "knowledge_chunks": [
    "大模型推理优化是2024-2025年AI基础设施领域最热门的技术方向之一。核心挑战在于：大语言模型（如GPT、LLaMA、Qwen等）的参数量通常在数十亿到数千亿之间，直接部署需要大量GPU显存，推理成本极高。因此，推理优化工程师的核心任务是在保证模型输出质量的前提下，最大化推理吞吐量、最小化延迟和成本。主流的优化手段包括：模型量化（GPTQ、AWQ、GGUF）、KV Cache优化、Continuous Batching、Tensor并行和Pipeline并行。",
    "当前主流的大模型推理框架各有侧重：vLLM是开源社区最活跃的推理引擎，以PagedAttention技术著称，能高效管理KV Cache显存；TensorRT-LLM是NVIDIA官方推出的推理框架，深度优化了NVIDIA GPU的性能，适合对延迟要求极高的场景；SGLang（由UC Berkeley开发）在结构化生成和多轮对话场景下表现优异；TGI（Text Generation Inference）是HuggingFace推出的推理服务，与HuggingFace生态无缝集成。选择哪个框架取决于具体场景：追求吞吐选vLLM，追求极致延迟选TensorRT-LLM，需要结构化输出选SGLang。",
    "大模型部署领域的关键岗位可以分为三个层次：一是推理优化工程师，这是最核心的技术岗，要求深入理解GPU架构（CUDA核心、显存层级、Tensor Core）、熟练使用至少一种推理框架、具备C++/CUDA编程能力。二是AI平台工程师，偏向工程化和运维，负责模型的Docker化、K8s部署、CI/CD流水线、线上监控和告警。三是模型部署架构师，这是高级岗位，需要设计整体的推理架构（单机多卡、多机多卡、混合云），制定成本优化策略（动态batch、模型路由、冷热分层），并能根据业务需求选择合适的技术方案。"
  ]
}
"""


def _extract_queries(text: str) -> list[str]:
    """
    Parse `{"queries": [...]}` out of the planning LLM's reply.

    Tolerates ```json fences and surrounding chatter — locates the first
    `{` ... `}` block and tries to load it.
    """
    s = text.strip()
    if s.startswith("```"):
        s = s.split("```", 2)[1]
        if s.startswith("json"):
            s = s[4:]
        s = s.rsplit("```", 1)[0]
    start = s.find("{")
    end = s.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return []
    try:
        data = json.loads(s[start : end + 1])
    except json.JSONDecodeError:
        return []
    raw = data.get("queries") or []
    return [str(q).strip() for q in raw if isinstance(q, (str, int, float)) and str(q).strip()]


class ResearchAgent:
    def __init__(self, db: AsyncSession):
        self.llm = LLMClient()
        self.db = db
        self.embedding_svc = EmbeddingService()

    async def research(
        self,
        project_id: uuid.UUID,
        topic: str,
        additional_context: str | None = None,
        task_id: uuid.UUID | None = None,
    ) -> ProjectResearch:
        logger.info(f"RA starting research on '{topic}' for project {project_id}")

        try:
            # 1. Plan — let the LLM decide which queries to run.
            queries = await self._plan_queries(topic, additional_context)
            logger.info(f"RA planned {len(queries)} queries for '{topic}': {queries}")

            # 2. Search — fan out to Tavily in parallel.
            search_responses = await tavily_service.search_many(queries)
            search_blob = tavily_service.format_results_for_llm(search_responses)
            logger.info(
                f"RA collected {sum(len(r.get('results') or []) for r in search_responses)} "
                f"results across {len(search_responses)} queries"
            )

            # 3. Synthesize — LLM produces the final structured JSON.
            user_prompt = f"请基于以下网络搜索结果调研：{topic}"
            if additional_context:
                user_prompt += f"\n\n额外背景：{additional_context}"
            user_prompt += f"\n\n## 网络搜索结果（Tavily）\n\n{search_blob}"

            full_text = await self.llm.simple_chat(
                [
                    {"role": "system", "content": RA_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=8192,
            )

            # Parse outputs
            markdown_report, ontology_data, knowledge_chunks = self._parse_response(full_text, topic)

            # Save markdown report to file
            report_path = await self._save_report(project_id, topic, markdown_report)
            logger.info(f"RA report file saved: {report_path}")

            # Save ontology to database
            ontology = await ontology_service.create_ontology(self.db, ontology_data)
            logger.info(f"RA ontology saved: id={ontology.id}")

            # Embed knowledge chunks (best-effort — failure does not block report/DB record)
            embedded_count = 0
            for chunk_text in knowledge_chunks:
                if chunk_text.strip():
                    result = await self.embedding_svc.embed_industry_chunk(ontology.id, chunk_text.strip())
                    if result:
                        embedded_count += 1
            if embedded_count < len([c for c in knowledge_chunks if c.strip()]):
                logger.warning(
                    f"RA: only {embedded_count}/{len(knowledge_chunks)} chunks embedded "
                    f"(check EMBEDDING_API_KEY and EMBEDDING_BASE_URL)"
                )

            if task_id is not None:
                research = await complete_research_task(self.db, task_id, ontology.id, report_path)
            else:
                research = await research_service.create_research_task(self.db, project_id, topic)
                research = await complete_research_task(self.db, research.id, ontology.id, report_path)

            logger.info(f"RA completed research on '{topic}': report={report_path}, ontology={ontology.id}")
            return research

        except Exception as e:
            logger.exception(f"RA failed research on '{topic}' for project {project_id}")
            if task_id is not None:
                try:
                    await fail_research_task(self.db, task_id, str(e))
                except Exception:
                    logger.exception("RA: failed to update task status to FAILED")
            raise

    async def _plan_queries(self, topic: str, additional_context: str | None) -> list[str]:
        """
        Ask the LLM for a list of search queries. Falls back to a single
        topic-as-query if the LLM output cannot be parsed — the synthesize
        step then still gets at least one search blob.
        """
        max_q = settings.TAVILY_MAX_QUERIES
        system_prompt = RA_PLAN_PROMPT.format(max_queries=max_q)
        user_prompt = f"调研主题：{topic}"
        if additional_context:
            user_prompt += f"\n额外背景：{additional_context}"

        raw = await self.llm.simple_chat(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=1024,
        )

        queries = _extract_queries(raw)
        if not queries:
            logger.warning(f"RA: plan step returned no usable queries, falling back to topic. raw={raw[:200]!r}")
            return [topic]
        return queries[:max_q]

    def _parse_response(self, full_text: str, topic: str) -> tuple[str, dict, list[str]]:
        default_ontology = {
            "industry": topic,
            "concept": topic,
            "synonyms": [],
            "tech_stack": [],
            "prerequisites": [],
            "key_positions": [],
            "skill_relations": {},
            "jargon": {},
        }
        try:
            # Strip potential markdown code fences wrapping the JSON
            text = full_text.strip()
            if text.startswith("```"):
                text = text.split("```", 2)[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.rsplit("```", 1)[0]

            data = json.loads(text.strip())
            markdown_report = data.get("markdown_report", "")
            ontology_data = data.get("ontology", default_ontology)
            knowledge_chunks = data.get("knowledge_chunks", [])
            return markdown_report, ontology_data, knowledge_chunks

        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"RA: Failed to parse JSON response: {e}, using raw text as fallback")
            return full_text, default_ontology, [full_text]

    async def _save_report(self, project_id: uuid.UUID, topic: str, content: str) -> str:
        project = await project_service.get_project(self.db, project_id)
        if project and project.folder_path:
            reports_dir = Path(project.folder_path) / "reports"
        else:
            reports_dir = eagle_dir() / "projects" / str(project_id) / "reports"
        reports_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_topic = topic.replace("/", "_").replace(" ", "_")[:50]
        filename = reports_dir / f"{safe_topic}_{timestamp}.md"
        with open(filename, "w", encoding="utf-8") as f:
            f.write(f"# {topic} 行业调研报告\n\n")
            f.write(f"**项目ID**: {project_id}\n")
            f.write(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write("---\n\n")
            f.write(content)
        return str(filename)
