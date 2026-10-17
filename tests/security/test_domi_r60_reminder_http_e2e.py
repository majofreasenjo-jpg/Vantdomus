"""DOMI R60: real HTTP + SQLite synthetic reminder life-cycle (zero network).

Uses the existing /assistant/chat and /assistant/proposals/{id}/confirm routes.
Only the *provider's* text interpretation is mocked; permission, persistence,
tenant access, timestamps, status transitions, dedupe and HTTP are real.
No Anthropic key, user memory, Neon branch, Vercel or Render is accessed.
"""
from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

API_ROOT = Path(__file__).resolve().parents[2] / "apps" / "api"
PASSWORD = "SyntheticR60-Password-2026!"
AWARE_DATE = "2030-11-10T19:00:00-03:00"
TITLE = "Reunion familiar ficticia"


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("VANTDOMUS_SKIP_LOCAL_ENV", "1")
    monkeypatch.setenv("DB_PATH", str(tmp_path / "domi-r60-reminders.db"))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JWT_SECRET", "domi-r60-jwt-test-secret-32-chars!")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "domi-r60-mfa-test-secret-32-char")
    monkeypatch.setenv("VANTDOMUS_ALLOW_DEMO_SEED", "true")
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS", "testserver,localhost,127.0.0.1")
    monkeypatch.setenv("ASSISTANT_PROVIDER_MODE", "mock")
    monkeypatch.setenv("ASSISTANT_REAL_PROVIDER_ENABLED", "false")
    monkeypatch.setenv("ASSISTANT_EXTERNAL_CALLS_ALLOWED", "false")
    monkeypatch.setenv("ASSISTANT_SHADOW_MODE", "false")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ASSISTANT_LEGACY_DIRECT_EXEC", raising=False)

    sys.path.insert(0, str(API_ROOT))
    for module in list(sys.modules):
        if module == "app" or module.startswith("app."):
            del sys.modules[module]
    main = importlib.import_module("app.main")
    with TestClient(main.app) as test_client:
        yield test_client


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _owner(client, email):
    r = client.post("/auth/register", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    r = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    r = client.post("/households", params={"name": "Familia de prueba R60"},
                    headers=_headers(token))
    assert r.status_code == 200, r.text
    return token, r.json()["id"]


def _provider(monkeypatch, *, title=TITLE, date=AWARE_DATE, missing_date=False):
    from app.assistant.providers.mock import MockProvider
    from app.assistant.providers.base import ProviderResult, ProposedAction

    def stub(self, *, user_message, context, catalog):
        assert any(t["name"] == "propose_family_reminder" for t in catalog)
        payload = {"title": title}
        if not missing_date:
            payload["remind_at"] = date
        return ProviderResult(
            reply="Puedo proponer el recordatorio, confirma para guardarlo.",
            proposals=[ProposedAction(
                tool_name="propose_family_reminder", category="family",
                title="Propuesta ficticia de recordatorio",
                summary="No se ejecuta sin confirmacion humana",
                payload=payload,
            )],
        )

    monkeypatch.setattr(MockProvider, "propose", stub)


def _chat(client, token, hid):
    r = client.post("/assistant/chat", headers=_headers(token),
                    json={"household_id": hid, "messages": [
                        {"role": "user", "content": "recordatorio ficticio"}
                    ]})
    assert r.status_code == 200, r.text
    return r.json()


def _rows(hid):
    from app.db import connect
    conn = connect()
    try:
        return [dict(row) for row in conn.execute(
            "SELECT * FROM family_reminders WHERE household_id=? ORDER BY created_at",
            (hid,)
        ).fetchall()]
    finally:
        conn.close()


def _confirm(client, token, proposal, overrides=None):
    return client.post(
        f"/assistant/proposals/{proposal['id']}/confirm",
        json={"overrides": overrides or {}}, headers=_headers(token)
    )


def test_r60_pending_then_one_confirm_creates_one_reminder(client, monkeypatch):
    token, hid = _owner(client, "r60one@example.com")
    _provider(monkeypatch)
    proposal = _chat(client, token, hid)["proposals"][0]
    assert proposal["status"] == "pending"
    assert proposal["requires_confirmation"] is True
    assert proposal["tool_name"] == "propose_family_reminder"
    assert _rows(hid) == [], "Chat must not create any reminder automatically"

    accepted = _confirm(client, token, proposal)
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["proposal"]["status"] == "executed"
    rows = _rows(hid)
    assert len(rows) == 1
    assert rows[0]["title"] == TITLE
    assert rows[0]["visibility_scope"] == "household_shared"
    assert rows[0]["status"] == "pending"
    assert rows[0]["remind_at"] == "2030-11-10T22:00:00+00:00"
    assert rows[0]["dedupe_key"] == "assistant-proposal-" + proposal["id"]

    repeated = _confirm(client, token, proposal)
    assert repeated.status_code == 200
    assert repeated.json()["already_executed"] is True
    assert len(_rows(hid)) == 1


def test_r60_foreign_household_cannot_confirm_or_read(client, monkeypatch):
    owner, hid_a = _owner(client, "r60owner@example.com")
    other, hid_b = _owner(client, "r60other@example.com")
    _provider(monkeypatch)
    proposal = _chat(client, owner, hid_a)["proposals"][0]

    assert _confirm(client, other, proposal).status_code == 403
    assert client.get("/assistant/proposals",
                      params={"household_id": hid_a, "status": "all"},
                      headers=_headers(other)).status_code == 403
    assert client.get("/assistant/reminders", params={"household_id": hid_a},
                      headers=_headers(other)).status_code == 403
    assert _rows(hid_a) == []
    assert _rows(hid_b) == []
    assert _confirm(client, owner, proposal).status_code == 200
    visible = client.get("/assistant/reminders", params={"household_id": hid_a},
                         headers=_headers(owner))
    assert visible.status_code == 200
    assert any(r["title"] == TITLE for r in visible.json()["items"])
    assert _rows(hid_b) == []


def test_r60_rejection_is_terminal_without_reminder(client, monkeypatch):
    token, hid = _owner(client, "r60reject@example.com")
    _provider(monkeypatch)
    proposal = _chat(client, token, hid)["proposals"][0]
    rejected = client.post(f"/assistant/proposals/{proposal['id']}/reject",
                           headers=_headers(token))
    assert rejected.status_code == 200
    assert rejected.json()["proposal"]["status"] == "rejected"
    assert _confirm(client, token, proposal).status_code == 409
    assert _rows(hid) == []


@pytest.mark.parametrize("invalid_date", [
    "2030-11-10T19:00:00",       # ambiguous timezone
    "tomorrow at 19:00",         # relative without reference timezone
    "2000-01-01T00:00:00Z",      # in the past
])
def test_r60_invalid_or_past_dates_fail_before_write(
    client, monkeypatch, invalid_date
):
    token, hid = _owner(client, "r60invalid@example.com")
    _provider(monkeypatch, date=invalid_date)
    proposal = _chat(client, token, hid)["proposals"][0]
    rejected = _confirm(client, token, proposal)
    assert rejected.status_code == 400, rejected.text
    assert _rows(hid) == []
    failed = client.get("/assistant/proposals",
                        params={"household_id": hid, "status": "failed"},
                        headers=_headers(token))
    assert failed.status_code == 200
    assert any(p["id"] == proposal["id"] for p in failed.json()["items"])


def test_r60_failed_reminder_can_be_fixed_by_confirming_edited_date(client, monkeypatch):
    token, hid = _owner(client, "r60edit@example.com")
    _provider(monkeypatch, date="2030-11-10T19:00:00")
    proposal = _chat(client, token, hid)["proposals"][0]
    assert _confirm(client, token, proposal).status_code == 400
    fixed = _confirm(client, token, proposal, overrides={"remind_at": AWARE_DATE})
    assert fixed.status_code == 200, fixed.text
    assert fixed.json()["proposal"]["status"] == "executed"
    assert len(_rows(hid)) == 1


def test_r60_foreign_household_override_rejected(client, monkeypatch):
    token, hid = _owner(client, "r60override@example.com")
    _provider(monkeypatch)
    proposal = _chat(client, token, hid)["proposals"][0]
    rejected = _confirm(client, token, proposal,
                        overrides={"household_id": "an-unrelated-household"})
    assert rejected.status_code == 400
    assert _rows(hid) == []
    assert _confirm(client, token, proposal).status_code == 200
    assert len(_rows(hid)) == 1


def test_r60_missing_required_date_rejected_at_gateway(client, monkeypatch):
    token, hid = _owner(client, "r60missing@example.com")
    _provider(monkeypatch, missing_date=True)
    out = _chat(client, token, hid)
    assert out["proposals"] == [], "Malformed model output must never persist"
    assert _rows(hid) == []
