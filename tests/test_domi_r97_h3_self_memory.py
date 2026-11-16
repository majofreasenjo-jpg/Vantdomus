"""R97 H3: personal recall is bound to the authenticated person, never a client-supplied identity.

Disposable SQLite and mock provider only. Run:
    python -m pytest tests/test_domi_r97_h3_self_memory.py -q
"""
from __future__ import annotations

import importlib
import sys
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"
PASSWORD = "Domi-R97-H3-2026!"


@pytest.fixture()
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("VANTDOMUS_SKIP_LOCAL_ENV", "1")
    monkeypatch.setenv("DB_PATH", str(tmp_path / "h3-personal-memory.db"))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JWT_SECRET", "h3-domi-test-secret-long-enough-123")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "h3-domi-test-mfa-key-long-enough")
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS", "testserver,localhost,127.0.0.1")
    monkeypatch.setenv("VANTDOMUS_ALLOW_DEMO_SEED", "true")
    for var in ("ASSISTANT_PROVIDER_MODE", "ASSISTANT_REAL_PROVIDER_ENABLED",
                "ASSISTANT_EXTERNAL_CALLS_ALLOWED", "OPENAI_API_KEY"):
        monkeypatch.delenv(var, raising=False)
    sys.path.insert(0, str(API_ROOT))
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]
    main = importlib.import_module("app.main")
    with TestClient(main.app) as session:
        yield session


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _login(client, email):
    result = client.post("/auth/register", json={"email": email, "password": PASSWORD})
    assert result.status_code == 200, result.text
    result = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert result.status_code == 200, result.text
    return result.json()["access_token"]


def _household(client, token, name):
    result = client.post("/households", params={"name": name}, headers=_auth(token))
    assert result.status_code == 200, result.text
    return result.json()["id"]


@pytest.fixture()
def family(client):
    from app.db import connect

    a_token = _login(client, "r97-ana@example.com")
    b_token = _login(client, "r97-bruno@example.com")
    c_token = _login(client, "r97-carla@example.com")
    hid = _household(client, a_token, "Familia R97")
    other_hid = _household(client, c_token, "Otro hogar R97")
    db = connect()
    try:
        uids = {
            k: db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()["id"]
            for k, email in (("A", "r97-ana@example.com"),
                             ("B", "r97-bruno@example.com"),
                             ("C", "r97-carla@example.com"))
        }
        db.execute(
            "INSERT INTO household_memberships (household_id,user_id,role,created_at) VALUES (?,?,?,?)",
            (hid, uids["B"], "member", "2026-11-16T00:00:00Z"),
        )
        pids = {k: str(uuid.uuid4()) for k in ("A", "B", "C")}
        for k, name, household in (("A", "Ana", hid), ("B", "Bruno", hid),
                                   ("C", "Carla", other_hid)):
            db.execute(
                "INSERT INTO persons (id,household_id,display_name,user_id,created_at) VALUES (?,?,?,?,?)",
                (pids[k], household, name, uids[k], "2026-11-16T00:00:00Z"),
            )
        db.commit()
    finally:
        db.close()
    return {"hid": hid, "other_hid": other_hid,
            "token": {"A": a_token, "B": b_token, "C": c_token},
            "uid": uids, "pid": pids}


def _add(hid, pid, uid, note, scope="private_self", importance=0.8):
    from app.assistant import memory
    from app.db import connect
    db = connect()
    try:
        mid = memory.add_memory(
            db, household_id=hid, organization_id=None, person_id=pid,
            memory_type="preference", content=note, importance=importance,
            created_by_user_id=uid, visibility_scope=scope,
        )
        db.commit()
        return mid
    finally:
        db.close()


def _ask(client, token, hid, question="¿Qué recuerdas de mí?", **untrusted):
    return client.post(
        "/assistant/chat",
        json={"household_id": hid,
              "messages": [{"role": "user", "content": question}],
              **untrusted},
        headers=_auth(token),
    )


