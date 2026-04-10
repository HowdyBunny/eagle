import sys

from loguru import logger

from app.config import settings

logger.remove()
logger.add(
    sys.stderr,
    level=settings.LOG_LEVEL,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    colorize=True,
)
logger.add(
    "logs/eagle.log",
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
    "logs/llm_trace.jsonl",
    level="DEBUG",
    filter=lambda r: r["extra"].get("llm_trace", False),
    format="{message}",
    rotation="20 MB",
    retention="14 days",
    compression="zip",
    enqueue=True,
)

__all__ = ["logger"]
