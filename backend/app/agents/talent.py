"""
Talent Agent (TA) — candidate ingestion and management.

Responsibilities:
- Parse candidate info from images (Vision LLM), PDF/Word documents, or raw text
- Detect duplicates in the talent pool before writing
- Confirm and bulk-write parsed candidates to the database
"""

import json
import re
from uuid import UUID

from fastapi import BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import Candidate
from app.schemas.candidate import CandidateCreate, CandidateResponse, CandidateUpdate
from app.schemas.talent import (
    ConfirmImportRequest,
    ConfirmImportResponse,
    DuplicateConflict,
    ParsedCandidateData,
    ParseResponse,
    ParseResult,
)
from app.services import candidate_service
from app.services.llm_client import LLMClient, VisionNotSupportedError
from app.utils.logger import logger

_SYSTEM_PROMPT = """你是候选人信息提取专家。从给定内容（招聘平台截图、简历文档或文字）中提取候选人结构化信息。

提取规则：
1. 仅提取内容中明确出现的信息，不推断、不补全
2. years_experience：根据工作经历时间段计算总年数（保留一位小数），无法确定则为 null
3. experience_summary：1-3 句话概括核心背景和亮点，语言简洁专业
4. experiences：每段工作经历单独一个对象，包含 title（职位）、company（公司）、duration（时间段，如 "2020.03 - 2023.06 · 3年3个月"）、description（职责描述，无则 null）
5. education：格式"学校 · 学位 · 专业"，如"北京大学 · 硕士 · 计算机科学"
6. salary_range：保留原始格式，如"30-50k""月薪2万"

输出格式：严格输出合法 JSON 数组，不添加任何额外文字或 Markdown 代码块。字段无信息写 null，不写空字符串。

示例输出：
[{"full_name": "张三", "current_title": "高级工程师", "current_company": "某科技公司", "location": "上海", "years_experience": 8, "salary_range": null, "education": "复旦大学 · 本科 · 计算机科学", "phone": "13800001234", "email": "zhang@example.com", "experience_summary": "8年后端开发经验，专注分布式系统架构，曾主导亿级流量平台建设。", "experiences": [{"title": "高级工程师", "company": "某科技公司", "duration": "2020.03 - 至今 · 4年", "description": "负责核心支付系统架构设计，带领10人团队完成亿级流量平台建设。"}, {"title": "工程师", "company": "前一家公司", "duration": "2016.07 - 2020.02 · 3年7个月", "description": null}]}]"""


def _parse_llm_json(raw: str) -> list[dict] | None:
    """Extract a JSON array from LLM output. Returns None on failure."""
    raw = raw.strip()
    # Direct parse
    try:
        result = json.loads(raw)
        return result if isinstance(result, list) else [result]
    except json.JSONDecodeError:
        pass
    # Strip markdown code fences and retry
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE).strip()
    try:
        result = json.loads(cleaned)
        return result if isinstance(result, list) else [result]
    except json.JSONDecodeError:
        pass
    # Regex: grab first [...] block
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if match:
        try:
            result = json.loads(match.group())
            return result if isinstance(result, list) else [result]
        except json.JSONDecodeError:
            pass
    return None


def _to_parsed_data(raw_dict: dict) -> ParsedCandidateData:
    allowed = set(ParsedCandidateData.model_fields.keys())
    return ParsedCandidateData(**{k: v for k, v in raw_dict.items() if k in allowed})


