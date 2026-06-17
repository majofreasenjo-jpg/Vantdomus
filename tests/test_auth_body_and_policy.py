"""
Tests for the auth surface after the security hardening pass:

1. /auth/login and /auth/register accept JSON body (preferred form).
2. The legacy query-string form still works (backwards-compat) so
   in-flight clients don't break on the rollout window.
3. The password policy rejects common weak passwords, short passwords,
   passwords containing the email's local part, and passwords without
   enough character-class diversity.
4. The login redirect helper rejects open-redirect payloads.
   (Tested in JS-land separately; this file is the Python side.)

The fixture mirrors tests/security/test_tenant_isolation.py so a future
maintainer can copy-paste the bootstrap.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"


# ----------------------------------------------------------------------
# Fixture
# ----------------------------------------------------------------------
@pytest.fixture
def client(monkeypatch, tmp_path) -> TestClient:
    """Boot the API with a throwaway SQLite DB and a known JWT secret."""
    db_path = tmp_path / "auth-tests.db"
    monkeypatch.setenv("DB_PATH", str(db_path))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JWT_SECRET", "auth-body-tests-secret-32-chars-min")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "auth-body-tests-mfa-secret-key-32x")
    # El TestClient usa el host "testserver"; permitilo explícitamente para no
    # depender de un .env local (TrustedHostMiddleware lo rechazaría si no).
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS", "testserver,localhost,127.0.0.1")
    # The default policy is min 10 chars; we don't override it because the
    # whole point of this file is to test the default.
    monkeypatch.delenv("VANTDOMUS_MIN_PASSWORD_LENGTH", raising=False)

    sys.path.insert(0, str(API_ROOT))
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    main = importlib.import_module("app.main")
    # Usar el TestClient como context manager dispara el lifespan
    # (initialize_app_state → migraciones). Sin esto, la DB temporal
    # queda sin tablas y todo falla con "no such table".
    with TestClient(main.app) as test_client:
        yield test_client


GOOD_PASSWORD = "Strong-Operator-Pass-2026!"


# ----------------------------------------------------------------------
# Body vs query backwards-compat
# ----------------------------------------------------------------------
def test_register_with_json_body_succeeds(client: TestClient):
    res = client.post(
        "/auth/register",
        json={"email": "body-user@example.com", "password": GOOD_PASSWORD},
    )
    assert res.status_code == 200, res.text
    payload = res.json()
    assert "user_id" in payload


def test_register_with_query_string_still_works(client: TestClient):
    # Backwards-compat path: clients that still send creds in the URL
    # should keep working until the API metrics show no traffic on it.
    res = client.post(
        "/auth/register",
        params={"email": "query-user@example.com", "password": GOOD_PASSWORD},
    )
    assert res.status_code == 200, res.text


def test_login_with_json_body_succeeds(client: TestClient):
    email = "login-body@example.com"
    client.post("/auth/register", json={"email": email, "password": GOOD_PASSWORD})

    res = client.post(
        "/auth/login",
        json={"email": email, "password": GOOD_PASSWORD},
    )
    assert res.status_code == 200, res.text
    assert "access_token" in res.json()


def test_login_with_query_string_still_works(client: TestClient):
    email = "login-query@example.com"
    client.post("/auth/register", json={"email": email, "password": GOOD_PASSWORD})

    res = client.post(
        "/auth/login",
        params={"email": email, "password": GOOD_PASSWORD},
    )
    assert res.status_code == 200, res.text


def test_login_body_takes_precedence_over_query(client: TestClient):
    # If both body and query are sent, the body wins. This is the
    # contract documented in _resolve_credentials in apps/api/app/routes/auth.py.
    email = "precedence@example.com"
    client.post("/auth/register", json={"email": email, "password": GOOD_PASSWORD})

    res = client.post(
        "/auth/login",
        params={"email": email, "password": "totally-wrong-but-ignored"},
        json={"email": email, "password": GOOD_PASSWORD},
    )
    assert res.status_code == 200, res.text


def test_login_missing_everything_is_400(client: TestClient):
    res = client.post("/auth/login")
    assert res.status_code == 400


# ----------------------------------------------------------------------
# Password policy
# ----------------------------------------------------------------------
@pytest.mark.parametrize(
    "weak_password,reason_substring",
    [
        ("Short9!", "at least"),          # too short
        ("password123", "mix"),           # lowercase+digits = solo 2 clases (regla de complejidad)
        ("aaaaaaaaaaaa", "mix"),          # one class
        ("AAAAAAAAAAAA", "mix"),          # one class
        ("123456789012", "mix"),          # one class
        ("policyusertest", "mix"),        # one class (lowercase only)
    ],
)
def test_register_rejects_weak_password(client: TestClient, weak_password, reason_substring):
    res = client.post(
        "/auth/register",
        json={"email": "weak@example.com", "password": weak_password},
    )
    assert res.status_code == 400, res.text
    detail = res.json()["detail"].lower()
    assert reason_substring in detail, f"Got: {detail}"


def test_register_rejects_password_containing_email_local_part(client: TestClient):
    res = client.post(
        "/auth/register",
        json={"email": "manuel@example.com", "password": "ManuelManuelManuel!"},
    )
    assert res.status_code == 400, res.text
    assert "email" in res.json()["detail"].lower()


def test_register_accepts_long_passphrase_without_symbol(client: TestClient):
    # 16+ chars without symbol is allowed (passphrase-style).
    res = client.post(
        "/auth/register",
        json={
            "email": "passphrase@example.com",
            "password": "Operations Mining Antucoya Q4",
        },
    )
    assert res.status_code == 200, res.text


def test_register_accepts_short_with_three_classes(client: TestClient):
    # Exactly 10 chars, 3 classes: lower + upper + digit. Passes.
    res = client.post(
        "/auth/register",
        json={"email": "threecls@example.com", "password": "Abcd123XYZ"},
    )
    assert res.status_code == 200, res.text
