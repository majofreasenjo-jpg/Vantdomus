"""
VG+2.2 — Tests de la Bandeja Inteligente v1.

Cubre el DoD del sprint: clasificación por reglas, creación de
DocumentRouteCandidate, confirmación humana antes de crear acciones, routing a
los destinos correctos, scoping household/persona y visibilidad por rol.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"
PASSWORD = "Smart-Inbox-2026!"


@pytest.fixture
def client(monkeypatch, tmp_path) -> TestClient:
    db_path = tmp_path / "smart-inbox-tests.db"
    monkeypatch.setenv("DB_PATH", str(db_path))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JWT_SECRET", "smart-inbox-tests-secret-32-chars-xx")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "smart-inbox-tests-mfa-key-32-chars-x")
    monkeypatch.setenv("VANTDOMUS_ALLOW_DEMO_SEED", "true")
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS", "testserver,localhost,127.0.0.1")
    monkeypatch.delenv("VANTDOMUS_MIN_PASSWORD_LENGTH", raising=False)

    sys.path.insert(0, str(API_ROOT))
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    main = importlib.import_module("app.main")
    with TestClient(main.app) as test_client:
        yield test_client


def _register_and_login(client: TestClient, email: str) -> str:
    r = client.post("/auth/register", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    r = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _bootstrap(client: TestClient, token: str) -> tuple[str, str]:
    r = client.post("/households", params={"name": "Familia Inbox"}, headers=_auth(token))
    assert r.status_code == 200, r.text
    hid = r.json()["id"]
    r = client.post(
        "/persons",
        params={"household_id": hid, "display_name": "Elena", "relation": "Abuela"},
        headers=_auth(token),
    )
    assert r.status_code in (200, 201), r.text
    return hid, r.json()["id"]


def _analyze(client, token, hid, text, person_id=""):
    r = client.post(
        "/smart_inbox/analyze",
        data={"household_id": hid, "person_id": person_id, "pasted_text": text},
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    return r.json()


def _med_count(client, token, hid) -> int:
    r = client.get(
        "/unit_functions",
        params={"household_id": hid, "category": "medication", "limit": 200},
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    return len(r.json().get("items", []))


# 1
def test_receta_text_creates_prescription_candidate(client):
    token = _register_and_login(client, "rx1@example.com")
    hid, pid = _bootstrap(client, token)
    cand = _analyze(client, token, hid, "Receta: tomar Losartan 50mg cada 12 horas", pid)
    assert cand["route_type"] == "prescription_to_medication"
    assert cand["status"] == "pending"


# 2 + 3
def test_receta_creates_medication_only_after_confirm(client):
    token = _register_and_login(client, "rx2@example.com")
    hid, pid = _bootstrap(client, token)
    before = _med_count(client, token, hid)
    cand = _analyze(client, token, hid, "Receta medicamento: Aspirina 100mg, tomar 1 dosis", pid)
    # Aún no se creó la función: solo el candidato.
    assert _med_count(client, token, hid) == before
    r = client.post(f"/smart_inbox/candidates/{cand['id']}/confirm", json={"overrides": {}}, headers=_auth(token))
    assert r.status_code == 200, r.text
    assert _med_count(client, token, hid) == before + 1
    # La medication creada queda pendiente de confirmación humana.
    uf_id = r.json()["result_id"]
    got = client.get(f"/unit_functions/{uf_id}", headers=_auth(token)).json()
    assert got["category"] == "medication"
    assert got["ai_needs_confirmation"] is True


# 4
def test_boleta_creates_receipt_candidate(client):
    token = _register_and_login(client, "bo1@example.com")
    hid, pid = _bootstrap(client, token)
    cand = _analyze(client, token, hid, "Boleta supermercado total 45.990 CLP IVA", "")
    assert cand["route_type"] == "receipt_to_finance"
    assert (cand["proposed_payload"].get("amount") or 0) > 0


# 5
def test_circular_creates_study_candidate(client):
    token = _register_and_login(client, "sc1@example.com")
    hid, pid = _bootstrap(client, token)
    cand = _analyze(client, token, hid, "Circular colegio: prueba de matematicas y entrega de trabajo", pid)
    assert cand["route_type"] == "school_notice_to_study"


# 6
def test_unclassified_general_archive(client):
    token = _register_and_login(client, "ga1@example.com")
    hid, pid = _bootstrap(client, token)
    cand = _analyze(client, token, hid, "hola, todo bien por aca", "")
    assert cand["route_type"] == "general_archive"


# 7
def test_reject_does_not_create(client):
    token = _register_and_login(client, "rej@example.com")
    hid, pid = _bootstrap(client, token)
    before = _med_count(client, token, hid)
    cand = _analyze(client, token, hid, "Receta: Metformina 850mg cada 12 horas", pid)
    r = client.post(f"/smart_inbox/candidates/{cand['id']}/reject", json={"reason": "no", "keep_as_learning": True}, headers=_auth(token))
    assert r.status_code == 200, r.text
    assert _med_count(client, token, hid) == before  # no se creó nada


# 8
def test_confirm_creates_correct_destination_finance(client):
    token = _register_and_login(client, "fin@example.com")
    hid, pid = _bootstrap(client, token)
    n0 = len(client.get("/finance/expenses", params={"household_id": hid}, headers=_auth(token)).json().get("items", []))
    cand = _analyze(client, token, hid, "Boleta farmacia total 12.500 CLP", "")
    r = client.post(f"/smart_inbox/candidates/{cand['id']}/confirm", json={"overrides": {"category": "health"}}, headers=_auth(token))
    assert r.status_code == 200, r.text
    assert r.json()["result_type"] == "expense"
    n1 = len(client.get("/finance/expenses", params={"household_id": hid}, headers=_auth(token)).json().get("items", []))
    assert n1 == n0 + 1


# 9
def test_candidate_respects_household_and_person(client):
    token = _register_and_login(client, "scope@example.com")
    hid, pid = _bootstrap(client, token)
    cand = _analyze(client, token, hid, "Receta: Enalapril 10mg cada 12 horas", pid)
    assert cand["household_id"] == hid
    assert cand["person_id"] == pid


# 10
def test_member_does_not_see_private_candidate(client):
    owner = _register_and_login(client, "owner10@example.com")
    hid, pid = _bootstrap(client, owner)
    # Candidato privado (asignado a una persona).
    _analyze(client, owner, hid, "Receta: Losartan 50mg cada 12 horas", pid)
    # Segundo usuario, agregado como member (sin persona vinculada).
    member = _register_and_login(client, "member10@example.com")
    r = client.post(f"/households/{hid}/members", json={"email": "member10@example.com", "role": "member"}, headers=_auth(owner))
    assert r.status_code in (200, 201), r.text
    # El member NO ve el candidato privado de otra persona.
    seen = client.get("/smart_inbox/candidates", params={"household_id": hid}, headers=_auth(member))
    assert seen.status_code == 200, seen.text
    assert len(seen.json()["items"]) == 0
    # El owner sí lo ve.
    owner_seen = client.get("/smart_inbox/candidates", params={"household_id": hid}, headers=_auth(owner))
    assert len(owner_seen.json()["items"]) == 1