class TalentAgent:
    def __init__(self) -> None:
        self._llm = LLMClient()

    # ── Public parse methods ────────────────────────────────────────────────

    async def parse_images(
        self,
        db: AsyncSession,
        images: list[tuple[bytes, str]],
        batch_mode: bool,
    ) -> ParseResponse:
        """Parse candidate info from one or more images via Vision LLM."""
        if batch_mode:
            mode_note = (
                "批量模式：每张截图代表不同的候选人，请为每张截图提取一份独立档案，"
                f"输出数组长度应等于截图数量（{len(images)}）。"
            )
        else:
            mode_note = (
                "单候选人模式：所有截图来自同一候选人的不同页面，"
                "请整合所有截图信息提取一份完整档案，输出数组中只有一个对象。"
            )

        user_text = (
            f"请分析以下截图，提取候选人信息。\n\n{mode_note}\n\n"
            "请严格按照 JSON 数组格式输出，不要添加任何其他文字。"
        )

        try:
            raw = await self._llm.vision_chat(
                system_prompt=_SYSTEM_PROMPT,
                user_text=user_text,
                images=images,
            )
        except VisionNotSupportedError as exc:
            return ParseResponse(results=[], error=str(exc))
        except Exception as exc:
            logger.warning(f"TA parse_images error: {exc}")
            return ParseResponse(results=[], error=f"解析失败：{exc}")

        return await self._build_results(db, raw)

    async def parse_text(
        self,
        db: AsyncSession,
        text: str,
        source_type: str,
    ) -> ParseResponse:
        """Parse candidate info from extracted document text or raw paste."""
        labels = {"pdf": "PDF 简历", "word": "Word 简历", "text": "文字内容"}
        label = labels.get(source_type, "文字内容")

        messages = [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"请从以下{label}中提取候选人信息，"
                    "输出数组中只有一个候选人对象。\n\n"
                    f"{text}\n\n"
                    "请严格按照 JSON 数组格式输出，不要添加任何其他文字。"
                ),
            },
        ]

        try:
            raw = await self._llm.simple_chat(messages)
        except Exception as exc:
            logger.warning(f"TA parse_text error: {exc}")
            return ParseResponse(results=[], error=f"解析失败：{exc}")

        return await self._build_results(db, raw)

    # ── Confirm and write ───────────────────────────────────────────────────

    async def confirm_import(
        self,
        db: AsyncSession,
        request: ConfirmImportRequest,
        background_tasks: BackgroundTasks,
    ) -> ConfirmImportResponse:
        """Write confirmed candidates to the database."""
        from app.services.embedding_service import EmbeddingService
        embed_svc = EmbeddingService()

        created = updated = skipped = 0

        for item in request.candidates:
            if item.action == "skip":
                skipped += 1
                continue

            pd = item.parsed_data

            if item.action == "overwrite" and item.existing_id:
                # Only overwrite non-null fields to avoid accidental data loss
                patch = {k: v for k, v in pd.model_dump(exclude={"experiences"}).items() if v is not None}
                if pd.experiences:
                    patch["raw_structured_data"] = {
                        "experiences": [e.model_dump(exclude_none=True) for e in pd.experiences]
                    }
                update_data = CandidateUpdate(**patch)
                candidate = await candidate_service.update_candidate(
                    db, UUID(item.existing_id), update_data
                )
                if candidate and candidate.experience_summary:
                    background_tasks.add_task(
                        embed_svc.embed_candidate,
                        candidate.id,
                        candidate.experience_summary,
                    )
                updated += 1

            else:  # "create"
                if not pd.full_name:
                    logger.warning("TA confirm_import: skipping candidate with no full_name")
                    skipped += 1
                    continue

                raw_data = (
                    {"experiences": [e.model_dump(exclude_none=True) for e in pd.experiences]}
                    if pd.experiences else None
                )
                create_data = CandidateCreate(
                    full_name=pd.full_name,
                    current_title=pd.current_title,
                    current_company=pd.current_company,
                    location=pd.location,
                    years_experience=pd.years_experience,
                    salary_range=pd.salary_range,
                    education=pd.education,
                    phone=pd.phone,
                    email=pd.email,
                    experience_summary=pd.experience_summary,
                    raw_structured_data=raw_data,
                    source_platform=item.source_platform,
                )
                candidate = await candidate_service.create_candidate(db, create_data)
                if candidate.experience_summary:
                    background_tasks.add_task(
                        embed_svc.embed_candidate,
                        candidate.id,
                        candidate.experience_summary,
                    )
                created += 1

        return ConfirmImportResponse(created=created, updated=updated, skipped=skipped)

    # ── Internal helpers ────────────────────────────────────────────────────

    async def _build_results(self, db: AsyncSession, raw: str) -> ParseResponse:
        candidates_data = _parse_llm_json(raw)
        if candidates_data is None:
            logger.warning(f"TA: failed to parse LLM JSON: {raw[:300]}")
            return ParseResponse(results=[], error="LLM 返回格式异常，请重试")

        results: list[ParseResult] = []
        for cd in candidates_data:
            if not isinstance(cd, dict):
                continue
            parsed = _to_parsed_data(cd)
            conflicts = await self._check_duplicates(db, parsed)
            results.append(ParseResult(parsed_data=parsed, conflicts=conflicts))

        return ParseResponse(results=results)

    async def _check_duplicates(
        self, db: AsyncSession, parsed: ParsedCandidateData
    ) -> list[DuplicateConflict]:
        """Check DB for existing candidates that likely match parsed data."""
        # Priority 1: Phone exact match
        if parsed.phone:
            r = await db.execute(
                select(Candidate).where(Candidate.phone == parsed.phone)
            )
            existing = r.scalar_one_or_none()
            if existing:
                return [DuplicateConflict(
                    existing_candidate=CandidateResponse.model_validate(existing),
                    match_reason="phone",
                )]

        # Priority 2: Email exact match
        if parsed.email:
            r = await db.execute(
                select(Candidate).where(Candidate.email == parsed.email)
            )
            existing = r.scalar_one_or_none()
            if existing:
                return [DuplicateConflict(
                    existing_candidate=CandidateResponse.model_validate(existing),
                    match_reason="email",
                )]

        # Priority 3: Name + Company fuzzy match
        if parsed.full_name and parsed.current_company:
            r = await db.execute(
                select(Candidate).where(
                    Candidate.full_name.ilike(f"%{parsed.full_name}%"),
                    Candidate.current_company.ilike(f"%{parsed.current_company}%"),
                )
            )
            existing = r.scalar_one_or_none()
            if existing:
                return [DuplicateConflict(
                    existing_candidate=CandidateResponse.model_validate(existing),
                    match_reason="name_company",
                )]

        return []
