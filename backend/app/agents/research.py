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
import re
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
RA_PLAN_PROMPT = """你是 Eagle 系统 Research Agent 的"研究者"，RA。
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
RA_SYSTEM_PROMPT = """你是 Eagle 系统的 Research Agent（调研者，RA），专门为猎头研究行业知识。你的输出将被系统按 XML 标签解析存入知识库，必须严格遵循下面的输出格式。

## 任务
针对给定的调研主题进行深度调研。用户消息中会附带网络搜索结果（来自 Tavily），你需要基于这些搜索结果整理输出。

## 第一步：识别调研类型（不需要写出来）
- **A. 技能/岗位调研**："XX 工程师的技能要求"、"XX 研发岗位"
- **B. 行业/市场调研**："XX 行业格局"、"XX 市场趋势"、"XX 竞争态势"
- **C. 公司情报**："XX 公司近况"、"XX 公司组织/业务"
- **D. 其他**：薪酬、地区、政策等

## 通用要求（无论类型）
- **`<markdown_report>` 段是最重要的产出** —— 它是猎头会读的那份完整报告，要饱满详细
- 所有事实必须基于提供的搜索结果，不要编造不存在的公司、技术、人物或数字
- 搜索结果信息不足时可用模型可靠知识补充，但要优先采用搜索结果
- `<ontology>` 段里的 industry 和 concept **任何类型都必须填**（猎头用这两个字段做检索/分类）

## 结构化字段填法（按类型）
`<ontology>` 里 industry / concept 之外的字段（synonyms / tech_stack / prerequisites / key_positions / skill_relations / jargon），**只在主题真的需要时才填**，否则一律输出空数组 `[]` 或空对象 `{}`。强行硬塞会导致不同类型的报告混在一起搜索时变得难用。

  - 类型 A（技能/岗位）：六个字段都尽量填满，技能图谱体现不同岗位的差异
  - 类型 B（行业/市场）：通常只填 jargon（市场术语）和 key_positions（代表岗位），其他字段留空
  - 类型 C（公司情报）：通常六个字段都留空，所有信息进 markdown_report
  - 类型 D：根据具体内容判断，宁可空也不要硬塞

`<knowledge_chunks>` 永远要输出 2-4 段 200-500 字的独立知识单元（无论类型），供后续语义检索使用。


## 输出格式（极其重要）
你必须**严格**输出以下三个 XML 标签段，**顺序固定、各出现一次**。三段之外不要有任何前后缀、思考过程或解释。

<markdown_report>
完整的 Markdown 报告正文写在这里。**这里是纯 Markdown**：
- 用真实换行分隔段落，不要写 \\n
- 引号 " 不需要转义
- 可以含表格、列表、代码块、加粗等任何 Markdown 语法
- 唯一的禁忌是这段内容里不能出现字面字符串 "</markdown_report>"（否则会被提前截断）
</markdown_report>

<ontology>
{"industry": "...", "concept": "...", "synonyms": [...], "tech_stack": [...], "prerequisites": [...], "key_positions": [...], "skill_relations": {...}, "jargon": {...}}
</ontology>

<knowledge_chunks>
["知识块1的完整文字", "知识块2的完整文字", "知识块3的完整文字"]
</knowledge_chunks>

`<ontology>` 和 `<knowledge_chunks>` 标签内**必须是严格合法的 JSON**（无注释、无尾逗号、字符串内换行用 \\n 转义）。这两段都很短，请务必保证 JSON 合法。

---

## 完整示例（类型 A：技能/岗位调研，主题"大模型部署"）

<markdown_report>
# 大模型部署（LLM Deployment）行业调研

## 市场概况
随着大语言模型从实验室走向生产环境，模型部署和推理优化已成为 AI 基础设施领域的核心方向。2024-2025 年，企业对大模型私有化部署的需求激增，推动了一批推理框架和优化工具的快速发展。

