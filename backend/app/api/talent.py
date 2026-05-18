"""
Talent Agent API endpoints.

Each parse endpoint accepts skip_dedup=true to return parsed candidates
without conflict info attached. In that case the caller (typically the
frontend's stepwise import flow) is expected to call /check-duplicates next.
This split lets the UI render a per-stage progress indicator.

POST /talent/parse-images       — Parse images via Vision LLM
POST /talent/parse-document     — Parse PDF / Word (text extraction + LLM)
POST /talent/parse-text         — Parse raw pasted text via LLM
POST /talent/check-duplicates   — Batch dedup over already-parsed candidates
POST /talent/confirm-import     — Write confirmed candidates to the DB
"""

import io

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.talent import TalentAgent
from app.database import get_db
from app.schemas.talent import (
    CheckDuplicatesRequest,
    CheckDuplicatesResponse,
    ConfirmImportRequest,
    ConfirmImportResponse,
    ExtractDocResponse,
    ParseResponse,
    ParseTextRequest,
)
from app.utils.logger import logger

router = APIRouter(prefix="/talent", tags=["talent"])

# Raw upload limit — checked before preprocessing
_IMAGE_MAX_BYTES = 20 * 1024 * 1024  # 20 MB

# After preprocessing (resize + JPEG), images are typically < 500 KB.
# Anthropic enforces a 5 MB post-encoding limit; OpenAI allows 20 MB.
# We target ≤ 2 MB post-preprocessing so both providers are safe.
_IMAGE_MAX_AFTER_PREPROCESS = 2 * 1024 * 1024

# Longest side after resize — sufficient for text recognition in screenshots
_IMAGE_MAX_SIDE = 1600


def _preprocess_image(data: bytes, media_type: str) -> tuple[bytes, str]:
    """
    Normalize an uploaded image before sending to LLM:
    - Convert any format (HEIC, PNG, BMP, WEBP …) → JPEG
    - Resize so the longest side ≤ _IMAGE_MAX_SIDE (preserving aspect ratio)
    - Compress at quality=85

    Returns (processed_bytes, "image/jpeg").
    Falls back to the original if Pillow cannot open the image.
    """
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(data))
        original_size = len(data)

        # Flatten alpha / palette so JPEG can encode it
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        # Resize if needed
        w, h = img.size
        if max(w, h) > _IMAGE_MAX_SIDE:
            ratio = _IMAGE_MAX_SIDE / max(w, h)
            img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85, optimize=True)
        processed = buf.getvalue()

        logger.debug(
            f"Image preprocessed: {original_size // 1024} KB → {len(processed) // 1024} KB "
            f"({img.size[0]}×{img.size[1]})"
        )
        return processed, "image/jpeg"

    except Exception as exc:
        logger.warning(f"Image preprocessing failed, using original: {exc}")
        return data, media_type


def _extract_pdf_text(data: bytes) -> str:
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            pages = [p.extract_text() or "" for p in pdf.pages]
        return "\n\n".join(p for p in pages if p.strip())
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"PDF 解析失败：{exc}") from exc


def _extract_word_text(data: bytes) -> str:
    try:
        from docx import Document
        doc = Document(io.BytesIO(data))
        paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]
        return "\n".join(paragraphs)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Word 文档解析失败：{exc}") from exc


@router.post("/parse-images", response_model=ParseResponse)
async def parse_images(
    files: list[UploadFile] = File(...),
    batch_mode: bool = Form(False),
    skip_dedup: bool = Form(False),
    db: AsyncSession = Depends(get_db),
) -> ParseResponse:
    if not files:
        raise HTTPException(status_code=400, detail="至少需要上传一张图片")

    images: list[tuple[bytes, str]] = []
    for f in files:
        if not f.content_type or not f.content_type.startswith("image/"):
            raise HTTPException(
                status_code=400, detail=f"文件 {f.filename} 不是图片格式"
            )
        data = await f.read()
        if len(data) > _IMAGE_MAX_BYTES:
            raise HTTPException(
                status_code=400, detail=f"图片 {f.filename} 超过 20 MB，请压缩后重试"
            )
        # Normalize format, resize, compress → safe for both OpenAI and Anthropic
        data, media_type = _preprocess_image(data, f.content_type)
        if len(data) > _IMAGE_MAX_AFTER_PREPROCESS:
            raise HTTPException(
                status_code=400,
                detail=f"图片 {f.filename} 压缩后仍超过 2 MB，请裁剪后重试",
            )
        images.append((data, media_type))

    return await TalentAgent().parse_images(db, images, batch_mode, skip_dedup=skip_dedup)


@router.post("/parse-document", response_model=ParseResponse)
async def parse_document(
    file: UploadFile = File(...),
    skip_dedup: bool = Form(False),
    db: AsyncSession = Depends(get_db),
) -> ParseResponse:
    filename = (file.filename or "").lower()
    data = await file.read()

    if filename.endswith(".pdf"):
        text = _extract_pdf_text(data)
        source_type = "pdf"
    elif filename.endswith((".docx", ".doc")):
        text = _extract_word_text(data)
        source_type = "word"
    else:
        raise HTTPException(
            status_code=400, detail="仅支持 PDF 和 Word (.docx/.doc) 格式"
        )

    if not text.strip():
        return ParseResponse(
            results=[],
            error="文档中未能提取到文字内容，可能是扫描件。请改用「图片截图」模式上传。",
        )

    return await TalentAgent().parse_text(db, text, source_type, skip_dedup=skip_dedup)


@router.post("/parse-text", response_model=ParseResponse)
async def parse_text(
    request: ParseTextRequest,
    skip_dedup: bool = False,
    db: AsyncSession = Depends(get_db),
) -> ParseResponse:
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="文字内容不能为空")

    return await TalentAgent().parse_text(db, request.text, "text", skip_dedup=skip_dedup)


@router.post("/check-duplicates", response_model=CheckDuplicatesResponse)
async def check_duplicates(
    request: CheckDuplicatesRequest,
    db: AsyncSession = Depends(get_db),
) -> CheckDuplicatesResponse:
    """Batch dedup for an already-parsed list of candidates."""
    if not request.candidates:
        return CheckDuplicatesResponse(conflicts=[])
    conflicts = await TalentAgent().check_duplicates_batch(db, request.candidates)
    return CheckDuplicatesResponse(conflicts=conflicts)


@router.post("/extract-doc", response_model=ExtractDocResponse)
async def extract_doc(file: UploadFile = File(...)) -> ExtractDocResponse:
    """Extract plain text from a PDF or Word file for use as CA conversation context."""
    filename = file.filename or "document"
    data = await file.read()
    lower = filename.lower()
    if lower.endswith(".pdf"):
        text = _extract_pdf_text(data)
    elif lower.endswith((".docx", ".doc")):
        text = _extract_word_text(data)
    else:
        raise HTTPException(status_code=400, detail="仅支持 PDF 和 Word (.docx/.doc) 格式")
    if not text.strip():
        raise HTTPException(status_code=422, detail="文档中未能提取到文字内容，可能是扫描件，请改用截图模式")
    return ExtractDocResponse(text=text, filename=filename)


@router.post("/confirm-import", response_model=ConfirmImportResponse)
async def confirm_import(
    request: ConfirmImportRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> ConfirmImportResponse:
    if not request.candidates:
        raise HTTPException(status_code=400, detail="候选人列表不能为空")

    return await TalentAgent().confirm_import(db, request, background_tasks)
