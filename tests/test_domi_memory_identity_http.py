"""DOMI R97 H4-08: genuine HTTP authentication cannot be replaced by supplied identity fields.

Run: python -m pytest tests/test_domi_memory_identity_http.py -q
Uses a disposable SQLite database and MockProvider, no external calls.
"""
from __future__ import annotations

import importlib
import sys
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"
PASSWORD = "Domi-Identity-2026!"


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("VANTDOMUS_SKIP_LOCAL_ENV", "1")
    monkeypatch.setenv("DB_PATH", str(tmp_path / "domi-h4-identity.db"))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JWT_SECRET", "domi-h4-identity-test-secret-32-chars")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "domi-h4-mfa-secret-key-32-characters")
    monkeypatch.setenv("VANTDOMUS_ALLOW_DEMO_SEED", "true")
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS", "testserver,localhost,127.0.0.1")
    for name in ("ASSISTANT_PROVIDER", "ASSISTANT_PROVIDER_MODE",
                 "ASSISTANT_REAL_PROVIDER_ENABLED", "ASSISTANT_EXTERNAL_CALLS_ALLOWED",
                 "OPENAI_API_KEY"):
        monkeypatch.delenv(name, raising=False)
    sys.path.insert(0, str(API_ROOT))
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]
    main = importlib.import_module("app.main")
    with TestClient(main.app) as test_client:
        yield test_client


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _register_login(client, email):
    res = client.post("/auth/register", json={"email": email, "password": PASSWORD})
    assert res.status_code == 200, res.text
    res = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def test_client_supplied_identity_cannot_impersonate_another_person(client):
    from app.db import connect

    token_a = _register_login(client, "h4-ana@example.com")
    token_b = _register_login(client, "h4-bruno@example.com")
    result = client.post("/households", params={"name": "H4 familia"}, headers=_auth(token_a))
    assert result.status_code == 200, result.text
    hid = result.json()["id"]

    db = connect()
    try:
        a_uid = db.execute("SELECT id FROM users WHERE email=?", ("h4-ana@example.com",)).fetchone()["id"]
        b_uid = db.execute("SELECT id FROM users WHERE email=?", ("h4-bruno@example.com",)).fetchone()["id"]
        db.execute(
            "INSERT INTO household_memberships (household_id,user_id,role,created_at) VALUES (?,?,?,?)",
            (hid, b_uid, "member", "2026-11-16T00:00:00Z"),
        )
        a_pid, b_pid = str(uuid.uuid4()), str(uuid.uuid4())
        for pid, name, uid in ((a_pid, "Ana", a_uid), (b_pid, "Bruno", b_uid)):
            db.execute(
                "INSERT INTO persons (id,household_id,display_name,user_id,created_at) VALUES (?,?,?,?,?)",
                (pid, hid, name, uid, "2026-11-16T00:00:00Z"),
            )
        db.commit()
    finally:
        db.close()

    created = client.post(
        "/assistant/memory",
        json={"household_id": hid, "memory_type": "preference",
              "content": "clave privada de Ana H4", "person_id": a_pid,
              "visibility_scope": "private_self"},
        headers=_auth(token_a),
    )
    assert created.status_code == 200, created.text
    mid = created.json()["id"]

    own = client.get("/assistant/memory", params={"household_id": hid}, headers=_auth(token_a))
    assert own.status_code == 200, own.text
    assert any(item["id"] == mid for item in own.json()["items"])

    # Adversary provides the victim person ID; backend identity must come from session.
    spoof = {"household_id": hid, "requester_person_id": a_pid,
             "requester_user_id": a_uid, "requester_role": "owner", "person_id": a_pid}
    for path in ("/assistant/memory", "/assistant/memory/library", "/assistant/memory/export"):
        response = client.get(path, params=spoof, headers=_auth(token_b))
        assert response.status_code == 200, response.text
        assert "clave privada de Ana H4" not in response.text
        assert mid not in response.text

    changed = client.post(
        f"/assistant/memory/{mid}/correct",
        json={"household_id": hid, "content": "intento suplantacion",
              "requester_person_id": a_pid, "requester_user_id": a_uid, "requester_role": "owner"},
        headers=_auth(token_b),
    )
    assert changed.status_code in (403, 404), changed.text
    deleted = client.delete(
        f"/assistant/memory/{mid}", params=spoof, headers=_auth(token_b))
    assert deleted.status_code in (403, 404), deleted.text

    # The victim still owns the original unchanged memory.
    own_again = client.get("/assistant/memory", params={"household_id": hid}, headers=_auth(token_a))
    assert own_again.status_code == 200, own_again.text
    assert any(item["id"] == mid and item["content"] == "clave privada de Ana H4"
               for item in own_again.json()["items"])