## 核心技术栈
- **推理引擎**：vLLM、TensorRT-LLM、SGLang、TGI
- **模型压缩**：GPTQ、AWQ、GGUF 量化方案
- **服务化框架**：Triton Inference Server、Ray Serve、BentoML
- **基础设施**：CUDA、Docker、Kubernetes、GPU 集群调度

## 关键岗位
1. **大模型推理优化工程师** —— 核心是 GPU 性能调优和推理框架的深度使用
2. **AI 平台工程师** —— 偏向 MLOps，负责模型的 CI/CD 和线上监控
3. **模型部署架构师** —— 高级岗位，需要设计整体推理架构和成本优化方案

## 行业黑话速查
| 术语 | 含义 |
|------|------|
| Serving | 模型服务/上线 |
| Throughput | 吞吐量，单位时间处理的请求数 |
| KV Cache | 键值缓存，加速自回归生成 |
</markdown_report>

<ontology>
{"industry": "人工智能", "concept": "大模型部署 (LLM Deployment)", "synonyms": ["模型推理", "LLM Inference", "模型服务化"], "tech_stack": ["vLLM", "TensorRT-LLM", "SGLang", "TGI", "Triton", "Ray Serve", "CUDA", "Docker", "Kubernetes"], "prerequisites": ["Python", "C++/CUDA编程", "Linux系统", "深度学习基础", "GPU架构理解"], "key_positions": ["大模型推理优化工程师", "AI平台工程师", "模型部署架构师"], "skill_relations": {"推理优化": ["vLLM", "TensorRT-LLM", "量化(GPTQ/AWQ)", "KV Cache优化"], "模型服务化": ["Triton", "Ray Serve", "FastAPI", "负载均衡"], "基础设施": ["Docker", "Kubernetes", "GPU调度", "监控"]}, "jargon": {"Serving": "模型服务化，将模型部署为可调用的API", "Throughput": "吞吐量，每秒处理的token数或请求数", "Latency": "延迟，从请求发出到收到响应的时间", "KV Cache": "键值缓存，存储已计算的注意力键值对避免重复计算"}}
</ontology>

<knowledge_chunks>
["大模型推理优化是 2024-2025 年 AI 基础设施领域最热门的技术方向之一。核心挑战在于：大语言模型参数量通常在数十亿到数千亿之间，直接部署需要大量 GPU 显存，推理成本极高。推理优化工程师的核心任务是在保证模型输出质量的前提下，最大化推理吞吐量、最小化延迟和成本。主流的优化手段包括：模型量化（GPTQ、AWQ、GGUF）、KV Cache 优化、Continuous Batching、Tensor 并行。", "当前主流的大模型推理框架各有侧重：vLLM 是开源社区最活跃的推理引擎，以 PagedAttention 技术著称，能高效管理 KV Cache 显存；TensorRT-LLM 是 NVIDIA 官方推出的推理框架，深度优化了 NVIDIA GPU 的性能；SGLang 在结构化生成和多轮对话场景下表现优异；TGI 与 HuggingFace 生态无缝集成。", "大模型部署领域的关键岗位可以分为三个层次：一是推理优化工程师，要求深入理解 GPU 架构、熟练使用至少一种推理框架、具备 C++/CUDA 编程能力。二是 AI 平台工程师，偏向工程化和运维。三是模型部署架构师，需要设计整体的推理架构并制定成本优化策略。"]
</knowledge_chunks>

---

上面是类型 A 的完整示范。**如果是类型 B（市场）或 C（公司）**，markdown_report 同样要饱满（市场份额、竞争态势、关键事件等），但 ontology 里除了 industry / concept / 可能的 key_positions / 可能的 jargon 之外，其余字段应输出空数组 / 空对象：

<ontology>
{"industry": "...", "concept": "...", "synonyms": [], "tech_stack": [], "prerequisites": [], "key_positions": ["可能填几个代表岗位"], "skill_relations": {}, "jargon": {"可能填几个市场术语": "解释"}}
</ontology>