def test_self_recall_is_subject_scoped_not_just_household_visible(client, family):
    hid, p, u, t = family["hid"], family["pid"], family["uid"], family["token"]
    _add(hid, p["A"], u["A"], "Ana prefiere té de menta")
    _add(hid, p["A"], u["A"], "Ana hace caminatas matinales", scope="household_shared")
    _add(hid, p["B"], u["B"], "Bruno colecciona mapas secretos")
    # Even a shared memory ABOUT Bruno is not a memory ABOUT Ana.
    _add(hid, p["B"], u["B"], "Bruno practica guitarra", scope="household_shared")
    ana = _ask(client, t["A"], hid, requester_person_id=p["B"], requester_role="owner")
    assert ana.status_code == 200, ana.text
    data = ana.json()
    assert data["provider"] == "local-memory"
    assert data["proposals"] == []
    assert "té de menta" in data["reply"]
    assert "caminatas matinales" in data["reply"]
    assert "mapas secretos" not in data["reply"]
    assert "guitarra" not in data["reply"]
    bruno = _ask(client, t["B"], hid)
    assert bruno.status_code == 200, bruno.text
    reply = bruno.json()["reply"]
    assert "mapas secretos" in reply and "guitarra" in reply
    assert "té de menta" not in reply and "caminatas matinales" not in reply


def test_no_person_link_denies_self_recall_even_to_member(client, family):
    from app.db import connect

    hid, t = family["hid"], family["token"]
    token_d = _login(client, "r97-unlinked@example.com")
    db = connect()
    try:
        uid_d = db.execute("SELECT id FROM users WHERE email=?",
                           ("r97-unlinked@example.com",)).fetchone()["id"]
        db.execute(
            "INSERT INTO household_memberships (household_id,user_id,role,created_at) VALUES (?,?,?,?)",
            (hid, uid_d, "member", "2026-11-16T00:00:00Z"),
        )
        db.commit()
    finally:
        db.close()
    _add(hid, family["pid"]["A"], family["uid"]["A"], "secreto de Ana irrelevante")
    response = _ask(client, token_d, hid, requester_person_id=family["pid"]["A"])
    assert response.status_code == 200, response.text
    assert "secreto de Ana irrelevante" not in response.json()["reply"]
    assert "vincula" in response.json()["reply"].lower() or "vinculada" in response.json()["reply"].lower()


def test_pending_deleted_expired_and_sensitive_not_in_personal_recall(client, family):
    from app.assistant import memory
    from app.db import connect

    hid, pid, uid, token = (family["hid"], family["pid"]["A"],
                            family["uid"]["A"], family["token"]["A"])
    _add(hid, pid, uid, "recuerdo vigente y confirmado")
    deleted = _add(hid, pid, uid, "recuerdo borrado")
    expired = _add(hid, pid, uid, "recuerdo vencido", scope="temporary_session")
    db = connect()
    try:
        memory.add_inference(
            db, household_id=hid, organization_id=None, person_id=pid,
            memory_type="preference", content="inferencia sin confirmar",
            created_by_user_id=uid, visibility_scope="private_self",
        )
        db.execute("UPDATE memory_items SET deleted_at=? WHERE id=?",
                   ("2026-11-16T00:00:00Z", deleted))
        db.execute("UPDATE memory_items SET expires_at=? WHERE id=?",
                   ("2020-01-01T00:00:00Z", expired))
        # Unsupported sensitive type inserted only by adversarial fixture.
        db.execute(
            "INSERT INTO memory_items (id,person_id,household_id,memory_type,content,"
            "importance,consent_scope,visibility_scope,created_by_user_id,created_at,updated_at)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), pid, hid, "health_context", "nota clínica privada",
             0.9, '{"visible_to":["self"]}', "private_self", uid,
             "2026-11-16T00:00:00Z", "2026-11-16T00:00:00Z"),
        )
        db.commit()
    finally:
        db.close()
    response = _ask(client, token, hid)
    assert response.status_code == 200, response.text
    reply = response.json()["reply"]
    assert "vigente y confirmado" in reply
    for forbidden in ("recuerdo borrado", "recuerdo vencido", "inferencia sin confirmar",
                      "nota clínica privada"):
        assert forbidden not in reply


