"""
OPS-1 — Test del bootstrap de usuario admin (canal de confianza, registro cerrado).

Verifica creación (activo + verificado + owner de un hogar) e idempotencia
(rerun actualiza clave, no duplica hogar). Base SQLite temporal migrada; sin red.
Ejecutar: python -m pytest tests/test_bootstrap_admin.py -q
"""
import sys
from pathlib import Path

import pytest

API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))


@pytest.fixture()
def migrated_db(tmp_path, monkeypatch):
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("VANTDOMUS_SKIP_LOCAL_ENV", "1")
    monkeypatch.setenv("DB_PATH", str(tmp_path / "admin.db"))
    monkeypatch.delenv("DATABASE_URL", raising=False)
    import importlib
    import app.config as cfg
    importlib.reload(cfg)
    import app.db as db
    importlib.reload(db)
    db.ensure_schema()
    return db


def test_create_admin_owner(migrated_db):
    from scripts.bootstrap_admin import bootstrap_admin
    from app.security import verify_password
    r = bootstrap_admin("master@test.local", "SuperClave123", "Hogar Master")
    assert r["user_action"] == "creado"
    assert r["home_status"] == "hogar creado"
    con = migrated_db.connect()
    u = con.execute(
        "SELECT id, is_active, email_verified_at, password_hash FROM users WHERE email=?",
        ("master@test.local",),
    ).fetchone()
    assert u["is_active"] == 1
    assert u["email_verified_at"]  # verificado
    assert verify_password("SuperClave123", u["password_hash"])
    m = con.execute(
        "SELECT role FROM household_memberships WHERE user_id=? AND household_id=?",
        (u["id"], r["household_id"]),
    ).fetchone()
    assert m["role"] == "owner"


def test_idempotent_updates_password_no_duplicate_home(migrated_db):
    from scripts.bootstrap_admin import bootstrap_admin
    from app.security import verify_password
    r1 = bootstrap_admin("master@test.local", "SuperClave123", "Hogar Master")
    r2 = bootstrap_admin("master@test.local", "OtraClave456", "Hogar Master")
    assert r2["user_action"] == "actualizado"
    assert r2["household_id"] == r1["household_id"]  # no duplica hogar
    con = migrated_db.connect()
    u = con.execute("SELECT id, password_hash FROM users WHERE email=?", ("master@test.local",)).fetchone()
    assert not verify_password("SuperClave123", u["password_hash"])  # clave vieja invalidada
    assert verify_password("OtraClave456", u["password_hash"])       # clave nueva válida
    n = con.execute(
        "SELECT COUNT(*) c FROM household_memberships WHERE user_id=? AND role='owner'",
        (u["id"],),
    ).fetchone()
    assert n["c"] == 1


def test_rejects_bad_input(migrated_db):
    from scripts.bootstrap_admin import bootstrap_admin
    with pytest.raises(SystemExit):
        bootstrap_admin("no-arroba", "SuperClave123")
    with pytest.raises(SystemExit):
        bootstrap_admin("ok@test.local", "corta")  # < 8 chars
