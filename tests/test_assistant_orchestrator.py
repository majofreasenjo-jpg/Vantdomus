"""
CP1c-FUNC-MIN-3.1 — Tests del AI Orchestrator seguro (propose-first).

Cubre los criterios de aceptación de ChatGPT:
- proveedor por defecto = mock (sin red / sin key);
- ejecución directa legacy neutralizada;
- lectura responde sin confirmación;
- escritura NO ejecuta: genera propuesta 'pending';
- confirmar ejecuta la acción real; rechazar no ejecuta nada;
- intención sensible/prohibida se bloquea sin propuesta;
- propuestas scoped por hogar; permisos respetados.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"
PASSWORD = "Orchestrator-2026!"


@pytest.fixture
def client(monkeypatch, tmp_path) -> TestClient:
    db_path = tmp_path / "orchestrator-tests.db"
    monkeypatch.setenv("DB_PATH", str(db_path))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JWT_SECRET", "orchestrator-tests-secret-32-chars-x")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "orchestrator-tests-mfa-key-32-chars")
    monkeypatch.setenv("VANTDOMUS_ALLOW_DEMO_SEED", "true")
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS", "testserver,localhost,127.0.0.1")
    # Asegurar que NO haya proveedor externo ni ejecución directa legacy.
    monkeypatch.delenv("ASSISTANT_PROVIDER", raising=False)
    monkeypatch.delenv("ASSISTANT_LEGACY_DIRECT_EXEC", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("VANTDOMUS_MIN_PASSWORD_LENGTH", raising=False)

    sys.path.insert(0, str(API_ROOT))
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    main = importlib.import_module("app.main")
    with TestClient(main.app) as test_client:
        yield test_client


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _register_and_login(client: TestClient, email: str) -> str:
    r = client.post("/auth/register", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    r = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _bootstrap(client: TestClient, token: str, name="Familia Orq") -> tuple[str, str]:
    r = client.post("/households", params={"name": name}, headers=_auth(token))
    assert r.status_code == 200, r.text
    hid = r.json()["id"]
    r = client.post("/persons", params={"household_id": hid, "display_name": "Diego", "relation": "Hijo"}, headers=_auth(token))
    assert r.status_code in (200, 201), r.text
    return hid, r.json()["id"]


def _chat(client, token, hid, text):
    r = client.post("/assistant/chat", json={"household_id": hid, "messages": [{"role": "user", "content": text}]}, headers=_auth(token))
    assert r.status_code == 200, r.text
    return r.json()


def _shopping_count(client, token, hid) -> int:
    r = client.get(f"/household_shopping/{hid}/items", headers=_auth(token))
    assert r.status_code == 200, r.text
    return len(r.json().get("items", []))


# 1 — proveedor por defecto = mock, sin red
def test_provider_default_is_mock(client):
    token = _register_and_login(client, "orq1@example.com")
    hid, _ = _bootstrap(client, token)
    out = _chat(client, token, hid, "hola, ¿quiénes son la familia?")
    assert out["provider"] == "mock"
    assert out["ok"] is True


# 2 — lectura responde SIN crear propuesta
def test_read_intent_no_proposal(client):
    token = _register_and_login(client, "orq2@example.com")
    hid, _ = _bootstrap(client, token)
    out = _chat(client, token, hid, "¿qué falta comprar?")
    assert out["proposals"] == []
    assert out["blocked"] is None


# 3 — escritura NO ejecuta: crea propuesta 'pending'
def test_write_intent_creates_pending_proposal_not_executed(client):
    token = _register_and_login(client, "orq3@example.com")
    hid, _ = _bootstrap(client, token)
    before = _shopping_count(client, token, hid)
    out = _chat(client, token, hid, "agrega leche y pan a la lista")
    assert len(out["proposals"]) == 1
    prop = out["proposals"][0]
    assert prop["status"] == "pending"
    assert prop["tool_name"] == "propose_shopping_item"
    assert prop["requires_confirmation"] is True
    # NO se ejecutó nada todavía.
    assert _shopping_count(client, token, hid) == before


# 4 — confirmar EJECUTA la acción real
def test_confirm_executes(client):
    token = _register_and_login(client, "orq4@example.com")
    hid, _ = _bootstrap(client, token)
    before = _shopping_count(client, token, hid)
    out = _chat(client, token, hid, "agrega leche y pan a la lista")
    pid = out["proposals"][0]["id"]
    r = client.post(f"/assistant/proposals/{pid}/confirm", json={"overrides": {}}, headers=_auth(token))
    assert r.status_code == 200, r.text
    assert r.json()["proposal"]["status"] == "executed"
    assert _shopping_count(client, token, hid) == before + 2  # leche + pan


# 5 — rechazar NO ejecuta
def test_reject_does_not_execute(client):
    token = _register_and_login(client, "orq5@example.com")
    hid, _ = _bootstrap(client, token)
    before = _shopping_count(client, token, hid)
    out = _chat(client, token, hid, "agrega azúcar a la lista")
    pid = out["proposals"][0]["id"]
    r = client.post(f"/assistant/proposals/{pid}/reject", headers=_auth(token))
    assert r.status_code == 200, r.text
    assert r.json()["proposal"]["status"] == "rejected"
    assert _shopping_count(client, token, hid) == before
    # Y no se puede confirmar algo ya rechazado.
    r2 = client.post(f"/assistant/proposals/{pid}/confirm", json={}, headers=_auth(token))
    assert r2.status_code == 409


# 6 — intención sensible/prohibida se bloquea sin propuesta
def test_blocked_intent_no_proposal(client):
    token = _register_and_login(client, "orq6@example.com")
    hid, _ = _bootstrap(client, token)
    for text, reason in [
        ("Diego ya tomó su medicamento, márcalo", "medication_intake"),
        ("transfiere 50 lucas a Juan", "move_money"),
        ("cómprame las zapatillas ahora", "make_purchase"),
        ("¿qué enfermedad tiene Diego?", "diagnose"),
        ("abre https://algo.cl", "fetch_url"),
    ]:
        out = _chat(client, token, hid, text)
        assert out["proposals"] == [], f"{text} no debería proponer"
        assert out["blocked"] == reason, f"{text} → {out['blocked']}"


# 7 — legacy direct-exec neutralizado
def test_legacy_direct_exec_disabled(client):
    from app.assistant.tools import execute_tool_call
    from app.assistant.service import run_agentic_chat, AssistantProviderError
    # execute_tool_call no toca la DB sin el flag.
    res = execute_tool_call(None, "hid", "register_financial_expense", {"amount": 999}, user_id="u")
    assert res.startswith("BLOCKED")
    # run_agentic_chat se niega sin el flag (aunque hubiera key).
    with pytest.raises(AssistantProviderError):
        run_agentic_chat(messages=[], model="x", temperature=0.0, db=None, household_id="hid")


# 8 — propuestas scoped por hogar (no se ven desde otro hogar)
def test_proposals_scoped_by_household(client):
    token = _register_and_login(client, "orq7@example.com")
    hid_a, _ = _bootstrap(client, token, "Hogar A")
    hid_b, _ = _bootstrap(client, token, "Hogar B")
    _chat(client, token, hid_a, "agrega café a la lista")
    la = client.get("/assistant/proposals", params={"household_id": hid_a, "status": "pending"}, headers=_auth(token)).json()
    lb = client.get("/assistant/proposals", params={"household_id": hid_b, "status": "pending"}, headers=_auth(token)).json()
    assert len(la["items"]) == 1
    assert len(lb["items"]) == 0


# 9 — confirmar requiere pertenecer al hogar (403 para extraños)
def test_confirm_requires_membership(client):
    owner = _register_and_login(client, "orq8owner@example.com")
    hid, _ = _bootstrap(client, owner)
    out = _chat(client, owner, hid, "agrega sal a la lista")
    pid = out["proposals"][0]["id"]
    stranger = _register_and_login(client, "orq8stranger@example.com")
    r = client.post(f"/assistant/proposals/{pid}/confirm", json={}, headers=_auth(stranger))
    assert r.status_code == 403


# =============================================================================
# CP1c-FUNC-MIN-3.2 — Hardening del ciclo de propuestas
# =============================================================================

def _propose_shopping(client, token, hid, text="agrega leche y pan a la lista"):
    out = _chat(client, token, hid, text)
    assert len(out["proposals"]) == 1
    return out["proposals"][0]


# 10 — doble confirm: idempotente, no duplica
def test_double_confirm_is_idempotent(client):
    token = _register_and_login(client, "m32a@example.com")
    hid, _ = _bootstrap(client, token)
    prop = _propose_shopping(client, token, hid)
    r1 = client.post(f"/assistant/proposals/{prop['id']}/confirm", json={}, headers=_auth(token))
    assert r1.status_code == 200 and r1.json()["proposal"]["status"] == "executed"
    n_after_first = _shopping_count(client, token, hid)
    # Segunda confirmación: respuesta segura, sin duplicar
    r2 = client.post(f"/assistant/proposals/{prop['id']}/confirm", json={}, headers=_auth(token))
    assert r2.status_code == 200, r2.text
    assert r2.json().get("already_executed") is True
    assert _shopping_count(client, token, hid) == n_after_first  # no duplicó


# 11 — expirada: confirmación bloqueada con copy claro
def test_expired_proposal_cannot_confirm(client):
    token = _register_and_login(client, "m32b@example.com")
    hid, _ = _bootstrap(client, token)
    prop = _propose_shopping(client, token, hid)
    # Vencerla directamente en DB (simula paso del tiempo)
    from app.db import connect
    con = connect()
    con.execute("UPDATE assistant_proposals SET expires_at='2000-01-01T00:00:00+00:00' WHERE id=?", (prop["id"],))
    con.commit(); con.close()
    before = _shopping_count(client, token, hid)
    r = client.post(f"/assistant/proposals/{prop['id']}/confirm", json={}, headers=_auth(token))
    assert r.status_code == 409, r.text
    assert "expir" in r.json()["detail"].lower()
    assert _shopping_count(client, token, hid) == before
    # Y quedó marcada expired (lazy)
    lst = client.get("/assistant/proposals", params={"household_id": hid, "status": "expired"}, headers=_auth(token)).json()
    assert any(p["id"] == prop["id"] for p in lst["items"])


# 12 — edición whitelisted: se ejecuta la versión APROBADA (editada)
def test_edit_items_executes_edited_version(client):
    token = _register_and_login(client, "m32c@example.com")
    hid, _ = _bootstrap(client, token)
    prop = _propose_shopping(client, token, hid)  # propone leche, pan
    r = client.post(f"/assistant/proposals/{prop['id']}/confirm",
                    json={"overrides": {"items": ["cafe", "azucar", "yerba"]}}, headers=_auth(token))
    assert r.status_code == 200, r.text
    items = client.get(f"/household_shopping/{hid}/items", headers=_auth(token)).json()["items"]
    names = {i["item_name"] for i in items}
    assert {"cafe", "azucar", "yerba"} <= names      # versión editada
    assert "leche" not in names and "pan" not in names  # NO la original


# 13 — payload malicioso: tool/household/campos no whitelisted → rechazado
def test_malicious_overrides_rejected(client):
    token = _register_and_login(client, "m32d@example.com")
    hid, _ = _bootstrap(client, token)
    before = _shopping_count(client, token, hid)
    for evil in (
        {"household_id": "otro-hogar"},
        {"tool_name": "register_financial_expense"},
        {"user_id": "atacante"},
        {"amount": 99999},
    ):
        prop = _propose_shopping(client, token, hid, "agrega sal a la lista")
        r = client.post(f"/assistant/proposals/{prop['id']}/confirm", json={"overrides": evil}, headers=_auth(token))
        assert r.status_code == 400, f"{evil} -> {r.status_code} {r.text}"
        assert "no editables" in r.json()["detail"].lower()
    assert _shopping_count(client, token, hid) == before  # nada se ejecutó
    # items inválidos (tipo incorrecto) también se rechazan
    prop = _propose_shopping(client, token, hid, "agrega sal a la lista")
    r = client.post(f"/assistant/proposals/{prop['id']}/confirm", json={"overrides": {"items": "no-una-lista"}}, headers=_auth(token))
    assert r.status_code == 400


# 14 — fallo de tool: estado failed, sin éxito falso, reintento controlado
def test_tool_failure_then_controlled_retry(client):
    token = _register_and_login(client, "m32e@example.com")
    hid, pid = _bootstrap(client, token)
    out = _chat(client, token, hid, "prepara el estudio de matematicas")  # sin nombre -> sin person_id
    prop = out["proposals"][0]
    assert prop["tool_name"] == "propose_study_task"
    # Confirmar sin persona -> la tool falla -> failed, sin éxito falso
    r = client.post(f"/assistant/proposals/{prop['id']}/confirm", json={}, headers=_auth(token))
    assert r.status_code == 400, r.text
    got = client.get("/assistant/proposals", params={"household_id": hid, "status": "failed"}, headers=_auth(token)).json()
    assert any(p["id"] == prop["id"] for p in got["items"])
    # Reintento controlado con persona válida (editable) -> executed
    r2 = client.post(f"/assistant/proposals/{prop['id']}/confirm", json={"overrides": {"person_id": pid}}, headers=_auth(token))
    assert r2.status_code == 200, r2.text
    assert r2.json()["proposal"]["status"] == "executed"
    # person_id de otro hogar -> rechazado
    prop2 = _chat(client, token, hid, "prepara el estudio de lenguaje")["proposals"][0]
    r3 = client.post(f"/assistant/proposals/{prop2['id']}/confirm", json={"overrides": {"person_id": "no-existe"}}, headers=_auth(token))
    assert r3.status_code == 400
    assert "no pertenece" in r3.json()["detail"].lower()


# 15 — rechazo idempotente
def test_double_reject_is_safe(client):
    token = _register_and_login(client, "m32f@example.com")
    hid, _ = _bootstrap(client, token)
    prop = _propose_shopping(client, token, hid, "agrega arroz a la lista")
    r1 = client.post(f"/assistant/proposals/{prop['id']}/reject", headers=_auth(token))
    assert r1.status_code == 200
    r2 = client.post(f"/assistant/proposals/{prop['id']}/reject", headers=_auth(token))
    assert r2.status_code == 200 and r2.json().get("already_rejected") is True


# 16 — historial mínimo: status=all acotado
def test_history_all_status(client):
    token = _register_and_login(client, "m32g@example.com")
    hid, _ = _bootstrap(client, token)
    p1 = _propose_shopping(client, token, hid, "agrega te a la lista")
    client.post(f"/assistant/proposals/{p1['id']}/confirm", json={}, headers=_auth(token))
    p2 = _propose_shopping(client, token, hid, "agrega mate a la lista")
    client.post(f"/assistant/proposals/{p2['id']}/reject", headers=_auth(token))
    hist = client.get("/assistant/proposals", params={"household_id": hid, "status": "all"}, headers=_auth(token)).json()["items"]
    states = {p["id"]: p["status"] for p in hist}
    assert states[p1["id"]] == "executed" and states[p2["id"]] == "rejected"


# 17 — consistencia de conteos: "por comprar" = needed + in_cart (única fuente)
def test_shopping_count_consistency(client):
    token = _register_and_login(client, "m32h@example.com")
    hid, _ = _bootstrap(client, token)
    # 2 needed vía propuesta confirmada
    prop = _propose_shopping(client, token, hid)  # leche, pan
    client.post(f"/assistant/proposals/{prop['id']}/confirm", json={}, headers=_auth(token))
    out = _chat(client, token, hid, "que falta comprar")
    assert "2 productos por comprar" in out["reply"], out["reply"]
    resumen = _chat(client, token, hid, "dame un resumen")
    assert "2 productos por comprar" in resumen["reply"], resumen["reply"]
