"""
CP1d-FAMILY-PILOT-1b.1 — Suite del modelo de menores, tutela y consentimiento.

Cobertura de los 52 casos obligatorios del gate (numerados en cada test):
migración (1-6), relaciones (7-14), consentimiento (15-20), invitaciones
(21-35, en las TRES etapas), privacidad (36-43), auditoría sin PII (44-48),
módulos (49-52). Datos 100% sintéticos; cero red externa.
"""

from __future__ import annotations

import importlib
import sqlite3
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"
PASSWORD = "GuardianPilot-2026!"


def _purge_app_modules():
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]


def _base_env(monkeypatch, db_path):
    monkeypatch.setenv("DB_PATH", str(db_path))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JWT_SECRET", "guardian-tests-secret-32-chars-xxxx")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "guardian-tests-mfa-key-32-chars-xx")
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS", "testserver,localhost,127.0.0.1")
    monkeypatch.delenv("VANTDOMUS_PUBLIC_REGISTRATION", raising=False)


def _make_local_client(monkeypatch, tmp_path):
    """Entorno local de test: registro abierto (para armar escenarios)."""
    db_path = tmp_path / "guardian-tests.db"
    monkeypatch.setenv("APP_ENV", "test")
    _base_env(monkeypatch, db_path)
    sys.path.insert(0, str(API_ROOT))
    _purge_app_modules()
    main = importlib.import_module("app.main")
    return TestClient(main.app), db_path


def _make_pilot_client(monkeypatch, tmp_path):
    """Perfil family-pilot VÁLIDO (fail-closed) con owner sembrado server-side."""
    disk = tmp_path / "disk"
    disk.mkdir(exist_ok=True)
    db_path = disk / "vantdomus.db"
    monkeypatch.setenv("APP_ENV", "family-pilot")
    _base_env(monkeypatch, db_path)
    monkeypatch.setenv("VANTDOMUS_APP_PUBLIC_URL", "https://familia.example.test")
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS", "familia.example.test,testserver")
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://familia.example.test")
    monkeypatch.setenv("VANTDOMUS_PUBLIC_REGISTRATION", "false")
    monkeypatch.setenv("VANTDOMUS_API_RATE_LIMIT_MODE", "memory")
    monkeypatch.setenv("VANTDOMUS_BACKEND_INSTANCES", "1")
    sys.path.insert(0, str(API_ROOT))
    _purge_app_modules()
    main = importlib.import_module("app.main")
    client = TestClient(main.app)
    return client, db_path


def _seed_pilot_owner(db_path, email="owner-pilot@sintetico.test"):
    """Bootstrap server-side del owner (el registro público está cerrado)."""
    from app.security import hash_password
    con = sqlite3.connect(db_path)
    uid = str(uuid.uuid4())
    hid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    con.execute(
        "INSERT INTO users (id,email,password_hash,is_active,created_at,email_verified_at) VALUES (?,?,?,?,?,?)",
        (uid, email, hash_password(PASSWORD), 1, now, now),
    )
    con.execute(
        "INSERT INTO households (id,name,created_at) VALUES (?,?,?)",
        (hid, "Hogar Piloto Sintetico", now),
    )
    con.execute(
        "INSERT INTO household_memberships (household_id,user_id,role,created_at) VALUES (?,?,?,?)",
        (hid, uid, "owner", now),
    )
    con.commit()
    con.close()
    return uid, hid


@pytest.fixture
def local_client(monkeypatch, tmp_path):
    client, db_path = _make_local_client(monkeypatch, tmp_path)
    with client as c:
        yield c, db_path