不要为了"填满"而硬塞 —— 把不存在的"技术栈"塞进市场调研的报告里反而会误导后续匹配。

最后再强调一次：**只输出三个标签段，标签外不写任何东西，标签内不要用 ```json``` 或其它代码块包裹。**
"""


def _extract_xml_section(text: str, tag: str) -> str:
    """
    Pull the contents of `<tag>...</tag>` out of `text`.

    Robustness:
      - Case-insensitive on the tag name (LLMs sometimes uppercase)
      - Tolerates whitespace inside the opening/closing tags
      - Tolerates the LLM wrapping the inside in ```json ... ``` (we strip those)
      - If the closing tag is missing (e.g. output truncated), takes everything
        from the opening tag to EOF — losing some trailing text is better than
        losing the whole report.
    Returns '' if the opening tag is nowhere to be found.
    """
    pattern = rf"<\s*{tag}\s*>(.*?)<\s*/\s*{tag}\s*>"
    m = re.search(pattern, text, flags=re.DOTALL | re.IGNORECASE)
    if m:
        body = m.group(1)
    else:
        # No closing tag — try opening only, take to end of string.
        m_open = re.search(rf"<\s*{tag}\s*>", text, flags=re.IGNORECASE)
        if not m_open:
            return ""
        body = text[m_open.end():]
        logger.warning(f"RA: closing </{tag}> missing, took content up to EOF")

    body = body.strip()
    # Strip optional ```json / ``` fences inside the tag body.
    if body.startswith("```"):
        body = body.split("```", 2)[1] if "```" in body[3:] else body[3:]
        if body.startswith("json"):
            body = body[4:]
        body = body.rsplit("```", 1)[0]
    return body.strip()


def _parse_inner_json(blob: str, label: str):
    """
    Try strict json.loads first; on failure retry with the lenient JSONDecoder
    (strict=False allows literal control chars inside strings, which LLMs
    routinely emit). Returns None on total failure so callers can pick defaults.
    """
    try:
        return json.loads(blob)
    except json.JSONDecodeError:
        pass
    try:
        value = json.JSONDecoder(strict=False).decode(blob)
        logger.info(f"RA: <{label}> JSON parsed with strict=False")
        return value
    except json.JSONDecodeError as e:
        logger.warning(f"RA: <{label}> JSON unparseable: {e}. Falling back to defaults.")
        return None


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
                max_tokens=16384,
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

        markdown_report = _extract_xml_section(full_text, "markdown_report")
        ontology_raw = _extract_xml_section(full_text, "ontology")
        chunks_raw = _extract_xml_section(full_text, "knowledge_chunks")

        if not markdown_report:
            # No <markdown_report> tag at all — the LLM didn't follow the contract.
            # Save the raw output to disk so the user can still see *something*.
            logger.error(
                f"RA: <markdown_report> tag missing in LLM output ({len(full_text)} chars). "
                f"Saving raw text so it isn't lost."
            )
            return full_text, default_ontology, [full_text]

        ontology_data: dict = default_ontology
        if ontology_raw:
            parsed = _parse_inner_json(ontology_raw, label="ontology")
            if isinstance(parsed, dict):
                ontology_data = parsed
                # industry / concept are NOT NULL in DB — fall back to topic if missing.
                if not ontology_data.get("industry"):
                    ontology_data["industry"] = topic
                if not ontology_data.get("concept"):
                    ontology_data["concept"] = topic
        else:
            logger.warning("RA: <ontology> tag missing, using defaults")

        knowledge_chunks: list[str] = []
        if chunks_raw:
            parsed = _parse_inner_json(chunks_raw, label="knowledge_chunks")
            if isinstance(parsed, list):
                knowledge_chunks = [str(c) for c in parsed if c]
        else:
            logger.warning("RA: <knowledge_chunks> tag missing, embeddings will be empty")

        return markdown_report, ontology_data, knowledge_chunks

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
