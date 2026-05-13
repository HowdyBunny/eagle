"""
Unit tests for project Pydantic schemas.
Verifies that mode has been fully removed and schema validation works correctly.
"""
import pytest
from pydantic import ValidationError

from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.models.project import ProjectStatus


class TestProjectCreate:
    def test_minimal_valid(self):
        p = ProjectCreate(client_name="Acme", project_name="CTO Search")
        assert p.client_name == "Acme"
        assert p.project_name == "CTO Search"
        assert p.jd_raw is None
        assert p.requirement_profile is None

    def test_with_jd(self):
        p = ProjectCreate(client_name="Acme", project_name="CTO", jd_raw="Looking for a CTO...")
        assert p.jd_raw == "Looking for a CTO..."

    def test_mode_field_does_not_exist(self):
        # After removing ProjectMode, passing mode should be silently ignored
        # (extra fields are ignored by default in Pydantic) or raise ValidationError.
        # Either way, the schema must NOT have a mode attribute.
        p = ProjectCreate(client_name="X", project_name="Y")
        assert not hasattr(p, "mode")

    def test_missing_required_fields_raises(self):
        with pytest.raises(ValidationError):
            ProjectCreate(project_name="CTO Search")  # client_name missing

        with pytest.raises(ValidationError):
            ProjectCreate(client_name="Acme")  # project_name missing


class TestProjectUpdate:
    def test_all_optional(self):
        p = ProjectUpdate()
        assert p.client_name is None
        assert p.project_name is None
        assert p.status is None

    def test_status_update(self):
        p = ProjectUpdate(status=ProjectStatus.COMPLETED)
        assert p.status == ProjectStatus.COMPLETED

    def test_mode_field_does_not_exist(self):
        p = ProjectUpdate(client_name="New Name")
        assert not hasattr(p, "mode")


class TestProjectResponse:
    def test_mode_field_does_not_exist(self):
        fields = ProjectResponse.model_fields
        assert "mode" not in fields, "mode field must be removed from ProjectResponse"

    def test_required_fields_present(self):
        fields = ProjectResponse.model_fields
        for field in ("id", "client_name", "project_name", "status", "created_at", "updated_at"):
            assert field in fields


class TestProjectStatus:
    def test_valid_values(self):
        assert ProjectStatus("active") == ProjectStatus.ACTIVE
        assert ProjectStatus("completed") == ProjectStatus.COMPLETED
        assert ProjectStatus("archived") == ProjectStatus.ARCHIVED

    def test_project_mode_not_importable(self):
        import app.models.project as project_module
        assert not hasattr(project_module, "ProjectMode"), (
            "ProjectMode enum must be fully removed from app.models.project"
        )