@pytest.fixture
def pilot_client(monkeypatch, tmp_path):
    client, db_path = _make_pilot_client(monkeypatch, tmp_path)
    with client as c:
        yield c, db_path


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _register_and_login(client, email):
    r = client.post("/auth/register", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    r = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _login(client, email):
    r = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _household(client, token, name="Hogar Tutela"):
    r = client.post("/households", params={"name": name}, headers=_auth(token))
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _person(client, token, hid, name, relation="Integrante"):
    r = client.post("/persons", params={"household_id": hid, "display_name": name, "relation": relation}, headers=_auth(token))
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _classify(client, token, pid, band=None, profile=None, expect=200):
    body = {}
    if band is not None:
        body["age_band"] = band
    if profile is not None:
        body["minor_privacy_profile"] = profile
    r = client.patch(f"/persons/{pid}/classification", json=body, headers=_auth(token))
    assert r.status_code == expect, r.text
    return r


def _relationship(client, token, hid, minor_pid, guardian_pid, scope="full", expect=200):
    r = client.post(
        f"/households/{hid}/guardians/relationships",
        json={"minor_person_id": minor_pid, "guardian_person_id": guardian_pid, "scope": scope},
        headers=_auth(token),
    )
    assert r.status_code == expect, r.text
    return r.json() if expect == 200 else r


def _consent(client, token, hid, relationship_id, consent_type="account_creation", expect=200):
    r = client.post(
        f"/households/{hid}/guardians/consents",
        json={"relationship_id": relationship_id, "consent_type": consent_type},
        headers=_auth(token),
    )
    assert r.status_code == expect, r.text
    return r.json() if expect == 200 else r


def _invite(client, token, hid, email, person_id=None, role="member", expect=200):
    payload = {"email": email, "role": role, "ttl_hours": 24}
    if person_id:
        payload["person_id"] = person_id
    r = client.post(f"/households/{hid}/invitations", json=payload, headers=_auth(token))
    assert r.status_code == expect, r.text
    return r.json() if expect == 200 else r


def _register_with_invitation(client, token_value, email, expect=200):
    r = client.post(
        "/auth/register-with-invitation",
        json={"token": token_value, "email": email, "password": PASSWORD},
    )
    assert r.status_code == expect, r.text
    return r.json() if expect == 200 else r


def _standard_setup(client):
    """Owner + hogar + guardián adulto CON CUENTA (vía invitación) + ficha menor."""
    owner = _register_and_login(client, "duenio-g@sintetico.test")
    hid = _household(client, owner)
    tutor_pid = _person(client, owner, hid, "Tutor Adulto", "Madre")
    _classify(client, owner, tutor_pid, band="adult")
    inv = _invite(client, owner, hid, "tutora-g@sintetico.test", person_id=tutor_pid, role="admin")
    _register_with_invitation(client, inv["token"], "tutora-g@sintetico.test")
    guardian = _login(client, "tutora-g@sintetico.test")
    minor_pid = _person(client, owner, hid, "Menor Sintetico", "Hijo")
    _classify(client, owner, minor_pid, band="supervised_minor")
    return owner, guardian, hid, tutor_pid, minor_pid


# ===========================================================================
# MIGRACIÓN (1-6)
# ===========================================================================

def test_01_02_03_migration_upgrade_replay_and_failclosed_defaults(monkeypatch, tmp_path):
    client, db_path = _make_local_client(monkeypatch, tmp_path)
    with client as c:
        owner = _register_and_login(c, "mig@sintetico.test")
        hid = _household(c, owner)
        pid = _person(c, owner, hid, "Ficha Previa")
    # 2: replay idempotente — segunda instancia de la app sobre la MISMA base.
    _purge_app_modules()
    main = importlib.import_module("app.main")
    with TestClient(main.app) as c2:
        token = _login(c2, "mig@sintetico.test")
        r = c2.get(f"/persons/{pid}", headers=_auth(token))
        assert r.status_code == 200
        # 3: defaults fail-closed en filas creadas sin clasificación.
        assert r.json()["age_band"] == "unclassified"
        assert r.json()["minor_privacy_profile"] == "restricted"


def test_04_check_constraints(local_client):
    _client, db_path = local_client
    con = sqlite3.connect(db_path)
    with pytest.raises(sqlite3.IntegrityError):
        con.execute(
            "INSERT INTO persons (id, household_id, display_name, created_at, age_band) VALUES (?,?,?,?,?)",
            (str(uuid.uuid4()), "h", "X", "t", "banda-invalida"),
        )
    with pytest.raises(sqlite3.IntegrityError):
        con.execute(
            "INSERT INTO guardian_relationships (id, household_id, minor_person_id, guardian_person_id, scope, created_by_user_id, created_at) VALUES (?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), "h", "p1", "p2", "scope-invalido", "u", "t"),
        )
    with pytest.raises(sqlite3.IntegrityError):
        # CHECK minor != guardian
        con.execute(
            "INSERT INTO guardian_relationships (id, household_id, minor_person_id, guardian_person_id, scope, created_by_user_id, created_at) VALUES (?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), "h", "mismo", "mismo", "full", "u", "t"),
        )
    con.close()


def test_05_06_indexes_and_integrity(local_client):
    _client, db_path = local_client
    con = sqlite3.connect(db_path)
    names = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='index'").fetchall()}
    for idx in ("idx_guardian_rel_minor", "idx_guardian_rel_guardian", "uq_guardian_rel_active",
                "uq_guardian_consent_active", "idx_guardian_consent_minor"):
        assert idx in names, f"falta índice {idx}"
    assert con.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    con.close()


# ===========================================================================
# RELACIONES (7-14)
# ===========================================================================

def test_07_create_valid_relationship(local_client):
    client, _ = local_client
    _owner, _guardian, hid, tutor, minor = _standard_setup(client)
    # ya creada en helpers de otros tests? no — crearla aquí:
    owner = _login(client, "duenio-g@sintetico.test")
    rel = _relationship(client, owner, hid, minor, tutor)
    assert rel["scope"] == "full"


def test_08_guardian_equals_minor_denied(local_client):
    client, _ = local_client
    owner, _guardian, hid, tutor, _minor = _standard_setup(client)
    r = _relationship(client, owner, hid, tutor, tutor, expect=400)
    assert r.status_code == 400


def test_09_cross_household_denied(local_client):
    client, _ = local_client
    owner, _guardian, hid, tutor, minor = _standard_setup(client)
    other = _register_and_login(client, "otro-hogar-g@sintetico.test")
    other_hid = _household(client, other, "Hogar Ajeno G")
    foreign_minor = _person(client, other, other_hid, "Menor Ajeno")
    _classify(client, other, foreign_minor, band="supervised_minor")
    # menor de OTRO hogar en el hogar A => 404
    _relationship(client, owner, hid, foreign_minor, tutor, expect=404)


def test_10_guardian_not_adult_denied(local_client):
    client, _ = local_client
    owner, _guardian, hid, _tutor, minor = _standard_setup(client)
    otro_menor = _person(client, owner, hid, "Otro Menor")
    _classify(client, owner, otro_menor, band="supervised_teen")
    _relationship(client, owner, hid, minor, otro_menor, expect=403)


def test_11_guardian_without_account_denied(local_client):
    client, _ = local_client
    owner, _guardian, hid, _tutor, minor = _standard_setup(client)
    adulto_sin_cuenta = _person(client, owner, hid, "Adulto Sin Cuenta")
    _classify(client, owner, adulto_sin_cuenta, band="adult")
    _relationship(client, owner, hid, minor, adulto_sin_cuenta, expect=403)


def test_12_13_14_duplicate_revoke_and_revoked_stops_authorizing(local_client):
    client, _ = local_client
    owner, guardian, hid, tutor, minor = _standard_setup(client)
    rel = _relationship(client, owner, hid, minor, tutor)
    # 12: duplicado activo idéntico
    _relationship(client, owner, hid, minor, tutor, expect=409)
    # 13: revocación
    r = client.post(f"/households/{hid}/guardians/relationships/{rel['id']}/revoke", headers=_auth(owner))
    assert r.status_code == 200, r.text
    # 14: la relación revocada deja de autorizar (consentir => 403)
    _consent(client, guardian, hid, rel["id"], expect=403)


# ===========================================================================
# CONSENTIMIENTO (15-20)
# ===========================================================================

def test_15_16_17_consent_rules(local_client):
    client, _ = local_client
    owner, guardian, hid, tutor, minor = _standard_setup(client)
    rel = _relationship(client, owner, hid, minor, tutor)
    # 16: un usuario DISTINTO al guardián de la relación no puede consentir
    _consent(client, owner, hid, rel["id"], expect=403)
    # 15: el guardián correcto concede
    consent = _consent(client, guardian, hid, rel["id"])
    assert consent["consent_type"] == "account_creation"
    # 17: scope=view no autoriza account_creation
    rel_view = _relationship(client, owner, hid, minor, tutor, scope="view")
    _consent(client, guardian, hid, rel_view["id"], expect=403)


def test_18_19_20_consent_revocation_isolation_policy_version(local_client):
    client, db_path = local_client
    owner, guardian, hid, tutor, minor = _standard_setup(client)
    rel = _relationship(client, owner, hid, minor, tutor)
    consent = _consent(client, guardian, hid, rel["id"])
    # 20: policy_version persistida y auditada
    assert consent["policy_version"]
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    row = con.execute(
        "SELECT metadata FROM audit_log WHERE action='guardian_consent_granted' ORDER BY created_at DESC"
    ).fetchone()
    assert row and consent["policy_version"] in row["metadata"]
    con.close()
    # 19: consentimiento con relación de OTRO hogar => 404
    other = _register_and_login(client, "hogar-b-consent@sintetico.test")
    other_hid = _household(client, other, "Hogar B Consent")
    r = client.post(
        f"/households/{other_hid}/guardians/consents",
        json={"relationship_id": rel["id"], "consent_type": "account_creation"},
        headers=_auth(other),
    )
    assert r.status_code == 404, r.text
    # 18: consentimiento revocado deja de autorizar (invitación => 403)
    r = client.post(f"/households/{hid}/guardians/consents/{consent['id']}/revoke", headers=_auth(guardian))
    assert r.status_code == 200
    _invite(client, owner, hid, "menor-post-revoke@sintetico.test", person_id=minor, role="viewer", expect=403)


# ===========================================================================
# INVITACIONES — tres etapas (21-35)
# ===========================================================================

def _full_minor_authorization(client, owner, guardian, hid, tutor, minor):
    rel = _relationship(client, owner, hid, minor, tutor)
    _consent(client, guardian, hid, rel["id"])
    return rel


def test_21_22_unclassified_and_child_denied_at_creation(local_client):
    client, _ = local_client
    owner, _guardian, hid, _tutor, _minor = _standard_setup(client)
    sin_clasificar = _person(client, owner, hid, "Sin Clasificar")
    _invite(client, owner, hid, "u21@sintetico.test", person_id=sin_clasificar, role="viewer", expect=403)
    nino = _person(client, owner, hid, "Nino Pequeno")
    _classify(client, owner, nino, band="child")
    _invite(client, owner, hid, "u22@sintetico.test", person_id=nino, role="viewer", expect=403)


def test_23_24_25_26_supervised_requirements(local_client):
    client, _ = local_client
    owner, guardian, hid, tutor, minor = _standard_setup(client)
    # 23: sin relación de tutela => DENIED
    _invite(client, owner, hid, "u23@sintetico.test", person_id=minor, role="viewer", expect=403)
    rel = _relationship(client, owner, hid, minor, tutor)
    # 24: relación sin consentimiento => DENIED
    _invite(client, owner, hid, "u24@sintetico.test", person_id=minor, role="viewer", expect=403)
    consent = _consent(client, guardian, hid, rel["id"])
    # 26: rol admin/owner para menor => DENIED (también rol member para supervised_minor)
    _invite(client, owner, hid, "u26a@sintetico.test", person_id=minor, role="admin", expect=403)
    _invite(client, owner, hid, "u26b@sintetico.test", person_id=minor, role="member", expect=403)
    # 25: consentimiento revocado => DENIED
    client.post(f"/households/{hid}/guardians/consents/{consent['id']}/revoke", headers=_auth(guardian))
    _invite(client, owner, hid, "u25@sintetico.test", person_id=minor, role="viewer", expect=403)


def test_27_supervised_minor_viewer_allowed_end_to_end(local_client):
    client, db_path = local_client
    owner, guardian, hid, tutor, minor = _standard_setup(client)
    _full_minor_authorization(client, owner, guardian, hid, tutor, minor)
    inv = _invite(client, owner, hid, "menor27@sintetico.test", person_id=minor, role="viewer")
    body = _register_with_invitation(client, inv["token"], "menor27@sintetico.test")
    assert body["role"] == "viewer"
    assert body["linked_person_id"] == minor
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    membership = con.execute(
        "SELECT hm.role FROM household_memberships hm JOIN users u ON u.id=hm.user_id WHERE u.email=?",
        ("menor27@sintetico.test",),
    ).fetchone()
    con.close()
    assert membership["role"] == "viewer"


def test_28_supervised_teen_member_allowed(local_client):
    client, _ = local_client
    owner, guardian, hid, tutor, _minor = _standard_setup(client)
    teen = _person(client, owner, hid, "Adolescente Sintetico")
    _classify(client, owner, teen, band="supervised_teen")
    rel = _relationship(client, owner, hid, teen, tutor)
    _consent(client, guardian, hid, rel["id"])
    # rol viewer para teen => DENIED (el único permitido es member)
    _invite(client, owner, hid, "teen28x@sintetico.test", person_id=teen, role="viewer", expect=403)
    inv = _invite(client, owner, hid, "teen28@sintetico.test", person_id=teen, role="member")
    body = _register_with_invitation(client, inv["token"], "teen28@sintetico.test")
    assert body["role"] == "member"


def test_29_adult_normal_path(local_client):
    client, _ = local_client
    owner, _guardian, hid, _tutor, _minor = _standard_setup(client)
    adulto = _person(client, owner, hid, "Segundo Adulto")
    _classify(client, owner, adulto, band="adult")
    inv = _invite(client, owner, hid, "adulto29@sintetico.test", person_id=adulto, role="member")
    body = _register_with_invitation(client, inv["token"], "adulto29@sintetico.test")
    assert body["linked_person_id"] == adulto


def test_30_band_change_after_creation_denies_acceptance(local_client):
    client, db_path = local_client
    owner, guardian, hid, tutor, minor = _standard_setup(client)
    _full_minor_authorization(client, owner, guardian, hid, tutor, minor)
    inv = _invite(client, owner, hid, "menor30@sintetico.test", person_id=minor, role="viewer")
    # La banda cambia a child DESPUÉS de crear la invitación
    _classify(client, owner, minor, band="child")
    r = _register_with_invitation(client, inv["token"], "menor30@sintetico.test", expect=400)
    # 33 (parcial): rollback total — sin usuario y sin consumo
    con = sqlite3.connect(db_path)
    assert con.execute("SELECT COUNT(*) FROM users WHERE email=?", ("menor30@sintetico.test",)).fetchone()[0] == 0
    assert con.execute("SELECT accepted_at FROM household_invitations WHERE id=?", (inv["id"],)).fetchone()[0] is None
    con.close()


def test_31_guardianship_revoked_after_creation_denies_acceptance(local_client):
    client, db_path = local_client
    owner, guardian, hid, tutor, minor = _standard_setup(client)
    rel = _full_minor_authorization(client, owner, guardian, hid, tutor, minor)
    inv = _invite(client, owner, hid, "menor31@sintetico.test", person_id=minor, role="viewer")
    client.post(f"/households/{hid}/guardians/relationships/{rel['id']}/revoke", headers=_auth(owner))
    _register_with_invitation(client, inv["token"], "menor31@sintetico.test", expect=400)
    con = sqlite3.connect(db_path)
    assert con.execute("SELECT COUNT(*) FROM users WHERE email=?", ("menor31@sintetico.test",)).fetchone()[0] == 0
    con.close()


def test_32_concurrency_single_consumption(local_client):
    import threading
    client, db_path = local_client
    owner, guardian, hid, tutor, minor = _standard_setup(client)
    _full_minor_authorization(client, owner, guardian, hid, tutor, minor)
    inv = _invite(client, owner, hid, "carrera32@sintetico.test", person_id=minor, role="viewer")
    results = []
    barrier = threading.Barrier(2)

    def _try():
        barrier.wait()
        try:
            r = client.post("/auth/register-with-invitation",
                            json={"token": inv["token"], "email": "carrera32@sintetico.test", "password": PASSWORD})
            results.append(r.status_code)
        except Exception:
            results.append(-1)

    ts = [threading.Thread(target=_try) for _ in range(2)]
    [t.start() for t in ts]
    [t.join(timeout=30) for t in ts]
    con = sqlite3.connect(db_path)
    users = con.execute("SELECT COUNT(*) FROM users WHERE email=?", ("carrera32@sintetico.test",)).fetchone()[0]
    accepted = con.execute("SELECT COUNT(*) FROM household_invitations WHERE id=? AND accepted_at IS NOT NULL", (inv["id"],)).fetchone()[0]
    con.close()
    assert results.count(200) == 1, results
    assert users == 1 and accepted == 1


def test_33_rollback_when_person_link_fails(local_client):
    client, db_path = local_client
    owner, guardian, hid, tutor, minor = _standard_setup(client)
    _full_minor_authorization(client, owner, guardian, hid, tutor, minor)
    inv = _invite(client, owner, hid, "menor33@sintetico.test", person_id=minor, role="viewer")
    con = sqlite3.connect(db_path)
    con.execute("UPDATE persons SET user_id='ocupada-sintetica' WHERE id=?", (minor,))
    con.commit(); con.close()
    _register_with_invitation(client, inv["token"], "menor33@sintetico.test", expect=400)
    con = sqlite3.connect(db_path)
    assert con.execute("SELECT COUNT(*) FROM users WHERE email=?", ("menor33@sintetico.test",)).fetchone()[0] == 0
    assert con.execute("SELECT accepted_at FROM household_invitations WHERE id=?", (inv["id"],)).fetchone()[0] is None
    con.close()


def test_34_person_id_required_in_family_pilot(pilot_client):
    client, db_path = pilot_client
    _uid, hid = _seed_pilot_owner(db_path)
    owner = _login(client, "owner-pilot@sintetico.test")
    r = client.post(
        f"/households/{hid}/invitations",
        json={"email": "sin-ficha@sintetico.test", "role": "member", "ttl_hours": 24},
        headers=_auth(owner),
    )
    assert r.status_code == 400, r.text
    assert "person_id" in r.json()["detail"]


def test_35_preexisting_account_cannot_evade_policy(local_client):
    client, db_path = local_client
    owner, guardian, hid, tutor, minor = _standard_setup(client)
    rel = _full_minor_authorization(client, owner, guardian, hid, tutor, minor)
    inv = _invite(client, owner, hid, "evasor35@sintetico.test", person_id=minor, role="viewer")
    # El evasor YA tiene cuenta (registrada aparte) e intenta la vía autenticada
    evasor = _register_and_login(client, "evasor35@sintetico.test")
    # La tutela se revoca ANTES de aceptar: la vía autenticada DEBE re-validar
    client.post(f"/households/{hid}/guardians/relationships/{rel['id']}/revoke", headers=_auth(owner))
    r = client.post(f"/households/invitations/{inv['token']}/accept", headers=_auth(evasor))
    assert r.status_code == 403, r.text
    con = sqlite3.connect(db_path)
    assert con.execute(
        "SELECT COUNT(*) FROM household_memberships hm JOIN users u ON u.id=hm.user_id WHERE u.email=? AND hm.household_id=?",
        ("evasor35@sintetico.test", hid),
    ).fetchone()[0] == 0
    assert con.execute("SELECT accepted_at FROM household_invitations WHERE id=?", (inv["id"],)).fetchone()[0] is None
    con.close()


# ===========================================================================
# PRIVACIDAD (36-43)
# ===========================================================================

def test_36_37_38_39_40_41_42_privacy_matrix(local_client):
    client, _ = local_client
    owner, guardian, hid, tutor, minor = _standard_setup(client)
    _full_minor_authorization(client, owner, guardian, hid, tutor, minor)
    # miembro no relacionado (member) del hogar
    ficha_m = _person(client, owner, hid, "Miembro No Relacionado")
    _classify(client, owner, ficha_m, band="adult")
    inv = _invite(client, owner, hid, "member40@sintetico.test", person_id=ficha_m, role="member")
    _register_with_invitation(client, inv["token"], "member40@sintetico.test")
    member = _login(client, "member40@sintetico.test")

    # 36: owner ve (full) y edita
    r = client.get(f"/persons/{minor}", headers=_auth(owner))
    assert r.status_code == 200 and r.json()["view"] == "full"
    assert client.patch(f"/persons/{minor}", json={"display_name": "Menor Editado"}, headers=_auth(owner)).status_code == 200

    # 38: guardián full ve/edita al menor
    r = client.get(f"/persons/{minor}", headers=_auth(guardian))
    assert r.json()["view"] == "full"
    assert client.patch(f"/persons/{minor}", json={"relation": "Hijo"}, headers=_auth(guardian)).status_code == 200

    # 40: miembro no relacionado recibe vista mínima del menor
    r = client.get(f"/persons/{minor}", headers=_auth(member))
    body = r.json()
    assert body["view"] == "minimal"
    assert "age_band" not in body and "status_emoji" not in body and "household_id" not in body

    # 42: member no cambia estado/avatar ajeno
    assert client.put(f"/persons/{minor}/status", json={"emoji": "X", "text": "no"}, headers=_auth(member)).status_code == 403
    assert client.patch(f"/persons/{minor}", json={"display_name": "Hackeado"}, headers=_auth(member)).status_code == 403

    # 37: titular ve/edita la propia (member40 sobre SU ficha)
    r = client.get(f"/persons/{ficha_m}", headers=_auth(member))
    assert r.json()["view"] == "full"
    assert client.put(f"/persons/{ficha_m}/status", json={"emoji": "OK", "text": "propio"}, headers=_auth(member)).status_code == 200

    # 39: guardián scope=view NO edita — crear segundo guardián con scope view
    tutor2 = _person(client, owner, hid, "Tutor Vista")
    _classify(client, owner, tutor2, band="adult")
    inv2 = _invite(client, owner, hid, "tutor-vista@sintetico.test", person_id=tutor2, role="member")
    _register_with_invitation(client, inv2["token"], "tutor-vista@sintetico.test")
    tutor2_token = _login(client, "tutor-vista@sintetico.test")
    _relationship(client, owner, hid, minor, tutor2, scope="view")
    r = client.get(f"/persons/{minor}", headers=_auth(tutor2_token))
    assert r.json()["view"] == "full"  # view permite VER
    assert client.patch(f"/persons/{minor}", json={"display_name": "NoDebe"}, headers=_auth(tutor2_token)).status_code == 403

    # 41: usuario de otro hogar => 403
    ajeno = _register_and_login(client, "ajeno41@sintetico.test")
    assert client.get(f"/persons/{minor}", headers=_auth(ajeno)).status_code == 403


def test_43_age_band_only_owner(local_client):
    client, _ = local_client
    owner, guardian, hid, _tutor, minor = _standard_setup(client)
    # guardian tiene rol admin: tampoco puede clasificar (solo owner)
    _classify(client, guardian, minor, band="supervised_teen", expect=403)
    _classify(client, owner, minor, band="supervised_teen", expect=200)


# ===========================================================================
# AUDITORÍA SIN PII (44-48)
# ===========================================================================

def test_44_45_46_47_48_audit_has_no_pii(local_client):
    client, db_path = local_client
    owner, guardian, hid, tutor, minor = _standard_setup(client)
    rel = _full_minor_authorization(client, owner, guardian, hid, tutor, minor)
    inv = _invite(client, owner, hid, "auditoria48@sintetico.test", person_id=minor, role="viewer")
    _register_with_invitation(client, inv["token"], "auditoria48@sintetico.test")

    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    audit_dump = " ".join(
        (r["metadata"] or "") for r in con.execute("SELECT metadata FROM audit_log").fetchall()
    )
    sec_dump = " ".join(
        (r["metadata"] or "") for r in con.execute("SELECT metadata FROM security_events").fetchall()
    )
    combined = audit_dump + " " + sec_dump
    # 44: cero email en claro (todos los emails sintéticos usados)
    for email in ("auditoria48@sintetico.test", "tutora-g@sintetico.test", "duenio-g@sintetico.test"):
        assert email not in combined, f"email en claro en auditoría: {email}"
    # 45: cero token de invitación en claro
    assert inv["token"] not in combined
    # 46: cero password
    assert PASSWORD not in combined
    # 47: fingerprints presentes
    assert "email_fingerprint" in combined
    # 48: eventos de tutela y consentimiento presentes
    actions = {r["action"] for r in con.execute("SELECT action FROM audit_log").fetchall()}
    assert {"guardian_relationship_created", "guardian_consent_granted", "person_classified"}.issubset(actions)
    con.close()


# ===========================================================================
# MÓDULOS (49-52) + recuperación (autorización solamente)
# ===========================================================================

def test_49_50_51_sensitive_modules_denied_in_family_pilot(pilot_client):
    client, db_path = pilot_client
    uid, hid = _seed_pilot_owner(db_path)
    owner = _login(client, "owner-pilot@sintetico.test")
    pid = _person(client, owner, hid, "Ficha Pilot")
    _classify(client, owner, pid, band="adult")
    # 49: health DENIED (incluso para owner) — 403 ESTRICTO en rutas reales.
    r = client.get("/health/adherence/get", params={"household_id": hid, "person_id": pid, "med_name": "x"}, headers=_auth(owner))
    assert r.status_code == 403, r.text
    assert "piloto familiar" in r.json()["detail"]
    r = client.get(f"/persons/{pid}/health-timeline", headers=_auth(owner))
    assert r.status_code == 403, r.text
    # 50: finance DENIED — ruta real GET /finance/expenses.
    r = client.get("/finance/expenses", params={"household_id": hid}, headers=_auth(owner))
    assert r.status_code == 403, r.text
    assert "piloto familiar" in r.json()["detail"]
    # 51: documents DENIED — ruta real GET /smart_inbox/candidates.
    r = client.get("/smart_inbox/candidates", params={"household_id": hid}, headers=_auth(owner))
    assert r.status_code == 403, r.text
    assert "piloto familiar" in r.json()["detail"]


def test_52_local_behavior_preserved(local_client):
    client, _ = local_client
    owner, _guardian, hid, _tutor, minor = _standard_setup(client)
    # En entorno local los módulos siguen visibles según module_visibility (#17)
    r = client.get("/health/adherence/get", params={"household_id": hid, "person_id": minor, "med_name": "x"}, headers=_auth(owner))
    assert r.status_code == 200, r.text
    assert r.json() == {"exists": False}


def test_recovery_authorization_only_no_token(local_client):
    client, db_path = local_client
    owner, guardian, hid, tutor, minor = _standard_setup(client)
    _relationship(client, owner, hid, minor, tutor, scope="recovery")
    # guardián con scope recovery => autorizado (sin token emitido)
    r = client.post(f"/households/{hid}/guardians/recovery-authorization-check",
                    json={"minor_person_id": minor}, headers=_auth(guardian))
    assert r.status_code == 200 and r.json() == {"authorized": True, "token_issued": False}
    # el owner sin relación de tutela => denegado y AUDITADO
    r = client.post(f"/households/{hid}/guardians/recovery-authorization-check",
                    json={"minor_person_id": minor}, headers=_auth(owner))
    assert r.json()["authorized"] is False
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    events = con.execute(
        "SELECT metadata FROM security_events WHERE event_type='guardian_recovery_check'"
    ).fetchall()
    con.close()
    assert len(events) == 2
    assert any('"authorized": true' in (e["metadata"] or "") for e in events)
    assert any('"authorized": false' in (e["metadata"] or "") for e in events)


# ===========================================================================
# R1 — CIERRE DE BYPASSES (bloqueadores 1-6)
# ===========================================================================

def _pilot_owner_and_client(monkeypatch, tmp_path):
    """Owner sembrado + login, sobre perfil family-pilot."""
    client, db_path = _make_pilot_client(monkeypatch, tmp_path)
    with client:
        _uid, hid = _seed_pilot_owner(db_path)
        owner = _login(client, "owner-pilot@sintetico.test")
        yield client, db_path, owner, hid


# --- Bloqueador 1: alta directa /members deshabilitada en family-pilot ---

def test_r1_add_member_disabled_in_family_pilot(monkeypatch, tmp_path):
    client, db_path = _make_pilot_client(monkeypatch, tmp_path)
    with client:
        _uid, hid = _seed_pilot_owner(db_path)
        owner = _login(client, "owner-pilot@sintetico.test")
        # Sembrar un segundo usuario directamente (sin membresía).
        from app.security import hash_password
        con = sqlite3.connect(db_path)
        con.execute(
            "INSERT INTO users (id,email,password_hash,is_active,created_at) VALUES (?,?,?,?,?)",
            ("u2-r1", "preexistente@sintetico.test", hash_password(PASSWORD), 1,
             datetime.now(timezone.utc).isoformat()),
        )
        con.commit(); con.close()
        r = client.post(
            f"/households/{hid}/members",
            json={"email": "preexistente@sintetico.test", "role": "member"},
            headers=_auth(owner),
        )
        assert r.status_code == 403, r.text
        con = sqlite3.connect(db_path)
        n = con.execute(
            "SELECT COUNT(*) FROM household_memberships WHERE household_id=? AND user_id=?",
            (hid, "u2-r1"),
        ).fetchone()[0]
        con.close()
        assert n == 0


def test_r1_add_member_still_works_locally(local_client):
    client, _ = local_client
    owner = _register_and_login(client, "owner-local-add@sintetico.test")
    hid = _household(client, owner)
    _register_and_login(client, "invitee-local@sintetico.test")
    r = client.post(
        f"/households/{hid}/members",
        json={"email": "invitee-local@sintetico.test", "role": "viewer"},
        headers=_auth(owner),
    )
    assert r.status_code == 200, r.text


# --- Bloqueador 2: tope de rol persistente en PATCH de miembro ---

def test_r1_role_escalation_blocked_post_alta(local_client):
    client, db_path = local_client
    owner, guardian, hid, tutor, minor = _standard_setup(client)
    _relationship(client, owner, hid, minor, tutor)
    rel = client.post(
        f"/households/{hid}/guardians/relationships",
        json={"minor_person_id": minor, "guardian_person_id": tutor, "scope": "full"},
        headers=_auth(owner),
    )
    # ya existe una relación por _relationship arriba; conseguir su id:
    rels = client.get(f"/households/{hid}/guardians/relationships", headers=_auth(owner)).json()["items"]
    rel_id = [r for r in rels if r["revoked_at"] is None][0]["id"]
    client.post(f"/households/{hid}/guardians/consents",
                json={"relationship_id": rel_id, "consent_type": "account_creation"},
                headers=_auth(guardian))
    inv = _invite(client, owner, hid, "menor-esc@sintetico.test", person_id=minor, role="viewer")
    _register_with_invitation(client, inv["token"], "menor-esc@sintetico.test")
    # user_id del menor
    con = sqlite3.connect(db_path)
    minor_uid = con.execute("SELECT user_id FROM persons WHERE id=?", (minor,)).fetchone()[0]
    con.close()
    # intentar promover el menor a member/admin => 403
    for bad in ("member", "admin"):
        r = client.patch(f"/households/{hid}/members/{minor_uid}", json={"role": bad}, headers=_auth(owner))
        assert r.status_code == 403, f"{bad}: {r.text}"


def test_r1_supervised_teen_member_to_viewer_allowed(local_client):
    client, db_path = local_client
    owner, guardian, hid, tutor, _minor = _standard_setup(client)
    teen = _person(client, owner, hid, "Teen Rol")
    _classify(client, owner, teen, band="supervised_teen")
    rel = _relationship(client, owner, hid, teen, tutor)
    _consent(client, guardian, hid, rel["id"])
    inv = _invite(client, owner, hid, "teen-rol@sintetico.test", person_id=teen, role="member")
    _register_with_invitation(client, inv["token"], "teen-rol@sintetico.test")
    con = sqlite3.connect(db_path)
    teen_uid = con.execute("SELECT user_id FROM persons WHERE id=?", (teen,)).fetchone()[0]
    con.close()
    # bajar a viewer permitido; subir a admin denegado
    assert client.patch(f"/households/{hid}/members/{teen_uid}", json={"role": "viewer"}, headers=_auth(owner)).status_code == 200
    assert client.patch(f"/households/{hid}/members/{teen_uid}", json={"role": "admin"}, headers=_auth(owner)).status_code == 403


# --- Bloqueador 3: transiciones de banda protegidas ---

def test_r1_cannot_downgrade_linked_account_to_child(local_client):
    client, _ = local_client
    owner, _guardian, hid, tutor, _minor = _standard_setup(client)
    # tutor está vinculado (adult con cuenta): no puede caer a child/unclassified
    _classify(client, owner, tutor, band="child", expect=409)
    _classify(client, owner, tutor, band="unclassified", expect=409)


def test_r1_active_guardian_cannot_leave_adult(local_client):
    client, _ = local_client
    owner, _guardian, hid, tutor, minor = _standard_setup(client)
    _relationship(client, owner, hid, minor, tutor)  # tutor es guardián activo
    _classify(client, owner, tutor, band="supervised_teen", expect=409)


def test_r1_minor_with_tutela_cannot_become_adult(local_client):
    client, _ = local_client
    owner, _guardian, hid, tutor, minor = _standard_setup(client)
    _relationship(client, owner, hid, minor, tutor)
    _classify(client, owner, minor, band="adult", expect=409)


# --- Bloqueador 4: revalidación integral de tutela/consentimiento ---

def _authorized_minor_invitation(client, db_path):
    owner, guardian, hid, tutor, minor = _standard_setup(client)
    rel = _relationship(client, owner, hid, minor, tutor)
    _consent(client, guardian, hid, rel["id"])
    inv = _invite(client, owner, hid, "menor-rev@sintetico.test", person_id=minor, role="viewer")
    return owner, guardian, hid, tutor, minor, rel, inv


def test_r1_guardian_leaves_household_denies_acceptance(local_client):
    client, db_path = local_client
    owner, guardian, hid, tutor, minor, rel, inv = _authorized_minor_invitation(client, db_path)
    con = sqlite3.connect(db_path)
    guardian_uid = con.execute("SELECT user_id FROM persons WHERE id=?", (tutor,)).fetchone()[0]
    con.execute("DELETE FROM household_memberships WHERE household_id=? AND user_id=?", (hid, guardian_uid))
    con.commit(); con.close()
    _register_with_invitation(client, inv["token"], "menor-rev@sintetico.test", expect=400)


def test_r1_guardian_deactivated_denies_acceptance(local_client):
    client, db_path = local_client
    owner, guardian, hid, tutor, minor, rel, inv = _authorized_minor_invitation(client, db_path)
    con = sqlite3.connect(db_path)
    guardian_uid = con.execute("SELECT user_id FROM persons WHERE id=?", (tutor,)).fetchone()[0]
    con.execute("UPDATE users SET is_active=0 WHERE id=?", (guardian_uid,))
    con.commit(); con.close()
    _register_with_invitation(client, inv["token"], "menor-rev@sintetico.test", expect=400)


def test_r1_consent_tampered_guardian_denies_acceptance(local_client):
    client, db_path = local_client
    owner, guardian, hid, tutor, minor, rel, inv = _authorized_minor_invitation(client, db_path)
    con = sqlite3.connect(db_path)
    # alterar guardian_person_id del consentimiento => incoherencia detectada
    con.execute("UPDATE guardian_consents SET guardian_person_id='otro' WHERE relationship_id=?", (rel["id"],))
    con.commit(); con.close()
    _register_with_invitation(client, inv["token"], "menor-rev@sintetico.test", expect=400)


def test_r1_consent_old_policy_version_denies_acceptance(local_client):
    client, db_path = local_client
    owner, guardian, hid, tutor, minor, rel, inv = _authorized_minor_invitation(client, db_path)
    con = sqlite3.connect(db_path)
    con.execute("UPDATE guardian_consents SET policy_version='antigua-0' WHERE relationship_id=?", (rel["id"],))
    con.commit(); con.close()
    _register_with_invitation(client, inv["token"], "menor-rev@sintetico.test", expect=400)


# --- Bloqueador 5: matriz de scopes ---

def test_r1_scope_matrix(local_client):
    client, _ = local_client
    owner, guardian, hid, tutor, minor = _standard_setup(client)
    rel_full = _relationship(client, owner, hid, minor, tutor, scope="full")
    # full: los tres tipos
    for ct in ("account_creation", "module_access", "data_entry"):
        _consent(client, guardian, hid, rel_full["id"], consent_type=ct)
    otro_minor = _person(client, owner, hid, "Otro Menor Scope")
    _classify(client, owner, otro_minor, band="supervised_minor")
    rel_view = _relationship(client, owner, hid, otro_minor, tutor, scope="view")
    # view: solo module_access
    _consent(client, guardian, hid, rel_view["id"], consent_type="module_access")
    _consent(client, guardian, hid, rel_view["id"], consent_type="account_creation", expect=403)
    _consent(client, guardian, hid, rel_view["id"], consent_type="data_entry", expect=403)
    tercer_minor = _person(client, owner, hid, "Tercer Menor Scope")
    _classify(client, owner, tercer_minor, band="supervised_minor")
    rel_rec = _relationship(client, owner, hid, tercer_minor, tutor, scope="recovery")
    # recovery: NINGÚN consentimiento
    for ct in ("account_creation", "module_access", "data_entry"):
        _consent(client, guardian, hid, rel_rec["id"], consent_type=ct, expect=403)


# --- Bloqueador 6: migración recuperable de estados parciales ---

def test_r1_migration_recovers_from_partial_states(monkeypatch, tmp_path):
    import importlib
    # 1) Base con SOLO age_band presente (simula fallo tras el 1er ALTER).
    db_path = tmp_path / "partial.db"
    _base_env(monkeypatch, db_path)
    monkeypatch.setenv("APP_ENV", "test")
    sys.path.insert(0, str(API_ROOT))
    _purge_app_modules()
    # arrancar app una vez para tener el esquema base completo
    main = importlib.import_module("app.main")
    with TestClient(main.app):
        pass
    # simular estado parcial: dropear tablas/columna nuevas y dejar solo age_band
    con = sqlite3.connect(db_path)
    con.execute("DROP TABLE IF EXISTS guardian_relationships")
    con.execute("DROP TABLE IF EXISTS guardian_consents")
    # (no se puede DROP COLUMN facilmente en sqlite viejo; simulamos 'tablas ausentes')
    con.commit(); con.close()
    # 2) Replay: re-arrancar debe recrear tablas e índices pese a que age_band ya existe
    _purge_app_modules()
    main = importlib.import_module("app.main")
    with TestClient(main.app):
        pass
    con = sqlite3.connect(db_path)
    names = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type IN ('table','index')").fetchall()}
    assert "guardian_relationships" in names
    assert "guardian_consents" in names
    assert "uq_guardian_rel_active" in names
    assert con.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    con.close()


# --- Lockdown real de módulos (bloqueador 5 de ChatGPT) ---

def test_r1_finance_post_denied_in_family_pilot(monkeypatch, tmp_path):
    client, db_path = _make_pilot_client(monkeypatch, tmp_path)
    with client:
        _uid, hid = _seed_pilot_owner(db_path)
        owner = _login(client, "owner-pilot@sintetico.test")
        r = client.post("/finance/expenses", params={"household_id": hid, "amount": 100}, headers=_auth(owner))
        assert r.status_code == 403, r.text
        con = sqlite3.connect(db_path)
        n = con.execute("SELECT COUNT(*) FROM expenses WHERE household_id=?", (hid,)).fetchone()[0]
        con.close()
        assert n == 0


def test_r1_alerts_blocked_in_family_pilot(monkeypatch, tmp_path):
    client, db_path = _make_pilot_client(monkeypatch, tmp_path)
    with client:
        _uid, hid = _seed_pilot_owner(db_path)
        owner = _login(client, "owner-pilot@sintetico.test")
        r = client.get("/alerts", params={"household_id": hid}, headers=_auth(owner))
        assert r.status_code == 403, r.text


def test_r1_family_board_sensitive_types_blocked_in_family_pilot(monkeypatch, tmp_path):
    client, db_path = _make_pilot_client(monkeypatch, tmp_path)
    with client:
        _uid, hid = _seed_pilot_owner(db_path)
        owner = _login(client, "owner-pilot@sintetico.test")
        # creación de tipo sensible => 403
        for ptype in ("health", "finance", "document"):
            r = client.post(f"/family_board/{hid}", json={"post_type": ptype, "title": "x", "body": "y"}, headers=_auth(owner))
            assert r.status_code == 403, f"{ptype}: {r.text}"
        # tipo NO sensible sigue permitido
        r = client.post(f"/family_board/{hid}", json={"post_type": "notice", "title": "ok", "body": "z"}, headers=_auth(owner))
        assert r.status_code == 200, r.text
        # un post sensible inyectado directamente no se lista ni se puede tocar
        con = sqlite3.connect(db_path)
        con.execute(
            "INSERT INTO family_board_posts (id, household_id, author_user_id, post_type, title, body, priority, pinned, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?)",
            ("sensitive-post", hid, _uid, "health", "Salud", "privado", "normal", 0,
             datetime.now(timezone.utc).isoformat(), datetime.now(timezone.utc).isoformat()),
        )
        con.commit(); con.close()
        listed = client.get(f"/family_board/{hid}", headers=_auth(owner)).json()["items"]
        assert all(p["post_type"] != "health" for p in listed)
        assert client.post(f"/family_board/{hid}/sensitive-post/resolve", headers=_auth(owner)).status_code == 403
        assert client.patch(f"/family_board/{hid}/sensitive-post", json={"title": "hack"}, headers=_auth(owner)).status_code == 403
        assert client.get(f"/family_board/{hid}/sensitive-post/comments", headers=_auth(owner)).status_code == 403


# --- R1: lockdown de superficie enterprise/transversal (middleware) ---

def test_r1_enterprise_surface_blocked_in_family_pilot(monkeypatch, tmp_path):
    client, db_path = _make_pilot_client(monkeypatch, tmp_path)
    with client:
        _uid, hid = _seed_pilot_owner(db_path)
        owner = _login(client, "owner-pilot@sintetico.test")
        for path in ("/ceo/overview", "/forensics/x", "/logbook/x", "/vision/x",
                     "/scores/x", "/coupling/x", "/gerencia/x", "/organizations",
                     "/audio/x", "/library/evidence/x"):
            r = client.get(path, params={"household_id": hid}, headers=_auth(owner))
            assert r.status_code == 403, f"{path}: {r.status_code}"


def test_r1_household_export_blocked_in_family_pilot(monkeypatch, tmp_path):
    client, db_path = _make_pilot_client(monkeypatch, tmp_path)
    with client:
        _uid, hid = _seed_pilot_owner(db_path)
        owner = _login(client, "owner-pilot@sintetico.test")
        r = client.get(f"/households/{hid}/export", headers=_auth(owner))
        assert r.status_code == 403, r.text


def test_r1_family_surface_still_reachable_in_family_pilot(monkeypatch, tmp_path):
    client, db_path = _make_pilot_client(monkeypatch, tmp_path)
    with client:
        _uid, hid = _seed_pilot_owner(db_path)
        owner = _login(client, "owner-pilot@sintetico.test")
        # El middleware NO debe sobre-bloquear la superficie familiar legítima.
        assert client.get(f"/households/{hid}/members", headers=_auth(owner)).status_code == 200
        pid = _person(client, owner, hid, "Ficha Familiar")
        assert client.get(f"/persons/{pid}", headers=_auth(owner)).status_code == 200
        assert client.get(f"/family_board/{hid}", headers=_auth(owner)).status_code == 200


def test_r1_enterprise_surface_reachable_in_local(local_client):
    client, _ = local_client
    owner = _register_and_login(client, "owner-ent-local@sintetico.test")
    hid = _household(client, owner)
    # En local el middleware NO bloquea (comportamiento previo preservado):
    # la ruta responde su propio código (no 403 del middleware family-pilot).
    r = client.get(f"/households/{hid}/export", headers=_auth(owner))
    assert r.status_code in (200, 403), r.text  # 403 sería por email no verificado, no por el middleware
    assert "piloto familiar" not in r.text


# ===========================================================================
# R2 — multihogar, GET/members, support_profile, auto-org, school
# ===========================================================================

def test_r2_create_household_blocked_in_family_pilot(monkeypatch, tmp_path):
    client, db_path = _make_pilot_client(monkeypatch, tmp_path)
    with client:
        _uid, hid = _seed_pilot_owner(db_path)
        owner = _login(client, "owner-pilot@sintetico.test")
        con = sqlite3.connect(db_path)
        before = con.execute("SELECT COUNT(*) FROM households").fetchone()[0]
        orgs_before = con.execute("SELECT COUNT(*) FROM organizations").fetchone()[0]
        con.close()
        r = client.post("/households", params={"name": "Hogar Nuevo Prohibido"}, headers=_auth(owner))
        assert r.status_code == 403, r.text
        con = sqlite3.connect(db_path)
        assert con.execute("SELECT COUNT(*) FROM households").fetchone()[0] == before
        assert con.execute("SELECT COUNT(*) FROM organizations").fetchone()[0] == orgs_before
        con.close()


def test_r2_create_household_still_works_locally(local_client):
    client, _ = local_client
    owner = _register_and_login(client, "owner-local-hh@sintetico.test")
    r = client.post("/households", params={"name": "Hogar Local OK"}, headers=_auth(owner))
    assert r.status_code == 200, r.text


def test_r2_members_minimization_hides_email_and_sessions(local_client):
    client, db_path = local_client
    owner, guardian, hid, tutor, minor = _standard_setup(client)
    _full_minor_authorization(client, owner, guardian, hid, tutor, minor)
    inv = _invite(client, owner, hid, "menor-min@sintetico.test", person_id=minor, role="viewer")
    _register_with_invitation(client, inv["token"], "menor-min@sintetico.test")
    child_token = _login(client, "menor-min@sintetico.test")
    # viewer/menor: no ve email ni sesiones de OTROS; sí su propio email
    items = client.get(f"/households/{hid}/members", headers=_auth(child_token)).json()["items"]
    for it in items:
        is_self = it.get("email") == "menor-min@sintetico.test"
        if not is_self:
            assert "email" not in it, f"email ajeno filtrado: {it}"
            assert "active_sessions" not in it
            assert "last_seen_at" not in it
    # owner conserva vista administrativa completa
    admin_items = client.get(f"/households/{hid}/members", headers=_auth(owner)).json()["items"]
    assert any("email" in it and "active_sessions" in it for it in admin_items)


def test_r2_support_profile_denied_in_family_pilot(monkeypatch, tmp_path):
    client, db_path = _make_pilot_client(monkeypatch, tmp_path)
    with client:
        _uid, hid = _seed_pilot_owner(db_path)
        owner = _login(client, "owner-pilot@sintetico.test")
        pid = _person(client, owner, hid, "Ficha Apoyo")
        r = client.get(f"/persons/{pid}/support_profile", params={"household_id": hid}, headers=_auth(owner))
        assert r.status_code == 403, r.text
        r = client.put(f"/persons/{pid}/support_profile",
                       json={"household_id": hid, "health_notes": "x"}, headers=_auth(owner))
        assert r.status_code == 403, r.text


def test_r2_support_profile_cross_household_isolation(local_client):
    client, _ = local_client
    owner_a = _register_and_login(client, "owner-a-sp@sintetico.test")
    hid_a = _household(client, owner_a, "Hogar A SP")
    pid_a = _person(client, owner_a, hid_a, "Persona A")
    client.put(f"/persons/{pid_a}/support_profile",
               json={"household_id": hid_a, "health_notes": "secreto A"}, headers=_auth(owner_a))
    owner_b = _register_and_login(client, "owner-b-sp@sintetico.test")
    hid_b = _household(client, owner_b, "Hogar B SP")
    # owner de B intenta leer/escribir el perfil de una persona del hogar A pasando SU hogar
    r = client.get(f"/persons/{pid_a}/support_profile", params={"household_id": hid_b}, headers=_auth(owner_b))
    assert r.status_code in (403, 404), r.text
    r = client.put(f"/persons/{pid_a}/support_profile",
                   json={"household_id": hid_b, "health_notes": "hack B"}, headers=_auth(owner_b))
    assert r.status_code in (403, 404), r.text


def test_r2_support_profile_self_resolves_by_user_id(local_client):
    client, _ = local_client
    owner, guardian, hid, tutor, _minor = _standard_setup(client)
    # guardian (admin) tiene ficha 'tutor' vinculada; escribir su perfil como owner
    client.put(f"/persons/{tutor}/support_profile",
               json={"household_id": hid, "health_notes": "nota tutor", "caregiver_notes": "cuid"},
               headers=_auth(owner))
    # el titular (guardian) lee su propio perfil sin 500 y ve los campos sensibles
    r = client.get(f"/persons/{tutor}/support_profile", params={"household_id": hid}, headers=_auth(guardian))
    assert r.status_code == 200, r.text
    assert r.json().get("health_notes") == "nota tutor"


def test_r2_get_households_does_not_autoprovision_org_in_family_pilot(monkeypatch, tmp_path):
    client, db_path = _make_pilot_client(monkeypatch, tmp_path)
    with client:
        _uid, hid = _seed_pilot_owner(db_path)
        # invitar a un segundo adulto por la vía correcta y que liste hogares
        owner = _login(client, "owner-pilot@sintetico.test")
        tutor = _person(client, owner, hid, "Adulto Dos")
        client.patch(f"/persons/{tutor}/classification", json={"age_band": "adult"}, headers=_auth(owner))
        inv = _invite(client, owner, hid, "adulto2-org@sintetico.test", person_id=tutor, role="member")
        _register_with_invitation(client, inv["token"], "adulto2-org@sintetico.test")
        con = sqlite3.connect(db_path)
        orgs_before = con.execute("SELECT COUNT(*) FROM organizations").fetchone()[0]
        om_before = con.execute("SELECT COUNT(*) FROM organization_memberships").fetchone()[0] if \
            con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='organization_memberships'").fetchone() else 0
        con.close()
        adulto2 = _login(client, "adulto2-org@sintetico.test")
        r = client.get("/households", headers=_auth(adulto2))
        assert r.status_code == 200, r.text
        con = sqlite3.connect(db_path)
        assert con.execute("SELECT COUNT(*) FROM organizations").fetchone()[0] == orgs_before
        con.close()


def test_r2_family_board_school_blocked_in_family_pilot(monkeypatch, tmp_path):
    client, db_path = _make_pilot_client(monkeypatch, tmp_path)
    with client:
        _uid, hid = _seed_pilot_owner(db_path)
        owner = _login(client, "owner-pilot@sintetico.test")
        r = client.post(f"/family_board/{hid}", json={"post_type": "school", "title": "x", "body": "y"}, headers=_auth(owner))
        assert r.status_code == 403, r.text
        # inyectar uno school y confirmar que no se lista
        con = sqlite3.connect(db_path)
        con.execute(
            "INSERT INTO family_board_posts (id, household_id, author_user_id, post_type, title, body, priority, pinned, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?)",
            ("school-post", hid, _uid, "school", "Colegio", "privado", "normal", 0,
             datetime.now(timezone.utc).isoformat(), datetime.now(timezone.utc).isoformat()),
        )
        con.commit(); con.close()
        listed = client.get(f"/family_board/{hid}", headers=_auth(owner)).json()["items"]
        assert all(p["post_type"] != "school" for p in listed)


# ===========================================================================
# 1b.2 — aceptación con token en body, legacy bloqueada, minimización residual
# ===========================================================================

def test_b2_accept_by_body_token(local_client):
    client, db_path = local_client
    owner = _register_and_login(client, "owner-b2body@sintetico.test")
    hid = _household(client, owner)
    pid = _person(client, owner, hid, "Adulto B2")
    _classify(client, owner, pid, band="adult")
    guest_email = "invitado-b2body@sintetico.test"
    guest = _register_and_login(client, guest_email)
    inv = _invite(client, owner, hid, guest_email, person_id=pid, role="member")
    # aceptar con token en BODY (no en pathname)
    r = client.post("/households/invitations/accept", json={"token": inv["token"]}, headers=_auth(guest))
    assert r.status_code == 200, r.text
    assert r.json()["linked_person_id"] == pid
    # reuso => rechazado
    r = client.post("/households/invitations/accept", json={"token": inv["token"]}, headers=_auth(guest))
    assert r.status_code in (400, 409), r.text


def test_b2_legacy_pathname_accept_blocked_in_family_pilot(monkeypatch, tmp_path):
    client, db_path = _make_pilot_client(monkeypatch, tmp_path)
    with client:
        _uid, hid = _seed_pilot_owner(db_path)
        owner = _login(client, "owner-pilot@sintetico.test")
        pid = _person(client, owner, hid, "Adulto Legacy")
        client.patch(f"/persons/{pid}/classification", json={"age_band": "adult"}, headers=_auth(owner))
        inv = _invite(client, owner, hid, "legacy-b2@sintetico.test", person_id=pid, role="member")
        # ruta legacy con token en pathname => fail-closed 404, sin exponer el token
        r = client.post(f"/households/invitations/{inv['token']}/accept", headers=_auth(owner))
        assert r.status_code == 404, r.text


def test_b2_legacy_pathname_accept_works_locally(local_client):
    client, _ = local_client
    owner = _register_and_login(client, "owner-legacy-local@sintetico.test")
    hid = _household(client, owner)
    pid = _person(client, owner, hid, "Adulto LL")
    _classify(client, owner, pid, band="adult")
    email = "invitado-legacy-local@sintetico.test"
    guest = _register_and_login(client, email)
    inv = _invite(client, owner, hid, email, person_id=pid, role="member")
    r = client.post(f"/households/invitations/{inv['token']}/accept", headers=_auth(guest))
    assert r.status_code == 200, r.text


def test_b2_members_no_third_party_user_id_in_family_pilot(monkeypatch, tmp_path):
    client, db_path = _make_pilot_client(monkeypatch, tmp_path)
    with client:
        _uid, hid = _seed_pilot_owner(db_path)
        owner = _login(client, "owner-pilot@sintetico.test")
        tutor = _person(client, owner, hid, "Tutor B2")
        client.patch(f"/persons/{tutor}/classification", json={"age_band": "adult"}, headers=_auth(owner))
        inv = _invite(client, owner, hid, "tutor-b2@sintetico.test", person_id=tutor, role="admin")
        _register_with_invitation(client, inv["token"], "tutor-b2@sintetico.test")
        minor = _person(client, owner, hid, "Menor B2")
        client.patch(f"/persons/{minor}/classification", json={"age_band": "supervised_minor"}, headers=_auth(owner))
        guardian = _login(client, "tutor-b2@sintetico.test")
        rel = client.post(f"/households/{hid}/guardians/relationships",
                          json={"minor_person_id": minor, "guardian_person_id": tutor, "scope": "full"},
                          headers=_auth(owner)).json()
        client.post(f"/households/{hid}/guardians/consents",
                    json={"relationship_id": rel["id"], "consent_type": "account_creation"}, headers=_auth(guardian))
        inv2 = _invite(client, owner, hid, "menor-b2@sintetico.test", person_id=minor, role="viewer")
        _register_with_invitation(client, inv2["token"], "menor-b2@sintetico.test")
        child = _login(client, "menor-b2@sintetico.test")
        items = client.get(f"/households/{hid}/members", headers=_auth(child)).json()["items"]
        for it in items:
            if it.get("is_self"):
                continue
            assert "user_id" not in it, f"user_id de tercero filtrado: {it}"
            assert "email" not in it


def test_b2_households_hides_org_id_in_family_pilot(monkeypatch, tmp_path):
    client, db_path = _make_pilot_client(monkeypatch, tmp_path)
    with client:
        _uid, hid = _seed_pilot_owner(db_path)
        owner = _login(client, "owner-pilot@sintetico.test")
        items = client.get("/households", headers=_auth(owner)).json()["items"]
        assert items, "debe listar al menos el hogar del piloto"
        for it in items:
            assert "organization_id" not in it, f"organization_id expuesto: {it}"
            assert set(it.keys()) <= {"id", "name"}


def test_b2_register_with_invitation_token_not_in_response_family_pilot(monkeypatch, tmp_path):
    client, db_path = _make_pilot_client(monkeypatch, tmp_path)
    with client:
        _uid, hid = _seed_pilot_owner(db_path)
        owner = _login(client, "owner-pilot@sintetico.test")
        pid = _person(client, owner, hid, "Adulto Tok")
        client.patch(f"/persons/{pid}/classification", json={"age_band": "adult"}, headers=_auth(owner))
        inv = _invite(client, owner, hid, "adulto-tok-b2@sintetico.test", person_id=pid, role="member")
        r = client.post("/auth/register-with-invitation",
                        json={"token": inv["token"], "email": "adulto-tok-b2@sintetico.test", "password": PASSWORD})
        assert r.status_code == 200, r.text
        assert "token" not in r.json()
