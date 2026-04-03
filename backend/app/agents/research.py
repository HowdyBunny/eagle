"""
Research Agent (RA)

Researches industry knowledge using LLM with web search.
Produces three outputs:
1. Markdown report (saved to file, path stored in project_research)
2. Structured ontology JSON (saved to skill_ontology table)
3. Semantic knowledge chunks (embedded and stored in industry_knowledge table)

Web search behavior:
  LLM_PROVIDER=openai  → OpenAI Responses API with web_search tool (real-time)
  LLM_PROVIDER=anthropic → Anthropic built-in web_search_20250305 tool (real-time)
"""

import json
import uuid
from datetime import datetime
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project_research import ProjectResearch
from app.services import ontology_service, project_service, research_service
from app.services.embedding_service import EmbeddingService
from app.services.llm_client import LLMClient
from app.utils.logger import logger
from app.utils.paths import eagle_dir

# TODO: Tune this research prompt through testing with different industries
RA_SYSTEM_PROMPT = """你是 Eagle 系统的 Research Agent（调研者），专门为猎头研究行业知识。

## 你的任务
调研给定行业或技术方向，输出三种格式的内容：

### 1. 行业报告（Markdown格式）
包含：市场概况、核心技术栈、专业术语解释、关键岗位分析、行业黑话词典

### 2. 结构化知识图谱（JSON格式）
严格按照以下格式：
```json
{
  "industry": "<行业名称>",
  "concept": "<核心概念名称>",
  "synonyms": ["同义词1", "同义词2"],
  "tech_stack": ["技术1", "技术2"],
  "prerequisites": ["前置技能1", "前置技能2"],
  "key_positions": ["岗位1", "岗位2"],
  "skill_relations": {"技能类别": ["相关技能"]},
  "jargon": {"行业黑话": "解释"}
}
```

### 3. 语义知识块列表（供向量化存储）
每块200-500字，代表一个独立的知识单元。

## 输出格式
请按以下结构输出：
---MARKDOWN_REPORT---
<Markdown报告内容>
---ONTOLOGY_JSON---
<JSON格式的知识图谱>
---KNOWLEDGE_CHUNKS---
<知识块1>
===CHUNK_SEPARATOR===
<知识块2>
===CHUNK_SEPARATOR===
...

请使用联网搜索工具获取最新信息，确保内容准确、实用、专业。
"""


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
    ) -> ProjectResearch:
        logger.info(f"RA starting research on '{topic}' for project {project_id}")

        prompt = f"请调研：{topic}"
        if additional_context:
            prompt += f"\n\n额外背景：{additional_context}"

        full_text = await self.llm.research_chat([
            {"role": "system", "content": RA_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ])

        # Parse outputs
        markdown_report, ontology_data, knowledge_chunks = self._parse_response(full_text, topic)

        # Save markdown report to file
        report_path = await self._save_report(project_id, topic, markdown_report)

        # Save ontology to database
        ontology = await ontology_service.create_ontology(self.db, ontology_data)

        # Embed knowledge chunks
        for chunk_text in knowledge_chunks:
            if chunk_text.strip():
                await self.embedding_svc.embed_industry_chunk(self.db, ontology.id, chunk_text.strip())

        research = await research_service.create_research(
            db=self.db,
            project_id=project_id,
            ontology_id=ontology.id,
            report_file_path=report_path,
        )
        logger.info(f"RA completed research on '{topic}': report={report_path}, ontology={ontology.id}")
        return research

    def _parse_response(self, full_text: str, topic: str) -> tuple[str, dict, list[str]]:
        markdown_report = ""
        ontology_data = {
            "industry": topic,
            "concept": topic,
            "synonyms": [],
            "tech_stack": [],
            "prerequisites": [],
            "key_positions": [],
            "skill_relations": {},
            "jargon": {},
        }
        knowledge_chunks: list[str] = []

        try:
            if "---MARKDOWN_REPORT---" in full_text:
                parts = full_text.split("---MARKDOWN_REPORT---")
                remaining = parts[1] if len(parts) > 1 else ""

                if "---ONTOLOGY_JSON---" in remaining:
                    md_part, rest = remaining.split("---ONTOLOGY_JSON---", 1)
                    markdown_report = md_part.strip()

                    if "---KNOWLEDGE_CHUNKS---" in rest:
                        json_part, chunks_part = rest.split("---KNOWLEDGE_CHUNKS---", 1)
                        json_text = json_part.strip()
                        if json_text.startswith("```"):
                            json_text = json_text.split("```")[1]
                            if json_text.startswith("json"):
                                json_text = json_text[4:]
                            json_text = json_text.rsplit("```", 1)[0]
                        try:
                            ontology_data = json.loads(json_text.strip())
                        except json.JSONDecodeError:
                            logger.warning("RA: Failed to parse ontology JSON, using defaults")

                        knowledge_chunks = [
                            c for c in chunks_part.split("===CHUNK_SEPARATOR===") if c.strip()
                        ]
                    else:
                        try:
                            ontology_data = json.loads(rest.strip())
                        except json.JSONDecodeError:
                            pass
            else:
                markdown_report = full_text
                knowledge_chunks = [full_text]

        except Exception as e:
            logger.warning(f"RA: Error parsing response: {e}, falling back to raw text")
            markdown_report = full_text
            knowledge_chunks = [full_text]

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
