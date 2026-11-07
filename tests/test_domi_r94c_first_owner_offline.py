"""R94-C first fictional owner: no public registration, no password argv, no resets."""
from __future__ import annotations

import importlib
import sqlite3
import sys
from pathlib import Path

import pytest

API = Path(__file__).resolve().parents[1] / "apps" / "api"
if str(API) not in sys.path:
    sys.path.insert(0, str(API))

PASSWORD = "Only-Fictional-Strong!2026"
EMAIL = "first.owner@example.invalid"


@pytest.fixture
def lab(monkeypatch, tmp_path):
    disk = tmp_path / "isolated-disk"
    disk.mkdir()
    env = {
        "VANTDOMUS_SKIP_LOCAL_ENV": "1",
        "APP_ENV": "family-pilot",
        "DB_PATH": str(disk / "r94c-only-fictional.sqlite"),
        "DATABASE_URL": "",
        "JWT_SECRET": "r94c-fixture-jwt-key-32chars-not-real-2026",
        "VANTDOMUS_MFA_SECRET_KEY": "r94c-fixture-mfa-key-32chars-not-real",
        "VANTDOMUS_ALLOWED_HOSTS": "domi.lab.example.invalid",
        "VANTDOMUS_API_ALLOWED_HOSTS": "127.0.0.1",
        "VANTDOMUS_APP_PUBLIC_URL": "https://domi.lab.example.invalid",
        "CORS_ALLOWED_ORIGINS": "https://domi.lab.example.invalid",
        "VANTDOMUS_PUBLIC_REGISTRATION": "false",
        "VANTDOMUS_API_RATE_LIMIT_MODE": "memory",
        "VANTDOMUS_BACKEND_INSTANCES": "1",
        "VANTDOMUS_ENABLE_PUBLIC_UPLOADS": "false",
        "ASSISTANT_PROVIDER_MODE": "mock",
        "ASSISTANT_REAL_PROVIDER_ENABLED": "false",
        "ASSISTANT_SHADOW_MODE": "false",
        "ASSISTANT_EXTERNAL_CALLS_ALLOWED": "false",
        "OPENAI_API_KEY": "",
    }
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    # Configuration is loaded at import; reload only configuration and DB,
    # exactly as existing test_bootstrap_admin.py does.
    import app.config as config
    importlib.reload(config)
    import app.db as db
    importlib.reload(db)
    db.ensure_schema()
    # Previous tests in the *full* suite may already have imported the
    # legacy module, whose `from app.db import connect` captured a function
    # object from an older isolated fixture. Rebind it to this test's DB.
    import scripts.bootstrap_admin as legacy
    importlib.reload(legacy)
    import scripts.bootstrap_first_owner_r94c as first
    importlib.reload(first)
    return first, db, env


def test_closed_family_pilot_bootstrap_creates_owner_and_person(lab):
    first, db, env = lab
    result = first.bootstrap_first_owner(EMAIL, PASSWORD, "Hogar inventado R94-C")
    assert result["user_action"] == "creado"
    assert result["home_status"] == "hogar creado"
    assert result["persona_status"] == "ficha creada"
    conn = db.connect()
    try:
        row = conn.execute("SELECT id, password_hash, is_active, email_verified_at FROM users WHERE email=?", (EMAIL,)).fetchone()
        assert row["is_active"] == 1 and row["email_verified_at"]
        from app.security import verify_password
        assert verify_password(PASSWORD, row["password_hash"])
        member = conn.execute("SELECT role FROM household_memberships WHERE household_id=? AND user_id=?",
                              (result["household_id"], row["id"])).fetchone()
        assert member["role"] == "owner"
        person = conn.execute("SELECT age_band, user_id FROM persons WHERE household_id=?",
                              (result["household_id"],)).fetchone()
        assert person["user_id"] == row["id"] and person["age_band"] == "adult"
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 1
    finally:
        conn.close()
    from app.config import public_registration_enabled
    assert public_registration_enabled() is False


def test_second_run_never_resets_existing_owner(lab):
    first, db, _ = lab
    first.bootstrap_first_owner(EMAIL, PASSWORD)
    with pytest.raises(SystemExit, match="R94C_DATABASE_NOT_EMPTY"):
        first.bootstrap_first_owner(EMAIL, "Altered-Fictional-Strong!2026")
    conn = db.connect()
    try:
        from app.security import verify_password
        row = conn.execute("SELECT password_hash FROM users WHERE email=?", (EMAIL,)).fetchone()
        assert verify_password(PASSWORD, row["password_hash"])
        assert not verify_password("Altered-Fictional-Strong!2026", row["password_hash"])
        assert conn.execute("SELECT COUNT(*) FROM households").fetchone()[0] == 1
    finally:
        conn.close()


@pytest.mark.parametrize("email,password,home", [
    ("owner@realcompany.com", PASSWORD, "Hogar inventado"),
    ("owner@example.invalid.attacker.com", PASSWORD, "Hogar inventado"),
    ("owner+test@example.invalid", "short", "Hogar inventado"),
    (EMAIL, PASSWORD, ""),
])
def test_refuses_nonfictional_or_weak_input_before_writing(lab,email,password,home):
    first, db, _ = lab
    with pytest.raises(SystemExit, match="R94C_SYNTHETIC_INPUT_INVALID"):
        first.bootstrap_first_owner(email,password,home)
    c=db.connect()
    try:
        assert c.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
    finally: c.close()


def test_refuses_registration_open_or_wrong_profile(lab, monkeypatch):
    first, db, env=lab
    monkeypatch.setenv("VANTDOMUS_PUBLIC_REGISTRATION","true")
    with pytest.raises(SystemExit,match="R94C_REFUSED_PROFILE_OR_PUBLIC_REGISTRATION"):
        first.bootstrap_first_owner(EMAIL,PASSWORD)
    monkeypatch.setenv("VANTDOMUS_PUBLIC_REGISTRATION","false")
    monkeypatch.setenv("APP_ENV","local")
    import app.config as config
    importlib.reload(config)
    with pytest.raises(SystemExit,match="R94C_REFUSED_PROFILE_OR_PUBLIC_REGISTRATION"):
        first.bootstrap_first_owner(EMAIL,PASSWORD)
    c=db.connect()
    try:
        assert c.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
    finally: c.close()


def test_bad_security_profile_is_denied(lab, monkeypatch):
    first, db, _=lab
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS","*")
    with pytest.raises(SystemExit,match="R94C_RUNTIME_SECURITY_REJECTED"):
        first.bootstrap_first_owner(EMAIL,PASSWORD)
    c=db.connect()
    try:
        assert c.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
    finally: c.close()


def test_cli_requires_confirmation_and_refuses_noninteractive_and_password_argv(lab, monkeypatch, capsys):
    first, _db, _=lab
    with pytest.raises(SystemExit,match="R94C_EXPLICIT_SYNTHETIC_CONFIRMATION_REQUIRED"):
        first.main(["--email",EMAIL])
    with pytest.raises(SystemExit,match="R94C_UNKNOWN_ARGUMENTS_REDACTED"):
        first.main(["--email",EMAIL,"--confirm-synthetic","--password","secret-must-never-appear"])
    assert "secret-must-never-appear" not in capsys.readouterr().err
    class FakeStdin:
        def isatty(self): return False
    monkeypatch.setattr(sys,"stdin",FakeStdin())
    with pytest.raises(SystemExit,match="R94C_INTERACTIVE_TERMINAL_REQUIRED"):
        first.main(["--email",EMAIL,"--confirm-synthetic"])
