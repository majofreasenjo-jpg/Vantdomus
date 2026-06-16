"""
Unit tests for the path-traversal guard in apps/api/app/routes/vision.py.

These tests target the pure helper `_resolve_intake_subdir`, not the FastAPI
route, so they don't need the full app fixture. The previous vision code
let any authenticated member call `os.walk(req.target_directory)` against
an arbitrary host path; the helper now restricts walking to the tenant's
private intake root.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest


API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"


@pytest.fixture
def helpers(monkeypatch, tmp_path):
    """Import vision.py with minimal env so we get `_resolve_intake_subdir`."""
    monkeypatch.setenv("DB_PATH", str(tmp_path / "vision.db"))
    monkeypatch.setenv("JWT_SECRET", "vision-test-secret-32-characters-long")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "vision-test-mfa-key-32-characters-x")
    sys.path.insert(0, str(API_ROOT))
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]
    return importlib.import_module("app.routes.vision")


def test_resolve_accepts_existing_subdir(helpers, tmp_path):
    (tmp_path / "incoming").mkdir()
    result = helpers._resolve_intake_subdir(tmp_path, "incoming")
    assert result == (tmp_path / "incoming").resolve()


def test_resolve_accepts_nested_subdir(helpers, tmp_path):
    (tmp_path / "incoming" / "q4").mkdir(parents=True)
    result = helpers._resolve_intake_subdir(tmp_path, "incoming/q4")
    assert result == (tmp_path / "incoming" / "q4").resolve()


def test_resolve_rejects_dotdot_traversal(helpers, tmp_path):
    with pytest.raises(helpers.HTTPException) as exc:
        helpers._resolve_intake_subdir(tmp_path, "../../etc")
    assert exc.value.status_code == 400


def test_resolve_rejects_lone_dotdot(helpers, tmp_path):
    with pytest.raises(helpers.HTTPException):
        helpers._resolve_intake_subdir(tmp_path, "..")


def test_resolve_rejects_backslash_traversal(helpers, tmp_path):
    # Windows-style traversal MUST be caught even on Linux/CI hosts because
    # we know the same code path runs on developer Windows machines.
    with pytest.raises(helpers.HTTPException):
        helpers._resolve_intake_subdir(tmp_path, "incoming\\..\\..\\etc")


def test_resolve_treats_leading_slash_as_relative(helpers, tmp_path):
    # `/etc/passwd` gets the leading slash stripped and is joined under
    # the intake root, so it CANNOT escape. The resolved path stays
    # inside the tenant area.
    (tmp_path / "etc").mkdir()
    (tmp_path / "etc" / "passwd").write_text("synthetic")
    result = helpers._resolve_intake_subdir(tmp_path, "/etc/passwd")
    assert str(result).startswith(str(tmp_path))


def test_resolve_empty_string_returns_root(helpers, tmp_path):
    result = helpers._resolve_intake_subdir(tmp_path, "")
    assert result == tmp_path


def test_resolve_whitespace_only_returns_root(helpers, tmp_path):
    result = helpers._resolve_intake_subdir(tmp_path, "   ")
    assert result == tmp_path