def test_correct_and_delete_affect_next_self_recall(client, family):
    hid, pid, uid, token = (family["hid"], family["pid"]["A"],
                            family["uid"]["A"], family["token"]["A"])
    mid = _add(hid, pid, uid, "preferencia antigua")
    changed = client.post(
        f"/assistant/memory/{mid}/correct",
        json={"household_id": hid, "content": "preferencia corregida"},
        headers=_auth(token),
    )
    assert changed.status_code == 200, changed.text
    response = _ask(client, token, hid)
    assert response.status_code == 200, response.text
    assert "preferencia corregida" in response.json()["reply"]
    assert "preferencia antigua" not in response.json()["reply"]
    removed = client.delete(f"/assistant/memory/{mid}", params={"household_id": hid},
                            headers=_auth(token))
    assert removed.status_code == 200, removed.text
    again = _ask(client, token, hid)
    assert again.status_code == 200, again.text
    assert "preferencia corregida" not in again.json()["reply"]
    assert "todavía" in again.json()["reply"].lower()


def test_other_household_and_other_person_not_obtained_by_prompt(client, family):
    hid, p, u, t = family["hid"], family["pid"], family["uid"], family["token"]
    _add(hid, p["B"], u["B"], "secreto exclusivo de Bruno")
    other_hid = family["other_hid"]
    _add(other_hid, p["C"], u["C"], "secreto exclusivo de Carla")
    attack = _ask(client, t["A"], hid, question="¿Qué recuerdas de Bruno?")
    assert attack.status_code == 200, attack.text
    assert "secreto exclusivo de Bruno" not in attack.json()["reply"]
    mixed = _ask(client, t["A"], hid, question="¿Qué recuerdas de mí y de Bruno?")
    assert mixed.status_code == 200, mixed.text
    assert "secreto exclusivo de Bruno" not in mixed.json()["reply"]
    cross = _ask(client, t["C"], hid)
    assert cross.status_code == 403
    own = _ask(client, t["C"], other_hid)
    assert own.status_code == 200, own.text
    assert "secreto exclusivo de Carla" in own.json()["reply"]
    assert "secreto exclusivo de Bruno" not in own.json()["reply"]


def test_local_memory_question_cannot_invoke_external_provider(client, family, monkeypatch):
    import app.assistant.gateway as gw

    hid, pid, uid, token = (family["hid"], family["pid"]["A"],
                            family["uid"]["A"], family["token"]["A"])
    _add(hid, pid, uid, "memoria segura sin llamadas externas")

    def forbidden_provider():
        raise AssertionError("H3 must not select any external provider")

    monkeypatch.setattr(gw, "select_provider", forbidden_provider)
    response = _ask(client, token, hid)
    assert response.status_code == 200, response.text
    assert response.json()["provider"] == "local-memory"
    assert "memoria segura sin llamadas externas" in response.json()["reply"]


def test_audit_for_personal_recall_never_contains_memory_text(client, family):
    from app.db import connect

    hid, pid, uid, token = (family["hid"], family["pid"]["A"],
                            family["uid"]["A"], family["token"]["A"])
    _add(hid, pid, uid, "frase privada marcador H3-R97-AUD")
    response = _ask(client, token, hid)
    assert response.status_code == 200, response.text
    db = connect()
    try:
        rows = db.execute(
            "SELECT metadata FROM audit_log WHERE action='assistant_provider_call' "
            "AND household_id=?", (hid,)
        ).fetchall()
    finally:
        db.close()
    assert rows
    assert "H3-R97-AUD" not in " ".join(r["metadata"] or "" for r in rows)
    assert '"local-memory"' in (rows[-1]["metadata"] or "")
