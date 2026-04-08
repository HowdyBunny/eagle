"""
File-system path utilities for Eagle.

Directory layout (relative to EAGLE_BASE_DIR, default ~/Desktop/Eagle):
  Eagle/
  ├── projects/
  │   ├── 2026-03-某科技/          ← per-project folder (created on project creation)
  │   │   └── reports/             ← RA-generated Markdown reports (export copies)
  │   └── 2026-03-另一客户-a1b2c3d4/
  └── data/
      └── postgres/                ← PostgreSQL Docker bind-mount volume
"""

import re
import uuid
from datetime import datetime
from pathlib import Path

from app.config import settings


def eagle_dir() -> Path:
    return Path(settings.EAGLE_BASE_DIR).expanduser()


def projects_dir() -> Path:
    d = eagle_dir() / "projects"
    d.mkdir(parents=True, exist_ok=True)
    return d


def data_dir() -> Path:
    d = eagle_dir() / "data"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _sanitize(name: str) -> str:
    """Strip chars that are invalid in folder names on both Mac and Windows."""
    name = re.sub(r'[\\/:*?"<>|]', "_", name)
    name = name.strip(". ")
    return name[:40] or "project"


def make_project_dir(client_name: str, created_at: datetime, project_id: uuid.UUID) -> Path:
    """
    Create and return a project folder under Eagle/projects/.

    Naming: YYYY-MM-{client_name}
    If that folder already exists (same client, same month), appends -{id[:8]}
    to guarantee uniqueness.
    """
    month = created_at.strftime("%Y-%m")
    safe_client = _sanitize(client_name)
    folder_name = f"{month}-{safe_client}"
    path = projects_dir() / folder_name
    if path.exists():
        folder_name = f"{month}-{safe_client}-{str(project_id)[:8]}"
        path = projects_dir() / folder_name
    path.mkdir(parents=True, exist_ok=True)
    (path / "reports").mkdir(exist_ok=True)
    return path


def rename_project_dir(
    old_path: Path, new_client_name: str, created_at: datetime, project_id: uuid.UUID
) -> Path | None:
    """
    Rename an existing project folder to reflect a new client name.
    Returns the new Path on success, None if old_path doesn't exist.
    If the target name already exists, appends -{id[:8]} to guarantee uniqueness.
    """
    if not old_path.exists():
        return None
    month = created_at.strftime("%Y-%m")
    safe_client = _sanitize(new_client_name)
    folder_name = f"{month}-{safe_client}"
    new_path = projects_dir() / folder_name
    if new_path.exists() and new_path != old_path:
        folder_name = f"{month}-{safe_client}-{str(project_id)[:8]}"
        new_path = projects_dir() / folder_name
    if new_path != old_path:
        old_path.rename(new_path)
    return new_path
