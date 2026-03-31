from collections.abc import AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import verify_api_key
from app.database import get_db

__all__ = ["get_db", "verify_api_key", "DBSession", "AuthDep"]

# Type aliases for cleaner dependency injection
DBSession = Depends(get_db)
AuthDep = Depends(verify_api_key)
