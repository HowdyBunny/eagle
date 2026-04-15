import sys
from pathlib import Path

from loguru import logger

from app.config import settings

# True when running as a PyInstaller bundle (production app)
_IS_BUNDLE = hasattr(sys, "_MEIPASS")


def _logs_dir() -> Path:
    """~/Desktop/Eagle/logs/ — written in both dev and production, easy to send."""
    from app.utils.paths import data_dir
    d = data_dir() / "logs"
    d.mkdir(parents=True, exist_ok=True)
    return d


_log_dir = _logs_dir()

# Local dev log dir (backend/logs/) — only active outside the bundle
_dev_log_dir = Path(__file__).resolve().parent.parent.parent / "logs"
if not _IS_BUNDLE:
    _dev_log_dir.mkdir(exist_ok=True)

logger.remove()
logger.add(
    sys.stderr,
    level=settings.LOG_LEVEL,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    colorize=True,
)
# Production sink: ~/Desktop/Eagle/logs/eagle.log — survives app reinstalls
logger.add(
    str(_log_dir / "eagle.log"),
    level="DEBUG",
    rotation="10 MB",
    retention="7 days",
    compression="zip",
    enqueue=True,
)
# Dev-only sink: backend/logs/eagle.log — convenient when running locally
if not _IS_BUNDLE:
    logger.add(
        str(_dev_log_dir / "eagle.log"),
        level="DEBUG",
        rotation="10 MB",
        retention="7 days",
        compression="zip",
        enqueue=True,
    )

# Dedicated LLM trace sink — one JSON object per line, filtered by extra["llm_trace"].
# Read with: tail -f logs/llm_trace.jsonl | python -m json.tool
# or:        cat logs/llm_trace.jsonl | jq 'select(.method=="agentic_loop_stream")'
logger.add(
    str(_log_dir / "llm_trace.jsonl"),
    level="DEBUG",
    filter=lambda r: r["extra"].get("llm_trace", False),
    format="{message}",
    rotation="20 MB",
    retention="14 days",
    compression="zip",
    enqueue=True,
)
if not _IS_BUNDLE:
    logger.add(
        str(_dev_log_dir / "llm_trace.jsonl"),
        level="DEBUG",
        filter=lambda r: r["extra"].get("llm_trace", False),
        format="{message}",
        rotation="20 MB",
        retention="14 days",
        compression="zip",
        enqueue=True,
    )

__all__ = ["logger"]
