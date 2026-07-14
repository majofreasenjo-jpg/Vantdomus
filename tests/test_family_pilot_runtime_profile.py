"""
CP1d-FAMILY-PILOT-1a-DEPLOY-PREFLIGHT — Tests del perfil runtime family-pilot.

Cubre los puntos obligatorios del gate:
1.  family-pilot ejecuta validación de seguridad (no retorna temprano);
2.  rechaza JWT default o corto;
3.  rechaza registro público abierto;
4.  rechaza CORS wildcard/localhost;
5.  exige URL HTTPS;
6.  exige DB_PATH persistente fuera del repo y fuera de /tmp;
7.  exige provider mock;
8.  rechaza llamadas externas de IA;
9.  acepta rate limiter memory SOLO con una instancia;
10. rechaza múltiples instancias sin Redis;
12. fallo de email post-commit NO revierte usuario/membresía/vínculo;
13. reenvío de verificación es controlado (rate limit);
+   el token de verificación NO se expone en respuestas online (family-pilot).

(11 = cookies Secure: apps/web/tests/cookie-secure.test.mjs, node --test.)
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


def _fresh_config(monkeypatch, tmp_path, **overrides):
    """Carga app.config con un perfil family-pilot VÁLIDO + overrides."""
    disk = tmp_path / "disk"
    disk.mkdir(exist_ok=True)
    base = {
        "APP_ENV": "family-pilot",
        "DB_PATH": str(disk / "vantdomus.db"),
        "DATABASE_URL": "",
        "JWT_SECRET": "family-pilot-strong-jwt-secret-32ch!",
        "VANTDOMUS_MFA_SECRET_KEY": "family-pilot-strong-mfa-key-32-chars",
        "VANTDOMUS_APP_PUBLIC_URL": "https://familia.example.test",
        # Debe incluir el host de la API Y el host público (vínculo obligatorio).
        "VANTDOMUS_ALLOWED_HOSTS": "familia-api.example.test,familia.example.test",
        "CORS_ALLOWED_ORIGINS": "https://familia.example.test",
        "VANTDOMUS_PUBLIC_REGISTRATION": "false",
        "VANTDOMUS_API_RATE_LIMIT_MODE": "memory",
        "VANTDOMUS_BACKEND_INSTANCES": "1",
    }
    base.update(overrides)
    for key, value in base.items():
        if value is None:
            monkeypatch.delenv(key, raising=False)
        else:
            monkeypatch.setenv(key, value)
    sys.path.insert(0, str(API_ROOT))
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]
    return importlib.import_module("app.config")


def _expect_runtime_error(monkeypatch, tmp_path, fragment: str, **overrides):
    config = _fresh_config(monkeypatch, tmp_path, **overrides)
    with pytest.raises(RuntimeError) as exc:
        config.validate_runtime_security()
    assert fragment.lower() in str(exc.value).lower(), str(exc.value)


# ---------------------------------------------------------------------------
# 1 + 9. Perfil válido pasa; la validación efectivamente se ejecuta
# ---------------------------------------------------------------------------

def test_family_pilot_valid_profile_passes_with_memory_single_instance(monkeypatch, tmp_path):
    config = _fresh_config(monkeypatch, tmp_path)
    assert config.is_family_pilot() is True
    # 9: memory + una instancia = aceptado (única condición tolerada).
    config.validate_runtime_security()
    # La puerta queda cerrada por perfil (fail-closed, sin depender del flag).
    monkeypatch.delenv("VANTDOMUS_PUBLIC_REGISTRATION", raising=False)
    assert config.public_registration_enabled() is False


def test_family_pilot_actually_runs_validation(monkeypatch, tmp_path):
    # Si la validación se saltara family-pilot (bug original con demo), este
    # perfil inválido pasaría en silencio.
    _expect_runtime_error(monkeypatch, tmp_path, "JWT_SECRET", JWT_SECRET="CHANGE_ME_SUPER_SECRET")


# ---------------------------------------------------------------------------
# 2-8, 10. Rechazos obligatorios
# ---------------------------------------------------------------------------

def test_family_pilot_rejects_short_jwt(monkeypatch, tmp_path):
    _expect_runtime_error(monkeypatch, tmp_path, "JWT_SECRET", JWT_SECRET="corto")


def test_family_pilot_rejects_open_public_registration(monkeypatch, tmp_path):
    _expect_runtime_error(
        monkeypatch, tmp_path, "VANTDOMUS_PUBLIC_REGISTRATION",
        VANTDOMUS_PUBLIC_REGISTRATION="true",
    )


def test_family_pilot_rejects_wildcard_and_localhost_cors(monkeypatch, tmp_path):
    _expect_runtime_error(monkeypatch, tmp_path, "CORS_ALLOWED_ORIGINS", CORS_ALLOWED_ORIGINS="*")
    _expect_runtime_error(
        monkeypatch, tmp_path, "localhost",
        CORS_ALLOWED_ORIGINS="https://familia.example.test,http://localhost:3000",
    )


def test_family_pilot_requires_https_public_url(monkeypatch, tmp_path):
    _expect_runtime_error(
        monkeypatch, tmp_path, "https",
        VANTDOMUS_APP_PUBLIC_URL="http://familia.example.test",
    )


def test_family_pilot_requires_persistent_db_path(monkeypatch, tmp_path):
    # Dentro del árbol del repo: rechazado (se pierde en cada redeploy/clone).
    _expect_runtime_error(
        monkeypatch, tmp_path, "repo",
        DB_PATH=str(API_ROOT / "vantdomus.db"),
    )
    # /tmp: rechazado (no persiste entre redeploys).
    _expect_runtime_error(monkeypatch, tmp_path, "/tmp", DB_PATH="/tmp/vantdomus.db")


def test_family_pilot_requires_mock_provider(monkeypatch, tmp_path):
    _expect_runtime_error(
        monkeypatch, tmp_path, "ASSISTANT_PROVIDER_MODE",
        ASSISTANT_PROVIDER_MODE="openai",
    )


def test_family_pilot_rejects_external_ai_calls(monkeypatch, tmp_path):
    _expect_runtime_error(
        monkeypatch, tmp_path, "ASSISTANT_EXTERNAL_CALLS_ALLOWED",
        ASSISTANT_EXTERNAL_CALLS_ALLOWED="true",
    )
    _expect_runtime_error(
        monkeypatch, tmp_path, "ASSISTANT_REAL_PROVIDER_ENABLED",
        ASSISTANT_REAL_PROVIDER_ENABLED="true",
    )


def test_family_pilot_rejects_multiple_instances_without_redis(monkeypatch, tmp_path):
    _expect_runtime_error(
        monkeypatch, tmp_path, "one backend instance",
        VANTDOMUS_BACKEND_INSTANCES="2",
    )


def test_family_pilot_rejects_rate_limit_off(monkeypatch, tmp_path):
    _expect_runtime_error(
        monkeypatch, tmp_path, "RATE_LIMIT",
        VANTDOMUS_API_RATE_LIMIT_MODE="off",
    )


def test_production_checks_remain_strict(monkeypatch, tmp_path):
    # No debilitar production: sin Redis explícito debe seguir fallando.
    config = _fresh_config(
        monkeypatch, tmp_path,
        APP_ENV="production",
        JWT_SECRET="production-strong-jwt-secret-32ch!!",
    )
    with pytest.raises(RuntimeError):
        config.validate_runtime_security()


# ---------------------------------------------------------------------------
# Token de verificación NUNCA expuesto en respuestas online
# ---------------------------------------------------------------------------

def test_verification_token_not_exposed_in_family_pilot_responses(monkeypatch, tmp_path):
    _fresh_config(monkeypatch, tmp_path)  # APP_ENV=family-pilot + módulos frescos
    auth = importlib.import_module("app.routes.auth")
    assert auth._local_token_payload("super-token-sintetico") == {}
    monkeypatch.setenv("APP_ENV", "local")
    assert auth._local_token_payload("super-token-sintetico") == {"token": "super-token-sintetico"}


# ---------------------------------------------------------------------------
# 12-13. Email como efecto lateral post-commit + reenvío controlado
# ---------------------------------------------------------------------------

def _make_local_client(monkeypatch, tmp_path):
    db_path = tmp_path / "family-pilot-runtime-tests.db"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DB_PATH", str(db_path))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JWT_SECRET", "family-pilot-tests-secret-32-chars-x")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "family-pilot-tests-mfa-key-32-char")
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS", "testserver,localhost,127.0.0.1")
    monkeypatch.delenv("VANTDOMUS_PUBLIC_REGISTRATION", raising=False)
    sys.path.insert(0, str(API_ROOT))
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]
    main = importlib.import_module("app.main")
    return TestClient(main.app), db_path


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _register_and_login(client, email: str) -> str:
    r = client.post("/auth/register", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    r = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_email_failure_after_commit_does_not_revert_account(monkeypatch, tmp_path):
    client, db_path = _make_local_client(monkeypatch, tmp_path)
    with client:
        owner = _register_and_login(client, "owner-mail@sintetico.test")
        r = client.post("/households", params={"name": "Hogar Mail"}, headers=_auth(owner))
        hid = r.json()["id"]
        r = client.post(
            "/persons",
            params={"household_id": hid, "display_name": "Hija Mail", "relation": "Hija"},
            headers=_auth(owner),
        )
        person_id = r.json()["id"]
        r = client.post(
            f"/households/{hid}/invitations",
            json={"email": "hija-mail@sintetico.test", "role": "member", "person_id": person_id},
            headers=_auth(owner),
        )
        assert r.status_code == 200, r.text
        inv = r.json()

        # El proveedor de email explota DESPUÉS del commit de la cuenta.
        auth_mod = sys.modules["app.routes.auth"]

        def _boom(*args, **kwargs):
            raise RuntimeError("proveedor de email caído (sintético)")

        monkeypatch.setattr(auth_mod, "_send_email_verification", _boom)

        r = client.post(
            "/auth/register-with-invitation",
            json={"token": inv["token"], "email": "hija-mail@sintetico.test", "password": PASSWORD},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["email_delivery"]["ok"] is False
        assert "token" not in body  # sin token si el envío falló

        # La cuenta, la membresía, el vínculo y la consumación PERSISTEN.
        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row
        user = con.execute("SELECT id FROM users WHERE email=?", ("hija-mail@sintetico.test",)).fetchone()
        assert user is not None
        assert con.execute(
            "SELECT COUNT(*) FROM household_memberships WHERE household_id=? AND user_id=?", (hid, user["id"]),
        ).fetchone()[0] == 1
        assert con.execute("SELECT user_id FROM persons WHERE id=?", (person_id,)).fetchone()["user_id"] == user["id"]
        assert con.execute(
            "SELECT accepted_at FROM household_invitations WHERE id=?", (inv["id"],),
        ).fetchone()["accepted_at"] is not None
        # Filtrar por stage: el registro normal del owner también emite un
        # delivery_failed benigno cuando no hay SMTP en el entorno de test.
        failed_events = con.execute(
            "SELECT COUNT(*) FROM security_events WHERE event_type='email_verification_delivery_failed' "
            "AND metadata LIKE '%post_commit_register_with_invitation%'"
        ).fetchone()[0]
        con.close()
        assert failed_events == 1

        # El nuevo integrante puede iniciar sesión y pedir REENVÍO seguro.
        r = client.post("/auth/login", json={"email": "hija-mail@sintetico.test", "password": PASSWORD})
        assert r.status_code == 200, r.text


def test_verification_resend_is_rate_limited(monkeypatch, tmp_path):
    client, _ = _make_local_client(monkeypatch, tmp_path)
    with client:
        token = _register_and_login(client, "resend@sintetico.test")
        statuses = []
        for _ in range(4):
            r = client.post("/auth/email/verification/request", headers=_auth(token))
            statuses.append(r.status_code)
        assert statuses[:3] == [200, 200, 200], statuses
        assert statuses[3] == 429, statuses


# ---------------------------------------------------------------------------
# Microcorrección final (auditoría 7eba5c3): host binding + CORS estricto
# ---------------------------------------------------------------------------

def test_family_pilot_public_url_host_must_be_in_allowed_hosts(monkeypatch, tmp_path):
    _expect_runtime_error(
        monkeypatch, tmp_path, "must include the host",
        VANTDOMUS_APP_PUBLIC_URL="https://api-real.example.test",
        VANTDOMUS_ALLOWED_HOSTS="otro-host.example.test",
    )


def test_family_pilot_rejects_malformed_cors_origins(monkeypatch, tmp_path):
    # No es URL.
    _expect_runtime_error(
        monkeypatch, tmp_path, "malformed",
        CORS_ALLOWED_ORIGINS="no-es-una-url",
    )
    # Scheme no https.
    _expect_runtime_error(
        monkeypatch, tmp_path, "malformed",
        CORS_ALLOWED_ORIGINS="ftp://familia.example.test",
    )
    # Origen con path (un origen CORS es scheme://host, sin ruta).
    _expect_runtime_error(
        monkeypatch, tmp_path, "malformed",
        CORS_ALLOWED_ORIGINS="https://familia.example.test/app",
    )


def test_family_pilot_loopback_is_detected_by_hostname_not_substring(monkeypatch, tmp_path):
    # Hostname engañoso que CONTIENE "localhost" pero es un dominio legítimo:
    # NO debe rechazarse (chequeo por hostname exacto, no substring).
    config = _fresh_config(
        monkeypatch, tmp_path,
        VANTDOMUS_APP_PUBLIC_URL="https://notlocalhost.example.test",
        VANTDOMUS_ALLOWED_HOSTS="notlocalhost.example.test",
        CORS_ALLOWED_ORIGINS="https://notlocalhost.example.test",
    )
    config.validate_runtime_security()
    # Loopback real por hostname exacto: rechazado aunque tenga https.
    _expect_runtime_error(
        monkeypatch, tmp_path, "localhost",
        CORS_ALLOWED_ORIGINS="https://localhost",
    )
    _expect_runtime_error(
        monkeypatch, tmp_path, "loopback",
        VANTDOMUS_APP_PUBLIC_URL="https://127.0.0.1",
        VANTDOMUS_ALLOWED_HOSTS="familia-api.example.test,127.0.0.1",
    )


# ---------------------------------------------------------------------------
# Microcorrección final: modo de rate limit completamente validado
# ---------------------------------------------------------------------------

def test_family_pilot_rejects_unknown_rate_limit_mode(monkeypatch, tmp_path):
    _expect_runtime_error(
        monkeypatch, tmp_path, "memory or redis",
        VANTDOMUS_API_RATE_LIMIT_MODE="banana",
    )


def test_family_pilot_rejects_zero_or_negative_instances(monkeypatch, tmp_path):
    _expect_runtime_error(monkeypatch, tmp_path, ">= 1", VANTDOMUS_BACKEND_INSTANCES="0")
    _expect_runtime_error(monkeypatch, tmp_path, ">= 1", VANTDOMUS_BACKEND_INSTANCES="-2")
    _expect_runtime_error(monkeypatch, tmp_path, "integer", VANTDOMUS_BACKEND_INSTANCES="dos")


def test_family_pilot_redis_requires_url(monkeypatch, tmp_path):
    _expect_runtime_error(
        monkeypatch, tmp_path, "VANTDOMUS_REDIS_URL",
        VANTDOMUS_API_RATE_LIMIT_MODE="redis",
        VANTDOMUS_REDIS_URL=None,
    )


def test_family_pilot_valid_redis_with_replicas_passes(monkeypatch, tmp_path):
    config = _fresh_config(
        monkeypatch, tmp_path,
        VANTDOMUS_API_RATE_LIMIT_MODE="redis",
        VANTDOMUS_REDIS_URL="redis://redis.example.test:6379/0",
        VANTDOMUS_BACKEND_INSTANCES="2",
    )
    config.validate_runtime_security()


# ---------------------------------------------------------------------------
# Microcorrección final: token DURABLE antes del efecto externo
# ---------------------------------------------------------------------------

def _setup_invitation(client, owner_email, guest_email):
    owner = _register_and_login(client, owner_email)
    r = client.post("/households", params={"name": "Hogar Token"}, headers=_auth(owner))
    hid = r.json()["id"]
    r = client.post(
        f"/households/{hid}/invitations",
        json={"email": guest_email, "role": "member"},
        headers=_auth(owner),
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_token_persist_failure_skips_email_provider(monkeypatch, tmp_path):
    client, db_path = _make_local_client(monkeypatch, tmp_path)
    with client:
        inv = _setup_invitation(client, "duenio-tok@sintetico.test", "invitada-tok@sintetico.test")
        auth_mod = sys.modules["app.routes.auth"]
        send_calls = []

        def _token_boom(*args, **kwargs):
            raise RuntimeError("persistencia de token caída (sintético)")

        def _spy_send(*args, **kwargs):
            send_calls.append(1)
            return {"ok": True, "provider": "spy"}

        monkeypatch.setattr(auth_mod, "_create_email_verification_token", _token_boom)
        monkeypatch.setattr(auth_mod, "_send_email_verification", _spy_send)

        r = client.post(
            "/auth/register-with-invitation",
            json={"token": inv["token"], "email": "invitada-tok@sintetico.test", "password": PASSWORD},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["email_delivery"]["ok"] is False
        assert "token" not in body
        # El proveedor de email NUNCA fue llamado.
        assert send_calls == []

        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row
        user = con.execute("SELECT id FROM users WHERE email=?", ("invitada-tok@sintetico.test",)).fetchone()
        assert user is not None  # la cuenta persiste igual
        persist_failed = con.execute(
            "SELECT COUNT(*) FROM security_events WHERE event_type='email_verification_token_persist_failed'"
        ).fetchone()[0]
        con.close()
        assert persist_failed == 1


def test_provider_failure_keeps_account_and_durable_token(monkeypatch, tmp_path):
    client, db_path = _make_local_client(monkeypatch, tmp_path)
    with client:
        inv = _setup_invitation(client, "duenio-dur@sintetico.test", "invitada-dur@sintetico.test")
        auth_mod = sys.modules["app.routes.auth"]

        def _boom(*args, **kwargs):
            raise RuntimeError("proveedor de email caído (sintético)")

        monkeypatch.setattr(auth_mod, "_send_email_verification", _boom)
        r = client.post(
            "/auth/register-with-invitation",
            json={"token": inv["token"], "email": "invitada-dur@sintetico.test", "password": PASSWORD},
        )
        assert r.status_code == 200, r.text

        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row
        user = con.execute("SELECT id FROM users WHERE email=?", ("invitada-dur@sintetico.test",)).fetchone()
        assert user is not None
        # El token quedó DURABLE (committeado ANTES del intento de envío):
        # ningún correo puede referenciar un token inexistente.
        tokens = con.execute(
            "SELECT COUNT(*) FROM email_verification_tokens WHERE user_id=? AND used_at IS NULL", (user["id"],),
        ).fetchone()[0]
        con.close()
        assert tokens == 1


def test_provider_success_yields_verifiable_token(monkeypatch, tmp_path):
    client, _ = _make_local_client(monkeypatch, tmp_path)
    with client:
        inv = _setup_invitation(client, "duenio-ver@sintetico.test", "invitada-ver@sintetico.test")
        r = client.post(
            "/auth/register-with-invitation",
            json={"token": inv["token"], "email": "invitada-ver@sintetico.test", "password": PASSWORD},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # Entorno local de test: el token viaja en la respuesta y DEBE ser
        # verificable (durable en base antes de cualquier envío).
        assert body.get("token"), body
        r = client.post("/auth/email/verify", params={"token": body["token"]})
        assert r.status_code == 200, r.text
