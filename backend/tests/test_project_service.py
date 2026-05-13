"""
Unit tests for project_service using an in-memory SQLite database.
Tests create/get/update/list/delete without touching the real DB file.
"""
import uuid
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.models.project import Project, ProjectStatus
from app.models import (  # ensure all ORM models are registered
    Candidate, ConversationLog, PreferenceLog, ProjectCandidate,
    ProjectResearch, SkillOntology,
)
from app.database import Base
from app.schemas.project import ProjectCreate, ProjectUpdate
from app import services


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def db() -> AsyncSession:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await engine.dispose()


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_create(client="ACME", name="CTO Search", jd=None) -> ProjectCreate:
    return ProjectCreate(client_name=client, project_name=name, jd_raw=jd)


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestCreateProject:
    async def test_creates_project(self, db):
        project = await services.project_service.create_project(db, make_create())
        assert isinstance(project.id, uuid.UUID)
        assert project.client_name == "ACME"
        assert project.project_name == "CTO Search"
        assert project.status == ProjectStatus.ACTIVE

    async def test_no_mode_attribute(self, db):
        project = await services.project_service.create_project(db, make_create())
        assert not hasattr(project, "mode"), "Project ORM object must not have a mode attribute"

    async def test_jd_stored(self, db):
        project = await services.project_service.create_project(db, make_create(jd="We need a CTO."))
        assert project.jd_raw == "We need a CTO."


class TestGetProject:
    async def test_returns_project(self, db):
        created = await services.project_service.create_project(db, make_create())
        fetched = await services.project_service.get_project(db, created.id)
        assert fetched is not None
        assert fetched.id == created.id

    async def test_returns_none_for_unknown_id(self, db):
        result = await services.project_service.get_project(db, uuid.uuid4())
        assert result is None


class TestListProjects:
    async def test_empty_list(self, db):
        result = await services.project_service.list_projects(db)
        assert result == []

    async def test_multiple_projects(self, db):
        await services.project_service.create_project(db, make_create("A", "Job A"))
        await services.project_service.create_project(db, make_create("B", "Job B"))
        result = await services.project_service.list_projects(db)
        assert len(result) == 2


class TestUpdateProject:
    async def test_update_client_name(self, db):
        project = await services.project_service.create_project(db, make_create())
        updated = await services.project_service.update_project(
            db, project.id, ProjectUpdate(client_name="NewCorp")
        )
        assert updated is not None
        assert updated.client_name == "NewCorp"

    async def test_update_status(self, db):
        project = await services.project_service.create_project(db, make_create())
        updated = await services.project_service.update_project(
            db, project.id, ProjectUpdate(status=ProjectStatus.COMPLETED)
        )
        assert updated.status == ProjectStatus.COMPLETED

    async def test_update_nonexistent_returns_none(self, db):
        result = await services.project_service.update_project(
            db, uuid.uuid4(), ProjectUpdate(client_name="X")
        )
        assert result is None


class TestDeleteProject:
    async def test_delete_existing(self, db):
        project = await services.project_service.create_project(db, make_create())
        deleted = await services.project_service.delete_project(db, project.id)
        assert deleted is True
        assert await services.project_service.get_project(db, project.id) is None

    async def test_delete_nonexistent(self, db):
        result = await services.project_service.delete_project(db, uuid.uuid4())
        assert result is False
