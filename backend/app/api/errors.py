from fastapi import APIRouter
from pydantic import BaseModel

from app.utils.logger import logger

router = APIRouter(prefix="/errors", tags=["errors"])


class ClientError(BaseModel):
    message: str
    source: str | None = None   # file:line
    stack: str | None = None
    context: str | None = None  # e.g. "ErrorBoundary: ProjectDetailPage"


@router.post("", status_code=204)
async def report_client_error(payload: ClientError) -> None:
    """Receive a frontend JS error and write it to eagle.log."""
    logger.error(
        "[frontend] {message} | source={source} | context={context}\n{stack}",
        message=payload.message,
        source=payload.source or "unknown",
        context=payload.context or "",
        stack=payload.stack or "",
    )
