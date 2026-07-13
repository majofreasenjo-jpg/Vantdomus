"""
CP1d-FAMILY-PILOT-1a — Tests de la puerta de entrada, invitaciones y backup.

Cubre los criterios de aceptación autorizados por ChatGPT:
- registro público cerrado (403 API) cuando VANTDOMUS_PUBLIC_REGISTRATION=false;
- registro abierto por defecto en entorno local (dev/demo/test);
- GET /auth/config expone el estado sin secretos;
- invitación: single-use, expiración, vínculo opcional a persona del hogar,
  validación de pertenencia, rate limit y auditoría;
- al aceptar una invitación ligada, persons.user_id queda enlazado;
- backup endurecido: owner + reautenticación con contraseña, VACUUM INTO
  server-side, integrity_check + conteos, sha256, sin ruta física ni descarga;
- noindex: X-Robots-Tag en las respuestas de la API.
"""

from __future__ import annotations

import importlib
import sqlite3
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"
PASSWORD = "FamilyPilot-2026!"


def _make_client(monkeypatch, tmp_path, public_registration: str | None = None) -> tuple[TestClient, Path]:
    db_path = tmp_path / "family-pilot-tests.db"
    monkeypatch.setenv("DB_PATH", str(db_path))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JWT_SECRET", "family-pilot-tests-secret-32-chars-x")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "family-pilot-tests-mfa-key-32-char")
    monkeypatch.setenv("VANTDOMUS_ALLOW_DEMO_SEED", "true")
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS", "testserver,localhost,127.0.0.1")
    monkeypatch.delenv("ASSISTANT_PROVIDER", raising=False)
    monkeypatch.delenv("ASSISTANT_LEGACY_DIRECT_EXEC", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("VANTDOMUS_MIN_PASSWORD_LENGTH", raising=False)
    if public_registration is None:
        monkeypatch.delenv("VANTDOMUS_PUBLIC_REGISTRATION", raising=False)
    else:
        monkeypatch.setenv("VANTDOMUS_PUBLIC_REGISTRATION", public_registration)

    sys.path.insert(0, str(API_ROOT))
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    main = importlib.import_module("app.main")
    return TestClient(main.app), db_path


@pytest.fixture
def open_client(monkeypatch, tmp_path):
    client, db_path = _make_client(monkeypatch, tmp_path)
    with client as test_client:
        yield test_client, db_path


@pytest.fixture
def closed_client(monkeypatch, tmp_path):
    client, db_path = _make_client(monkeypatch, tmp_path, public_registration="false")
    with client as test_client:
        yield test_client, db_path


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _register_and_login(client: TestClient, email: str) -> str:
    r = client.post("/auth/register", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    r = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _bootstrap_household(client: TestClient, token: str, name="Familia Piloto") -> str:
    r = client.post("/households", params={"name": name}, headers=_auth(token))
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _create_person(client: TestClient, token: str, hid: str, display_name="Hijo Sintetico") -> str:
    r = client.post(
        "/persons",
        params={"household_id": hid, "display_name": display_name, "relation": "Hijo"},
        headers=_auth(token),
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


# ---------------------------------------------------------------------------
# 1. Puerta de registro
# ---------------------------------------------------------------------------

def test_register_blocked_when_registration_closed(closed_client):
    client, _ = closed_client
    r = client.post("/auth/register", json={"email": "intruso@sintetico.test", "password": PASSWORD})
    assert r.status_code == 403, r.text
    assert "invitaci" in r.json()["detail"].lower()


def test_register_open_by_default_in_local_env(open_client):
    client, _ = open_client
    r = client.post("/auth/register", json={"email": "papa@sintetico.test", "password": PASSWORD})
    assert r.status_code == 200, r.text


def test_auth_config_reflects_registration_state(closed_client):
    client, _ = closed_client
    r = client.get("/auth/config")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body == {"public_registration": False}


def test_register_rate_limited_per_email(open_client):
    client, _ = open_client
    email = "spam@sintetico.test"
    statuses = []
    for _ in range(6):
        r = client.post("/auth/register", json={"email": email, "password": PASSWORD})
        statuses.append(r.status_code)
    assert statuses[-1] == 429, statuses
    assert "Retry-After" in r.headers


# ---------------------------------------------------------------------------
# 2. Invitaciones seguras
# ---------------------------------------------------------------------------

def test_invitation_is_single_use(open_client):
    client, _ = open_client
    owner = _register_and_login(client, "owner1@sintetico.test")
    hid = _bootstrap_household(client, owner)
    guest_email = "invitado1@sintetico.test"
    guest = _register_and_login(client, guest_email)

    r = client.post(
        f"/households/{hid}/invitations",
        json={"email": guest_email, "role": "member"},
        headers=_auth(owner),
    )
    assert r.status_code == 200, r.text
    token = r.json()["token"]

    r = client.post(f"/households/invitations/{token}/accept", headers=_auth(guest))
    assert r.status_code == 200, r.text
    r = client.post(f"/households/invitations/{token}/accept", headers=_auth(guest))
    assert r.status_code == 400, r.text


def test_invitation_expires(open_client):
    client, db_path = open_client
    owner = _register_and_login(client, "owner2@sintetico.test")
    hid = _bootstrap_household(client, owner)
    guest_email = "invitado2@sintetico.test"
    guest = _register_and_login(client, guest_email)

    r = client.post(
        f"/households/{hid}/invitations",
        json={"email": guest_email, "role": "member", "ttl_hours": 1},
        headers=_auth(owner),
    )
    assert r.status_code == 200, r.text
    invitation_id = r.json()["id"]
    token = r.json()["token"]

    # Forzar expiración directamente en la base (sin esperar 1 hora real).
    con = sqlite3.connect(db_path)
    con.execute(
        "UPDATE household_invitations SET expires_at='2020-01-01T00:00:00+00:00' WHERE id=?",
        (invitation_id,),
    )
    con.commit()
    con.close()

    r = client.post(f"/households/invitations/{token}/accept", headers=_auth(guest))
    assert r.status_code == 410, r.text


def test_invitation_rejects_person_outside_household(open_client):
    client, _ = open_client
    owner = _register_and_login(client, "owner3@sintetico.test")
    hid = _bootstrap_household(client, owner)
    other_owner = _register_and_login(client, "owner3b@sintetico.test")
    other_hid = _bootstrap_household(client, other_owner, name="Otro Hogar")
    foreign_person = _create_person(client, other_owner, other_hid)

    r = client.post(
        f"/households/{hid}/invitations",
        json={"email": "x@sintetico.test", "role": "member", "person_id": foreign_person},
        headers=_auth(owner),
    )
    assert r.status_code == 404, r.text


def test_invitation_links_person_on_accept(open_client):
    client, db_path = open_client
    owner = _register_and_login(client, "owner4@sintetico.test")
    hid = _bootstrap_household(client, owner)
    person_id = _create_person(client, owner, hid, display_name="Hija Sintetica")
    guest_email = "hija@sintetico.test"
    guest = _register_and_login(client, guest_email)

    r = client.post(
        f"/households/{hid}/invitations",
        json={"email": guest_email, "role": "member", "person_id": person_id},
        headers=_auth(owner),
    )
    assert r.status_code == 200, r.text
    token = r.json()["token"]

    r = client.post(f"/households/invitations/{token}/accept", headers=_auth(guest))
    assert r.status_code == 200, r.text
    assert r.json()["linked_person_id"] == person_id

    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    row = con.execute("SELECT user_id FROM persons WHERE id=?", (person_id,)).fetchone()
    con.close()
    assert row["user_id"], "persons.user_id debe quedar enlazado al aceptar"


def test_invitation_create_is_audited_with_person(open_client):
    client, db_path = open_client
    owner = _register_and_login(client, "owner5@sintetico.test")
    hid = _bootstrap_household(client, owner)
    person_id = _create_person(client, owner, hid)

    r = client.post(
        f"/households/{hid}/invitations",
        json={"email": "audit@sintetico.test", "role": "member", "person_id": person_id},
        headers=_auth(owner),
    )
    assert r.status_code == 200, r.text

    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    row = con.execute(
        "SELECT metadata FROM audit_log WHERE action='create_invitation' AND household_id=? ORDER BY created_at DESC",
        (hid,),
    ).fetchone()
    con.close()
    assert row is not None, "create_invitation debe quedar en audit_log"
    assert person_id in (row["metadata"] or "")


# ---------------------------------------------------------------------------
# 3. Backup consistente endurecido
# ---------------------------------------------------------------------------

def test_backup_requires_owner_and_reauth(open_client):
    client, _ = open_client
    owner = _register_and_login(client, "owner6@sintetico.test")
    hid = _bootstrap_household(client, owner)
    member_email = "member6@sintetico.test"
    member = _register_and_login(client, member_email)
    r = client.post(
        f"/households/{hid}/invitations",
        json={"email": member_email, "role": "member"},
        headers=_auth(owner),
    )
    token = r.json()["token"]
    client.post(f"/households/invitations/{token}/accept", headers=_auth(member))

    # Miembro no-owner: prohibido.
    r = client.post(
        f"/households/{hid}/admin/backup",
        json={"password": PASSWORD},
        headers=_auth(member),
    )
    assert r.status_code == 403, r.text

    # Owner con contraseña incorrecta: reautenticación fallida.
    r = client.post(
        f"/households/{hid}/admin/backup",
        json={"password": "clave-equivocada"},
        headers=_auth(owner),
    )
    assert r.status_code == 403, r.text


def test_backup_creates_verified_snapshot_without_paths(open_client):
    client, db_path = open_client
    owner = _register_and_login(client, "owner7@sintetico.test")
    hid = _bootstrap_household(client, owner)
    _create_person(client, owner, hid)

    r = client.post(
        f"/households/{hid}/admin/backup",
        json={"password": PASSWORD},
        headers=_auth(owner),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["integrity"] == "ok"
    assert body["verified"] is True
    assert len(body["sha256"]) == 64
    assert body["size_bytes"] > 0
    assert body["tables"]["users"] >= 1
    assert body["tables"] == body["source_tables"]
    # Sin rutas físicas ni descarga en la respuesta.
    flat = str(body).lower()
    assert str(db_path).lower() not in flat
    assert "\\\\" not in flat and "c:/" not in flat and "/tmp" not in flat

    # Snapshot real en el disco del servidor, restaurable de forma aislada.
    backups_dir = db_path.parent / "backups"
    snapshots = list(backups_dir.glob("vantdomus_*.db"))
    assert len(snapshots) == 1
    con = sqlite3.connect(snapshots[0])
    assert con.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    users_in_snapshot = con.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    con.close()
    assert users_in_snapshot == body["tables"]["users"]


def test_backup_list_returns_metadata_only(open_client):
    client, db_path = open_client
    owner = _register_and_login(client, "owner8@sintetico.test")
    hid = _bootstrap_household(client, owner)
    r = client.post(
        f"/households/{hid}/admin/backup",
        json={"password": PASSWORD},
        headers=_auth(owner),
    )
    assert r.status_code == 200, r.text

    r = client.get(f"/households/{hid}/admin/backup", headers=_auth(owner))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["keep"] == 10
    assert len(body["items"]) == 1
    item = body["items"][0]
    assert set(item.keys()) == {"backup_id", "created_at", "size_bytes", "sha256", "integrity", "verified", "tables"}
    assert str(db_path).lower() not in str(item).lower()


# ---------------------------------------------------------------------------
# 4. Noindex
# ---------------------------------------------------------------------------

def test_api_responses_carry_noindex_header(open_client):
    client, _ = open_client
    r = client.get("/auth/config")
    assert r.status_code == 200
    assert r.headers.get("X-Robots-Tag") == "noindex, nofollow"
