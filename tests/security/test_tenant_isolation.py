import importlib
import json
import struct
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import fitz
from fastapi.testclient import TestClient
from jose import jwt


API_ROOT = Path(__file__).resolve().parents[2] / "apps" / "api"
TOOLS_ROOT = Path(__file__).resolve().parents[2] / "tools"
TEST_MALWARE_BYTES = b"VANTDOMUS-TEST-MALWARE-SIGNATURE"


def _load_app(monkeypatch, tmp_path):
    db_path = tmp_path / "tenant-isolation.db"
    monkeypatch.setenv("DB_PATH", str(db_path))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JWT_SECRET", "tenant-isolation-test-secret")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "tenant-isolation-mfa-secret-key-32")
    sys.path.insert(0, str(API_ROOT))

    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    main = importlib.import_module("app.main")
    return main.app, db_path


def _register_and_login(client: TestClient, email: str) -> str:
    # Password policy enforced by auth.py: >=10 chars, 3+ char classes,
    # not in the common-weak list, doesn't contain the email's local part.
    password = "TestUser-Pass-2026!"
    response = client.post(
        "/auth/register",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text

    response = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _create_household(client: TestClient, token: str, name: str) -> dict:
    response = client.post("/households", params={"name": name}, headers=_auth(token))
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["id"]
    assert payload["organization_id"]
    return payload


def _user_id_for_email(db_path: Path, email: str) -> str:
    con = sqlite3.connect(db_path)
    try:
        return con.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()[0]
    finally:
        con.close()


def _add_membership(db_path: Path, household_id: str, email: str, role: str) -> None:
    user_id = _user_id_for_email(db_path, email)
    con = sqlite3.connect(db_path)
    try:
        con.execute(
            "INSERT OR REPLACE INTO household_memberships (household_id, user_id, role, created_at) VALUES (?, ?, ?, ?)",
            (household_id, user_id, role, datetime.now(timezone.utc).isoformat()),
        )
        con.commit()
    finally:
        con.close()


def _create_required_backup_tables(db_path: Path) -> None:
    con = sqlite3.connect(db_path)
    try:
        for table in (
            "users",
            "households",
            "household_memberships",
            "audit_log",
            "user_mfa",
            "logbook_entries",
            "signed_file_tokens",
        ):
            con.execute(f"CREATE TABLE {table} (id TEXT PRIMARY KEY)")
        con.commit()
    finally:
        con.close()


def _enable_production_rate_limit(monkeypatch) -> None:
    monkeypatch.setenv("VANTDOMUS_API_RATE_LIMIT_MODE", "redis")
    monkeypatch.setenv("VANTDOMUS_REDIS_URL", "redis://redis.example.test:6379/0")


def _enable_production_runtime_dependencies(monkeypatch) -> None:
    _enable_production_rate_limit(monkeypatch)
    # Estos tests validan la config base de producción, no el stack de IA:
    # con IA activa (default), validate_runtime_security exigiría OPENAI_API_KEY
    # antes de llegar a la variable bajo prueba.
    monkeypatch.setenv("VANTDOMUS_AI_FEATURES_ENABLED", "false")
    monkeypatch.setenv("VANTDOMUS_BACKUP_ENCRYPTION_KEY", "strong-backup-encryption-key-for-prod")
    monkeypatch.setenv("VANTDOMUS_SECURITY_ALERT_WEBHOOK_URL", "https://alerts.example.test/vantdomus")
    monkeypatch.setenv("VANTDOMUS_SECURITY_ALERT_SIGNING_SECRET", "strong-alert-signing-secret-for-prod")
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://app.example.test")
    monkeypatch.setenv("VANTDOMUS_APP_PUBLIC_URL", "https://app.example.test")
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS", "app.example.test")
    monkeypatch.setenv("SMTP_HOST", "smtp.example.test")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USER", "smtp-user")
    monkeypatch.setenv("SMTP_PASS", "smtp-password")
    monkeypatch.setenv("SMTP_FROM", "security@example.test")


def test_runtime_rejects_default_jwt_secret_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "CHANGE_ME_SUPER_SECRET")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "strong-mfa-secret-key-for-production")
    _enable_production_runtime_dependencies(monkeypatch)
    sys.path.insert(0, str(API_ROOT))

    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    config = importlib.import_module("app.config")
    try:
        config.validate_runtime_security()
        assert False, "production runtime should reject default JWT_SECRET"
    except RuntimeError as exc:
        assert "JWT_SECRET" in str(exc)


def test_runtime_requires_mfa_secret_key_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "strong-jwt-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "clamav")
    monkeypatch.delenv("VANTDOMUS_MFA_SECRET_KEY", raising=False)
    _enable_production_runtime_dependencies(monkeypatch)
    sys.path.insert(0, str(API_ROOT))

    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    config = importlib.import_module("app.config")
    try:
        config.validate_runtime_security()
        assert False, "production runtime should reject missing VANTDOMUS_MFA_SECRET_KEY"
    except RuntimeError as exc:
        assert "VANTDOMUS_MFA_SECRET_KEY" in str(exc)


def test_runtime_accepts_mfa_rotation_key_ring_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "strong-jwt-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "clamav")
    monkeypatch.delenv("VANTDOMUS_MFA_SECRET_KEY", raising=False)
    _enable_production_runtime_dependencies(monkeypatch)
    monkeypatch.setenv(
        "VANTDOMUS_MFA_SECRET_KEYS",
        "active-mfa-secret-key-for-production,previous-mfa-secret-key-for-production",
    )
    sys.path.insert(0, str(API_ROOT))

    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    config = importlib.import_module("app.config")
    config.validate_runtime_security()


def test_runtime_requires_clamav_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "strong-jwt-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "strong-mfa-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "basic")
    _enable_production_runtime_dependencies(monkeypatch)
    sys.path.insert(0, str(API_ROOT))

    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    config = importlib.import_module("app.config")
    try:
        config.validate_runtime_security()
        assert False, "production runtime should require ClamAV malware scanning"
    except RuntimeError as exc:
        assert "VANTDOMUS_MALWARE_SCAN_MODE=clamav" in str(exc)


def test_runtime_requires_api_rate_limit_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "strong-jwt-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "strong-mfa-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "clamav")
    monkeypatch.setenv("VANTDOMUS_API_RATE_LIMIT_MODE", "off")
    sys.path.insert(0, str(API_ROOT))

    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    config = importlib.import_module("app.config")
    try:
        config.validate_runtime_security()
        assert False, "production runtime should reject disabled API rate limiting"
    except RuntimeError as exc:
        assert "VANTDOMUS_API_RATE_LIMIT_MODE" in str(exc)


def test_runtime_requires_redis_rate_limit_url_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "strong-jwt-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "strong-mfa-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "clamav")
    monkeypatch.setenv("VANTDOMUS_API_RATE_LIMIT_MODE", "redis")
    monkeypatch.delenv("VANTDOMUS_REDIS_URL", raising=False)
    sys.path.insert(0, str(API_ROOT))

    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    config = importlib.import_module("app.config")
    try:
        config.validate_runtime_security()
        assert False, "production runtime should require Redis URL for API rate limiting"
    except RuntimeError as exc:
        assert "VANTDOMUS_REDIS_URL" in str(exc)


def test_runtime_requires_encrypted_backup_key_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "strong-jwt-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "strong-mfa-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "clamav")
    _enable_production_runtime_dependencies(monkeypatch)
    monkeypatch.setenv("VANTDOMUS_BACKUP_ENCRYPTION_KEY", "weak")
    sys.path.insert(0, str(API_ROOT))

    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    config = importlib.import_module("app.config")
    try:
        config.validate_runtime_security()
        assert False, "production runtime should require a strong backup encryption key"
    except RuntimeError as exc:
        assert "VANTDOMUS_BACKUP_ENCRYPTION_KEY" in str(exc)


def test_runtime_requires_security_alert_webhook_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "strong-jwt-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "strong-mfa-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "clamav")
    _enable_production_runtime_dependencies(monkeypatch)
    monkeypatch.delenv("VANTDOMUS_SECURITY_ALERT_WEBHOOK_URL", raising=False)
    sys.path.insert(0, str(API_ROOT))

    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    config = importlib.import_module("app.config")
    try:
        config.validate_runtime_security()
        assert False, "production runtime should require security alert webhook URL"
    except RuntimeError as exc:
        assert "VANTDOMUS_SECURITY_ALERT_WEBHOOK_URL" in str(exc)


def test_runtime_requires_signed_security_alerts_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "strong-jwt-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "strong-mfa-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "clamav")
    _enable_production_runtime_dependencies(monkeypatch)
    monkeypatch.setenv("VANTDOMUS_SECURITY_ALERT_SIGNING_SECRET", "weak")
    sys.path.insert(0, str(API_ROOT))

    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    config = importlib.import_module("app.config")
    try:
        config.validate_runtime_security()
        assert False, "production runtime should require signed security alerts"
    except RuntimeError as exc:
        assert "VANTDOMUS_SECURITY_ALERT_SIGNING_SECRET" in str(exc)


def test_runtime_rejects_localhost_cors_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "strong-jwt-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "strong-mfa-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "clamav")
    _enable_production_runtime_dependencies(monkeypatch)
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,https://app.example.test")
    sys.path.insert(0, str(API_ROOT))

    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    config = importlib.import_module("app.config")
    try:
        config.validate_runtime_security()
        assert False, "production runtime should reject localhost CORS origins"
    except RuntimeError as exc:
        assert "CORS_ALLOWED_ORIGINS" in str(exc)


def test_runtime_requires_transactional_email_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "strong-jwt-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "strong-mfa-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "clamav")
    _enable_production_runtime_dependencies(monkeypatch)
    monkeypatch.delenv("SMTP_HOST", raising=False)
    sys.path.insert(0, str(API_ROOT))

    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    config = importlib.import_module("app.config")
    try:
        config.validate_runtime_security()
        assert False, "production runtime should require SMTP email delivery"
    except RuntimeError as exc:
        assert "SMTP" in str(exc)


def test_runtime_requires_https_public_url_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "strong-jwt-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "strong-mfa-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "clamav")
    _enable_production_runtime_dependencies(monkeypatch)
    monkeypatch.setenv("VANTDOMUS_APP_PUBLIC_URL", "http://app.example.test")
    sys.path.insert(0, str(API_ROOT))

    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    config = importlib.import_module("app.config")
    try:
        config.validate_runtime_security()
        assert False, "production runtime should require https public URL"
    except RuntimeError as exc:
        assert "VANTDOMUS_APP_PUBLIC_URL" in str(exc)


def test_runtime_requires_allowed_hosts_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "strong-jwt-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "strong-mfa-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "clamav")
    _enable_production_runtime_dependencies(monkeypatch)
    monkeypatch.delenv("VANTDOMUS_ALLOWED_HOSTS", raising=False)
    sys.path.insert(0, str(API_ROOT))

    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    config = importlib.import_module("app.config")
    try:
        config.validate_runtime_security()
        assert False, "production runtime should require allowed hosts"
    except RuntimeError as exc:
        assert "VANTDOMUS_ALLOWED_HOSTS" in str(exc)


def test_runtime_rejects_localhost_allowed_hosts_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "strong-jwt-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "strong-mfa-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "clamav")
    _enable_production_runtime_dependencies(monkeypatch)
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS", "localhost,app.example.test")
    sys.path.insert(0, str(API_ROOT))

    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    config = importlib.import_module("app.config")
    try:
        config.validate_runtime_security()
        assert False, "production runtime should reject localhost allowed hosts"
    except RuntimeError as exc:
        assert "VANTDOMUS_ALLOWED_HOSTS" in str(exc)


def test_runtime_requires_public_url_host_in_allowed_hosts(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "strong-jwt-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "strong-mfa-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "clamav")
    _enable_production_runtime_dependencies(monkeypatch)
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS", "api.example.test")
    sys.path.insert(0, str(API_ROOT))

    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    config = importlib.import_module("app.config")
    try:
        config.validate_runtime_security()
        assert False, "production runtime should require public URL host in allowed hosts"
    except RuntimeError as exc:
        assert "VANTDOMUS_ALLOWED_HOSTS" in str(exc)


def test_runtime_rejects_public_uploads_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "strong-jwt-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "strong-mfa-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "clamav")
    monkeypatch.setenv("VANTDOMUS_ENABLE_PUBLIC_UPLOADS", "true")
    _enable_production_runtime_dependencies(monkeypatch)
    sys.path.insert(0, str(API_ROOT))

    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    config = importlib.import_module("app.config")
    try:
        config.validate_runtime_security()
        assert False, "production runtime should reject public uploads"
    except RuntimeError as exc:
        assert "VANTDOMUS_ENABLE_PUBLIC_UPLOADS" in str(exc)


def test_public_upload_mount_is_local_opt_in(monkeypatch, tmp_path):
    monkeypatch.setenv("APP_ENV", "local")
    monkeypatch.setenv("VANTDOMUS_ENABLE_PUBLIC_UPLOADS", "true")
    app, _db_path = _load_app(monkeypatch, tmp_path)
    routes = {getattr(route, "path", "") for route in app.routes}

    assert "/uploads" in routes


def test_public_upload_mount_is_disabled_by_default(monkeypatch, tmp_path):
    monkeypatch.setenv("APP_ENV", "local")
    monkeypatch.delenv("VANTDOMUS_ENABLE_PUBLIC_UPLOADS", raising=False)
    app, _db_path = _load_app(monkeypatch, tmp_path)
    routes = {getattr(route, "path", "") for route in app.routes}

    assert "/uploads" not in routes


def test_trusted_host_middleware_rejects_unexpected_hosts(monkeypatch, tmp_path):
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS", "app.example.test")
    app, _db_path = _load_app(monkeypatch, tmp_path)

    with TestClient(app, base_url="http://evil.example.test") as client:
        response = client.get("/health")
        assert response.status_code == 400

    with TestClient(app, base_url="http://app.example.test") as client:
        response = client.get("/health")
        assert response.status_code == 200


def test_mfa_key_rotation_reveals_previous_key_and_rewraps_active_key(monkeypatch, tmp_path):
    _load_app(monkeypatch, tmp_path)
    from app.mfa import generate_totp_secret, protect_totp_secret, reveal_totp_secret, should_reprotect_totp_secret

    old_key = "old-mfa-secret-key-for-rotation-32"
    new_key = "new-mfa-secret-key-for-rotation-32"
    secret = generate_totp_secret()

    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", old_key)
    monkeypatch.delenv("VANTDOMUS_MFA_SECRET_KEYS", raising=False)
    old_wrapped = protect_totp_secret(secret)
    assert reveal_totp_secret(old_wrapped) == secret

    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEYS", f"{new_key},{old_key}")
    assert reveal_totp_secret(old_wrapped) == secret
    assert should_reprotect_totp_secret(old_wrapped) is True

    new_wrapped = protect_totp_secret(secret)
    assert reveal_totp_secret(new_wrapped) == secret
    assert should_reprotect_totp_secret(new_wrapped) is False

    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEYS", new_key)
    assert reveal_totp_secret(new_wrapped) == secret


class _FakeClamavSocket:
    def __init__(self, response: bytes):
        self.response = response
        self.sent = b""
        self.closed = False

    def settimeout(self, _timeout):
        pass

    def sendall(self, data: bytes):
        self.sent += data

    def recv(self, _size: int) -> bytes:
        return self.response

    def close(self):
        self.closed = True


class _FakeClamavCommandSocket:
    def __init__(self, response: bytes):
        self.response = response
        self.sent = b""
        self.closed = False

    def settimeout(self, _timeout):
        pass

    def sendall(self, data: bytes):
        self.sent += data

    def recv(self, _size: int) -> bytes:
        return self.response

    def close(self):
        self.closed = True


class _FakeRedisSocket:
    def __init__(self, responses: list[bytes]):
        self.responses = responses
        self.sent = b""
        self.closed = False

    def settimeout(self, _timeout):
        pass

    def sendall(self, data: bytes):
        self.sent += data

    def recv(self, size: int) -> bytes:
        if not self.responses:
            return b""
        response = self.responses[0]
        chunk = response[:size]
        self.responses[0] = response[size:]
        if not self.responses[0]:
            self.responses.pop(0)
        return chunk

    def close(self):
        self.closed = True


class _FakeWebhookResponse:
    def read(self):
        return b"ok"

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def test_clamav_streaming_scanner_accepts_clean_response(monkeypatch, tmp_path):
    _load_app(monkeypatch, tmp_path)
    from app.malware import StreamingMalwareScanner

    fake_socket = _FakeClamavSocket(b"stream: OK\0")
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "clamav")
    monkeypatch.setattr("socket.create_connection", lambda *args, **kwargs: fake_socket)

    scanner = StreamingMalwareScanner()
    scanner.scan_chunk(b"clean")
    scanner.finish()

    assert fake_socket.sent.startswith(b"zINSTREAM\0")
    assert struct.pack("!I", 5) + b"clean" in fake_socket.sent
    assert fake_socket.sent.endswith(struct.pack("!I", 0))
    assert fake_socket.closed is True


def test_clamav_streaming_scanner_blocks_found_response(monkeypatch, tmp_path):
    _load_app(monkeypatch, tmp_path)
    from app.malware import MalwareDetected, StreamingMalwareScanner

    fake_socket = _FakeClamavSocket(b"stream: Eicar-Test-Signature FOUND\0")
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "clamav")
    monkeypatch.setattr("socket.create_connection", lambda *args, **kwargs: fake_socket)

    scanner = StreamingMalwareScanner()
    scanner.scan_chunk(TEST_MALWARE_BYTES)
    try:
        scanner.finish()
        assert False, "ClamAV FOUND response should reject the stream"
    except MalwareDetected as exc:
        assert "FOUND" in str(exc)


def test_clamav_healthcheck_reports_version(monkeypatch, tmp_path):
    _load_app(monkeypatch, tmp_path)
    from app.malware import check_clamav_health

    sockets = [
        _FakeClamavCommandSocket(b"PONG\0"),
        _FakeClamavCommandSocket(b"ClamAV 1.4.0/27100/Mon May 4 00:00:00 2026\0"),
    ]
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "clamav")
    monkeypatch.setattr("socket.create_connection", lambda *args, **kwargs: sockets.pop(0))

    result = check_clamav_health()

    assert result["ok"] is True
    assert result["status"] == "ok"
    assert "ClamAV" in result["detail"]


def test_clamav_healthcheck_script_records_security_event(monkeypatch, tmp_path):
    db_path = tmp_path / "clamav-health.db"
    monkeypatch.setenv("DB_PATH", str(db_path))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JWT_SECRET", "tenant-isolation-test-secret")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "tenant-isolation-mfa-secret-key-32")
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "clamav")
    sys.path.insert(0, str(API_ROOT / "scripts"))

    for name in list(sys.modules):
        if name == "clamav_healthcheck" or name == "app" or name.startswith("app."):
            del sys.modules[name]

    def raise_unavailable(*args, **kwargs):
        raise OSError("connection refused")

    monkeypatch.setattr("socket.create_connection", raise_unavailable)
    clamav_healthcheck = importlib.import_module("clamav_healthcheck")
    result = clamav_healthcheck.run_check()

    con = sqlite3.connect(db_path)
    try:
        row = con.execute(
            "SELECT event_type, severity, source FROM security_events WHERE event_type='clamav_healthcheck_failed'"
        ).fetchone()
    finally:
        con.close()

    assert result["ok"] is False
    assert result["status"] == "unavailable"
    assert result["event_id"]
    assert row == ("clamav_healthcheck_failed", "high", "clamav_healthcheck")


def test_api_sets_security_headers(monkeypatch, tmp_path):
    app, db_path = _load_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200, response.text
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["x-frame-options"] == "DENY"
        assert response.headers["referrer-policy"] == "no-referrer"
        assert "camera=()" in response.headers["permissions-policy"]
        assert response.headers["cross-origin-opener-policy"] == "same-origin"


def test_jwt_signature_and_expiry_are_enforced(monkeypatch, tmp_path):
    app, db_path = _load_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        valid_token = _register_and_login(client, "jwt-policy@example.test")

        response = client.get("/households", headers=_auth(valid_token))
        assert response.status_code == 200, response.text

        now = datetime.now(timezone.utc)
        forged_token = jwt.encode(
            {
                "sub": "forged-user",
                "email": "forged@example.test",
                "iat": int(now.timestamp()),
                "exp": int((now + timedelta(hours=1)).timestamp()),
            },
            "wrong-secret",
            algorithm="HS256",
        )
        response = client.get("/households", headers=_auth(forged_token))
        assert response.status_code == 401, response.text

        expired_token = jwt.encode(
            {
                "sub": "expired-user",
                "email": "expired@example.test",
                "iat": int((now - timedelta(hours=2)).timestamp()),
                "exp": int((now - timedelta(hours=1)).timestamp()),
            },
            "tenant-isolation-test-secret",
            algorithm="HS256",
        )
        response = client.get("/households", headers=_auth(expired_token))
        assert response.status_code == 401, response.text


def test_auth_rejects_weak_passwords_and_rate_limits_failed_logins(monkeypatch, tmp_path):
    monkeypatch.setenv("VANTDOMUS_AUTH_MAX_FAILED_LOGIN_ATTEMPTS", "2")
    monkeypatch.setenv("VANTDOMUS_AUTH_FAILED_LOGIN_WINDOW_SECONDS", "900")
    app, db_path = _load_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        response = client.post("/auth/register", params={"email": "weak@example.test", "password": "123"})
        assert response.status_code == 400, response.text

        # Política vigente: >=10 caracteres y 3+ clases; "Sturdy-Pass-2026!" ya no pasa.
        strong_password = "Sturdy-Pass-2026!"
        response = client.post("/auth/register", params={"email": "LockMe@Example.Test", "password": strong_password})
        assert response.status_code == 200, response.text

        response = client.post("/auth/login", params={"email": "lockme@example.test", "password": "bad-1"})
        assert response.status_code == 401, response.text

        response = client.post("/auth/login", params={"email": "LOCKME@example.test", "password": "bad-2"})
        assert response.status_code == 401, response.text

        response = client.post("/auth/login", params={"email": "lockme@example.test", "password": strong_password})
        assert response.status_code == 429, response.text

        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row
        auth_events = con.execute(
            """
            SELECT event_type, severity, metadata
            FROM security_events
            WHERE source='auth' AND event_type IN ('auth_login_failed', 'auth_login_throttled')
            ORDER BY created_at
            """
        ).fetchall()
        con.close()
        assert [row["event_type"] for row in auth_events] == [
            "auth_login_failed",
            "auth_login_failed",
            "auth_login_throttled",
        ]
        assert [row["severity"] for row in auth_events] == ["low", "medium", "high"]
        metadata = [json.loads(row["metadata"]) for row in auth_events]
        assert all(item["email_fingerprint"] == metadata[0]["email_fingerprint"] for item in metadata)
        assert metadata[0]["reason"] == "invalid_credentials"
        assert "lockme@example.test" not in json.dumps(metadata)


def test_authenticated_users_can_change_password_with_audited_security_event(monkeypatch, tmp_path):
    app, db_path = _load_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        response = client.post("/auth/register", params={"email": "change-password@example.test", "password": "Sturdy-Pass-2026!"})
        assert response.status_code == 200, response.text

        response = client.post("/auth/login", params={"email": "change-password@example.test", "password": "Sturdy-Pass-2026!"})
        assert response.status_code == 200, response.text
        token = response.json()["access_token"]

        response = client.post(
            "/auth/password/change",
            json={"current_password": "wrong-password", "new_password": "Better-Pass-2026!"},
            headers=_auth(token),
        )
        assert response.status_code == 401, response.text

        response = client.post(
            "/auth/password/change",
            json={"current_password": "Sturdy-Pass-2026!", "new_password": "123"},
            headers=_auth(token),
        )
        assert response.status_code == 400, response.text

        response = client.post(
            "/auth/password/change",
            json={"current_password": "Sturdy-Pass-2026!", "new_password": "Sturdy-Pass-2026!"},
            headers=_auth(token),
        )
        assert response.status_code == 400, response.text

        response = client.post(
            "/auth/password/change",
            json={"current_password": "Sturdy-Pass-2026!", "new_password": "Better-Pass-2026!"},
            headers=_auth(token),
        )
        assert response.status_code == 200, response.text
        assert response.json()["status"] == "changed"

        response = client.post("/auth/login", params={"email": "change-password@example.test", "password": "Sturdy-Pass-2026!"})
        assert response.status_code == 401, response.text

        response = client.post("/auth/login", params={"email": "change-password@example.test", "password": "Better-Pass-2026!"})
        assert response.status_code == 200, response.text

        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row
        audit_count = con.execute(
            "SELECT COUNT(*) FROM audit_log WHERE action='change_password'"
        ).fetchone()[0]
        auth_events = con.execute(
            "SELECT event_type, severity, metadata FROM security_events WHERE source='auth' ORDER BY created_at"
        ).fetchall()
        con.close()
        assert audit_count == 1
        assert any(row["event_type"] == "password_change_failed" and row["severity"] == "medium" for row in auth_events)
        assert any(row["event_type"] == "password_changed" and row["severity"] == "high" for row in auth_events)
        metadata_dump = json.dumps([json.loads(row["metadata"]) for row in auth_events])
        assert "change-password@example.test" not in metadata_dump


def test_email_verification_password_reset_and_session_revocation(monkeypatch, tmp_path):
    app, db_path = _load_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        response = client.post("/auth/register", params={"email": "account-flow@example.test", "password": "Sturdy-Pass-2026!"})
        assert response.status_code == 200, response.text
        registration = response.json()
        assert registration["token"]

        response = client.post("/auth/login", params={"email": "account-flow@example.test", "password": "Sturdy-Pass-2026!"})
        assert response.status_code == 200, response.text
        token_a = response.json()["access_token"]

        response = client.get("/auth/email/status", headers=_auth(token_a))
        assert response.status_code == 200, response.text
        assert response.json()["is_verified"] is False

        response = client.post("/auth/email/verify", params={"token": registration["token"]})
        assert response.status_code == 200, response.text

        response = client.get("/auth/email/status", headers=_auth(token_a))
        assert response.status_code == 200, response.text
        assert response.json()["is_verified"] is True

        response = client.post("/auth/email/verify", params={"token": registration["token"]})
        assert response.status_code == 404, response.text

        response = client.post("/auth/login", params={"email": "account-flow@example.test", "password": "Sturdy-Pass-2026!"})
        assert response.status_code == 200, response.text
        token_b = response.json()["access_token"]

        response = client.get("/auth/sessions", headers=_auth(token_b))
        assert response.status_code == 200, response.text
        assert len(response.json()["items"]) == 2
        assert sum(1 for item in response.json()["items"] if item["current"]) == 1

        response = client.post("/auth/sessions/revoke-others", headers=_auth(token_b))
        assert response.status_code == 200, response.text

        response = client.get("/households", headers=_auth(token_a))
        assert response.status_code == 401, response.text

        response = client.get("/households", headers=_auth(token_b))
        assert response.status_code == 200, response.text

        response = client.post("/auth/password/reset/request", params={"email": "ACCOUNT-FLOW@example.test"})
        assert response.status_code == 200, response.text
        reset_token = response.json()["token"]
        assert reset_token

        response = client.post(
            "/auth/password/reset/confirm",
            json={"token": reset_token, "new_password": "Reset-Pass-2026!"},
        )
        assert response.status_code == 200, response.text

        response = client.get("/households", headers=_auth(token_b))
        assert response.status_code == 401, response.text

        response = client.post("/auth/login", params={"email": "account-flow@example.test", "password": "Sturdy-Pass-2026!"})
        assert response.status_code == 401, response.text

        response = client.post("/auth/login", params={"email": "account-flow@example.test", "password": "Reset-Pass-2026!"})
        assert response.status_code == 200, response.text
        token_c = response.json()["access_token"]

        response = client.post("/auth/logout", headers=_auth(token_c))
        assert response.status_code == 200, response.text

        response = client.get("/households", headers=_auth(token_c))
        assert response.status_code == 401, response.text

        response = client.post("/auth/password/reset/request", params={"email": "missing-account@example.test"})
        assert response.status_code == 200, response.text
        assert "token" not in response.json()

        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row
        rows = con.execute(
            "SELECT event_type, severity, metadata FROM security_events WHERE source IN ('auth', 'auth_session') ORDER BY created_at"
        ).fetchall()
        con.close()
        event_types = {row["event_type"] for row in rows}
        assert {
            "email_verification_token_created",
            "email_verified",
            "password_reset_token_created",
            "password_reset_completed",
            "password_reset_requested_unknown_email",
            "other_sessions_revoked",
            "session_revoked",
        }.issubset(event_types)
        assert any(row["event_type"] == "password_reset_completed" and row["severity"] == "high" for row in rows)
        assert any(row["event_type"] == "other_sessions_revoked" and row["severity"] == "high" for row in rows)
        metadata_dump = json.dumps([json.loads(row["metadata"]) for row in rows])
        assert "account-flow@example.test" not in metadata_dump
        assert "missing-account@example.test" not in metadata_dump


def test_verified_email_is_required_for_sensitive_actions_when_enabled(monkeypatch, tmp_path):
    monkeypatch.setenv("VANTDOMUS_REQUIRE_VERIFIED_EMAIL_FOR_SENSITIVE_ACTIONS", "true")
    app, db_path = _load_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        response = client.post("/auth/register", params={"email": "verify-sensitive@example.test", "password": "Sturdy-Pass-2026!"})
        assert response.status_code == 200, response.text
        verification_token = response.json()["token"]

        response = client.post("/auth/login", params={"email": "verify-sensitive@example.test", "password": "Sturdy-Pass-2026!"})
        assert response.status_code == 200, response.text
        token = response.json()["access_token"]

        household = _create_household(client, token, "Verified Sensitive Unit")

        response = client.get(f"/households/{household['id']}/export", headers=_auth(token))
        assert response.status_code == 403, response.text
        assert "Email verification required" in response.text

        response = client.post(
            f"/households/{household['id']}/invitations",
            json={"email": "new-sensitive@example.test", "role": "viewer"},
            headers=_auth(token),
        )
        assert response.status_code == 403, response.text

        response = client.post("/auth/email/verify", params={"token": verification_token})
        assert response.status_code == 200, response.text

        response = client.get(f"/households/{household['id']}/export", headers=_auth(token))
        assert response.status_code == 200, response.text

        response = client.post(
            f"/households/{household['id']}/invitations",
            json={"email": "new-sensitive@example.test", "role": "viewer"},
            headers=_auth(token),
        )
        assert response.status_code == 200, response.text

        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row
        rows = con.execute(
            "SELECT event_type, source FROM security_events WHERE source='email_delivery'"
        ).fetchall()
        con.close()
        assert any(row["event_type"] == "email_verification_delivery_failed" for row in rows)


def test_api_rate_limit_is_enforced_per_user_and_exempts_health(monkeypatch, tmp_path):
    monkeypatch.setenv("VANTDOMUS_API_RATE_LIMIT_REQUESTS", "2")
    monkeypatch.setenv("VANTDOMUS_API_RATE_LIMIT_WINDOW_SECONDS", "60")
    monkeypatch.setenv("VANTDOMUS_API_RATE_LIMIT_EXEMPT_PATHS", "/health")
    app, db_path = _load_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        token_a = _register_and_login(client, "rate-api-a@example.test")
        token_b = _register_and_login(client, "rate-api-b@example.test")

        for _ in range(5):
            response = client.get("/health")
            assert response.status_code == 200, response.text

        response = client.get("/households", headers=_auth(token_a))
        assert response.status_code == 200, response.text
        assert response.headers["x-ratelimit-remaining"] == "1"

        response = client.get("/households", headers=_auth(token_a))
        assert response.status_code == 200, response.text
        assert response.headers["x-ratelimit-remaining"] == "0"

        response = client.get("/households", headers=_auth(token_a))
        assert response.status_code == 429, response.text
        assert response.headers["retry-after"]

        con = sqlite3.connect(db_path)
        try:
            event_count = con.execute(
                "SELECT COUNT(*) FROM security_events WHERE event_type='rate_limit_exceeded'"
            ).fetchone()[0]
        finally:
            con.close()
        assert event_count == 1

        response = client.get("/households", headers=_auth(token_b))
        assert response.status_code == 200, response.text


def test_redis_api_rate_limit_backend_uses_shared_counter(monkeypatch, tmp_path):
    _load_app(monkeypatch, tmp_path)
    from app.rate_limit import _check_redis_rate_limit

    sockets = [
        _FakeRedisSocket([b"+OK\r\n", b":1\r\n"]),
        _FakeRedisSocket([b"+OK\r\n", b"+OK\r\n"]),
        _FakeRedisSocket([b"+OK\r\n", b":60\r\n"]),
        _FakeRedisSocket([b"+OK\r\n", b":2\r\n"]),
        _FakeRedisSocket([b"+OK\r\n", b":59\r\n"]),
        _FakeRedisSocket([b"+OK\r\n", b":3\r\n"]),
        _FakeRedisSocket([b"+OK\r\n", b":58\r\n"]),
    ]
    monkeypatch.setenv("VANTDOMUS_REDIS_URL", "redis://redis.example.test:6379/2")
    monkeypatch.setattr("socket.create_connection", lambda *args, **kwargs: sockets.pop(0))

    assert _check_redis_rate_limit("GET:/tasks:user:1", 2, 60) == (True, 1, 60)
    assert _check_redis_rate_limit("GET:/tasks:user:1", 2, 60) == (True, 0, 59)
    assert _check_redis_rate_limit("GET:/tasks:user:1", 2, 60) == (False, 0, 58)


def test_operational_demo_and_notification_test_surfaces_are_production_gated(monkeypatch, tmp_path):
    _load_app(monkeypatch, tmp_path)
    from app.deps import require_operational_feature_enabled
    from fastapi import HTTPException

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("VANTDOMUS_ALLOW_DEMO_SEED", raising=False)
    try:
        require_operational_feature_enabled("Demo seed", "VANTDOMUS_ALLOW_DEMO_SEED")
        assert False, "production should block demo seed unless explicitly enabled"
    except HTTPException as exc:
        assert exc.status_code == 403

    monkeypatch.setenv("VANTDOMUS_ALLOW_DEMO_SEED", "true")
    require_operational_feature_enabled("Demo seed", "VANTDOMUS_ALLOW_DEMO_SEED")

    monkeypatch.delenv("VANTDOMUS_ALLOW_NOTIFICATION_TESTS", raising=False)
    try:
        require_operational_feature_enabled("Notification test endpoints", "VANTDOMUS_ALLOW_NOTIFICATION_TESTS")
        assert False, "production should block notification test endpoints unless explicitly enabled"
    except HTTPException as exc:
        assert exc.status_code == 403


def test_security_events_dispatch_signed_webhook_and_redact_metadata(monkeypatch, tmp_path):
    monkeypatch.setenv("VANTDOMUS_SECURITY_ALERT_WEBHOOK_URL", "https://alerts.example.test/security")
    monkeypatch.setenv("VANTDOMUS_SECURITY_ALERT_MIN_SEVERITY", "high")
    monkeypatch.setenv("VANTDOMUS_SECURITY_ALERT_SIGNING_SECRET", "security-alert-signing-secret")
    _app, db_path = _load_app(monkeypatch, tmp_path)
    from app.db import ensure_schema
    from app.security_events import write_security_event

    ensure_schema()
    captured = {}

    def fake_urlopen(req, timeout=0):
        headers = {key.lower(): value for key, value in req.header_items()}
        captured["url"] = req.full_url
        captured["body"] = req.data
        captured["timeout"] = timeout
        captured["signature"] = headers.get("x-vantdomus-signature")
        return _FakeWebhookResponse()

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    try:
        event_id = write_security_event(
            con,
            event_type="malware_detected",
            severity="critical",
            source="unit_test",
            household_id=None,
            user_id="user-1",
            metadata={"token": "secret-token", "filename": "evidence.txt"},
            commit=True,
        )
        row = con.execute("SELECT metadata FROM security_events WHERE id=?", (event_id,)).fetchone()
    finally:
        con.close()

    payload = json.loads(captured["body"].decode("utf-8"))
    assert captured["url"] == "https://alerts.example.test/security"
    assert captured["signature"].startswith("sha256=")
    assert payload["metadata"]["token"] == "[redacted]"
    assert payload["metadata"]["filename"] == "evidence.txt"
    assert json.loads(row["metadata"])["token"] == "[redacted]"


def test_security_event_hash_chain_detects_tampering(monkeypatch, tmp_path):
    _app, db_path = _load_app(monkeypatch, tmp_path)
    from app.db import ensure_schema
    from app.security_events import verify_security_event_chain, write_security_event

    ensure_schema()
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    try:
        first_id = write_security_event(
            con,
            event_type="rate_limit_exceeded",
            severity="medium",
            source="unit_test",
            household_id=None,
            metadata={"path": "/tasks"},
            commit=True,
        )
        second_id = write_security_event(
            con,
            event_type="malware_detected",
            severity="critical",
            source="unit_test",
            household_id=None,
            metadata={"filename": "evidence.txt"},
            commit=True,
        )
        rows = con.execute(
            "SELECT id, previous_hash, event_hash FROM security_events ORDER BY created_at ASC, id ASC"
        ).fetchall()
        valid = verify_security_event_chain(con)
        con.execute("UPDATE security_events SET metadata=? WHERE id=?", (json.dumps({"filename": "changed.txt"}), second_id))
        tampered = verify_security_event_chain(con)
    finally:
        con.close()

    assert rows[0]["id"] == first_id
    assert rows[0]["previous_hash"] is None
    assert rows[0]["event_hash"]
    assert rows[1]["id"] == second_id
    assert rows[1]["previous_hash"] == rows[0]["event_hash"]
    assert valid == {"ok": True, "status": "ok", "checked": 2}
    assert tampered["ok"] is False
    assert tampered["status"] == "tampered"
    assert tampered["event_id"] == second_id


def test_security_event_verification_script_checks_all_scopes(monkeypatch, tmp_path):
    app, db_path = _load_app(monkeypatch, tmp_path)
    from app.security_events import write_security_event

    with TestClient(app) as client:
        token = _register_and_login(client, "chain-script@example.test")
        household = _create_household(client, token, "Chain Script Household")

    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    try:
        write_security_event(
            con,
            event_type="global_event",
            severity="low",
            source="unit_test",
            metadata={"scope": "global"},
            commit=True,
        )
        household_event_id = write_security_event(
            con,
            event_type="household_event",
            severity="high",
            source="unit_test",
            household_id=household["id"],
            metadata={"scope": "household"},
            commit=True,
        )
    finally:
        con.close()

    sys.path.insert(0, str(API_ROOT / "scripts"))
    for name in list(sys.modules):
        if name == "verify_security_events" or name == "app" or name.startswith("app."):
            del sys.modules[name]

    verifier = importlib.import_module("verify_security_events")
    valid = verifier.run_verification()

    con = sqlite3.connect(db_path)
    try:
        con.execute("UPDATE security_events SET metadata=? WHERE id=?", (json.dumps({"scope": "changed"}), household_event_id))
        con.commit()
    finally:
        con.close()
    tampered = verifier.run_verification()

    assert valid["ok"] is True
    assert {check["scope"] for check in valid["checks"]} == {"global", household["id"]}
    assert tampered["ok"] is False
    tampered_check = next(check for check in tampered["checks"] if check["scope"] == household["id"])
    assert tampered_check["status"] == "tampered"
    assert tampered_check["event_id"] == household_event_id


def test_incident_evidence_export_is_tenant_scoped_and_hashed(monkeypatch, tmp_path):
    app, db_path = _load_app(monkeypatch, tmp_path)
    from app.security_events import write_security_event

    with TestClient(app) as client:
        token_a = _register_and_login(client, "evidence-a@example.test")
        token_b = _register_and_login(client, "evidence-b@example.test")
        household_a = _create_household(client, token_a, "Evidence A")
        household_b = _create_household(client, token_b, "Evidence B")

        response = client.post(
            "/tasks",
            params={"household_id": household_a["id"], "title": "Evidence task"},
            headers=_auth(token_a),
        )
        assert response.status_code == 200, response.text

    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    try:
        event_a = write_security_event(
            con,
            event_type="malware_detected",
            severity="critical",
            source="unit_test",
            household_id=household_a["id"],
            metadata={"filename": "a.pdf"},
            commit=True,
        )
        write_security_event(
            con,
            event_type="malware_detected",
            severity="critical",
            source="unit_test",
            household_id=household_b["id"],
            metadata={"filename": "b.pdf"},
            commit=True,
        )
    finally:
        con.close()

    sys.path.insert(0, str(API_ROOT / "scripts"))
    for name in list(sys.modules):
        if name == "incident_evidence_export" or name == "app" or name.startswith("app."):
            del sys.modules[name]

    evidence_export = importlib.import_module("incident_evidence_export")
    output_path = evidence_export.write_evidence_package(tmp_path / "evidence", household_a["id"])
    package = json.loads(output_path.read_text(encoding="utf-8"))

    assert package["metadata"]["household_id"] == household_a["id"]
    assert package["metadata"]["package_sha256"]
    assert package["chain_verification"]["ok"] is True
    assert {event["id"] for event in package["security_events"]} == {event_a}
    assert all(item["household_id"] == household_a["id"] for item in package["audit_log"])
    assert household_b["id"] not in json.dumps(package)


def test_operational_status_is_admin_scoped_and_summarizes_components(monkeypatch, tmp_path):
    backup_dir = tmp_path / "backups"
    backup_dir.mkdir()
    (backup_dir / "latest.db.enc").write_text("encrypted-envelope", encoding="utf-8")
    monkeypatch.setenv("VANTDOMUS_BACKUP_DIR", str(backup_dir))
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "basic")
    monkeypatch.setenv("VANTDOMUS_API_RATE_LIMIT_MODE", "memory")
    app, db_path = _load_app(monkeypatch, tmp_path)
    from app.security_events import write_security_event

    with TestClient(app) as client:
        admin_token = _register_and_login(client, "ops-admin@example.test")
        viewer_token = _register_and_login(client, "ops-viewer@example.test")
        other_token = _register_and_login(client, "ops-other@example.test")
        household = _create_household(client, admin_token, "Ops Household")
        other_household = _create_household(client, other_token, "Other Ops Household")
        _add_membership(db_path, household["id"], "ops-viewer@example.test", "viewer")

        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row
        try:
            write_security_event(
                con,
                event_type="malware_detected",
                severity="critical",
                source="unit_test",
                household_id=household["id"],
                metadata={"token": "secret-token", "filename": "a.pdf"},
                commit=True,
            )
            write_security_event(
                con,
                event_type="malware_detected",
                severity="critical",
                source="unit_test",
                household_id=other_household["id"],
                metadata={"filename": "other.pdf"},
                commit=True,
            )
        finally:
            con.close()

        response = client.get(
            "/audit/operational-status",
            params={"household_id": household["id"]},
            headers=_auth(viewer_token),
        )
        assert response.status_code == 403, response.text

        response = client.get(
            "/audit/operational-status",
            params={"household_id": household["id"]},
            headers=_auth(admin_token),
        )
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["components"]["database"]["ok"] is True
        assert payload["components"]["redis"]["status"] == "not_required"
        assert payload["components"]["clamav"]["status"] == "disabled"
        assert payload["components"]["backups"]["encrypted"] is True
        assert len(payload["recent_high_severity_events"]) == 1
        assert payload["recent_high_severity_events"][0]["metadata"]["token"] == "[redacted]"
        assert payload["recent_high_severity_events"][0]["metadata"]["filename"] == "a.pdf"


def test_backup_restore_drill_writes_encrypted_restorable_backup(monkeypatch, tmp_path):
    db_path = tmp_path / "backup-source.db"
    _create_required_backup_tables(db_path)
    monkeypatch.setenv("DB_PATH", str(db_path))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("VANTDOMUS_BACKUP_ENCRYPTION_KEY", "backup-encryption-key-for-tests-32")
    sys.path.insert(0, str(API_ROOT / "scripts"))

    for name in list(sys.modules):
        if name == "backup_restore_drill" or name == "app" or name.startswith("app."):
            del sys.modules[name]

    backup_restore_drill = importlib.import_module("backup_restore_drill")
    result = backup_restore_drill.run_drill(tmp_path / "backups", encrypt=True, offsite_dir=tmp_path / "offsite")

    backup_path = Path(result["backup"])
    manifest_path = Path(result["manifest"])
    envelope = json.loads(backup_path.read_text(encoding="utf-8"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert result["ok"] is True
    assert result["encrypted"] is True
    assert backup_path.suffix == ".enc"
    assert manifest["backup_file"] == backup_path.name
    assert manifest["backup_sha256"]
    assert manifest["encrypted"] is True
    assert manifest["verification"]["integrity"] == "ok"
    assert result["offsite"]["ok"] is True
    assert Path(result["offsite"]["backup"]).is_file()
    assert Path(result["offsite"]["manifest"]).is_file()
    assert result["offsite"]["backup_sha256"] == manifest["backup_sha256"]
    assert envelope["version"] == 1
    assert "ciphertext" in envelope
    assert "users" not in envelope["ciphertext"]
    assert result["verification"]["integrity"] == "ok"
    assert result["verification"]["missing_tables"] == []


def test_production_preflight_passes_with_required_controls_and_encrypted_backup(monkeypatch, tmp_path):
    db_path = tmp_path / "preflight.db"
    _create_required_backup_tables(db_path)
    backup_dir = tmp_path / "backups"
    backup_dir.mkdir()
    backup_path = backup_dir / "preflight.db.enc"
    backup_path.write_text("encrypted-backup", encoding="utf-8")
    import hashlib
    (backup_dir / "preflight.db.enc.manifest.json").write_text(
        json.dumps({
            "version": 1,
            "backup_file": backup_path.name,
            "backup_sha256": hashlib.sha256(backup_path.read_bytes()).hexdigest(),
            "encrypted": True,
        }),
        encoding="utf-8",
    )
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DB_PATH", str(db_path))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JWT_SECRET", "strong-jwt-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "strong-mfa-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "clamav")
    _enable_production_runtime_dependencies(monkeypatch)
    sys.path.insert(0, str(API_ROOT / "scripts"))

    for name in list(sys.modules):
        if name == "production_preflight" or name == "app" or name.startswith("app."):
            del sys.modules[name]

    production_preflight = importlib.import_module("production_preflight")
    result = production_preflight.run_preflight(backup_dir=backup_dir, skip_network=True)

    assert result["ok"] is True
    assert {check["name"]: check["status"] for check in result["checks"]} == {
        "runtime": "ok",
        "database": "ok",
        "backups": "ok",
        "redis": "skipped",
        "clamav": "skipped",
    }


def test_production_preflight_rejects_unencrypted_backup(monkeypatch, tmp_path):
    db_path = tmp_path / "preflight.db"
    _create_required_backup_tables(db_path)
    backup_dir = tmp_path / "backups"
    backup_dir.mkdir()
    (backup_dir / "preflight.db").write_text("plain-backup", encoding="utf-8")
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DB_PATH", str(db_path))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JWT_SECRET", "strong-jwt-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "strong-mfa-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "clamav")
    _enable_production_runtime_dependencies(monkeypatch)
    sys.path.insert(0, str(API_ROOT / "scripts"))

    for name in list(sys.modules):
        if name == "production_preflight" or name == "app" or name.startswith("app."):
            del sys.modules[name]

    production_preflight = importlib.import_module("production_preflight")
    result = production_preflight.run_preflight(backup_dir=backup_dir, skip_network=True)

    backup_check = next(check for check in result["checks"] if check["name"] == "backups")
    assert result["ok"] is False
    assert backup_check["status"] == "unencrypted"


def test_production_preflight_rejects_backup_checksum_mismatch(monkeypatch, tmp_path):
    db_path = tmp_path / "preflight.db"
    _create_required_backup_tables(db_path)
    backup_dir = tmp_path / "backups"
    backup_dir.mkdir()
    backup_path = backup_dir / "preflight.db.enc"
    backup_path.write_text("encrypted-backup", encoding="utf-8")
    (backup_dir / "preflight.db.enc.manifest.json").write_text(
        json.dumps({"version": 1, "backup_file": backup_path.name, "backup_sha256": "bad", "encrypted": True}),
        encoding="utf-8",
    )
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DB_PATH", str(db_path))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JWT_SECRET", "strong-jwt-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "strong-mfa-secret-key-for-production")
    monkeypatch.setenv("VANTDOMUS_MALWARE_SCAN_MODE", "clamav")
    _enable_production_runtime_dependencies(monkeypatch)
    sys.path.insert(0, str(API_ROOT / "scripts"))

    for name in list(sys.modules):
        if name == "production_preflight" or name == "app" or name.startswith("app."):
            del sys.modules[name]

    production_preflight = importlib.import_module("production_preflight")
    result = production_preflight.run_preflight(backup_dir=backup_dir, skip_network=True)

    backup_check = next(check for check in result["checks"] if check["name"] == "backups")
    assert result["ok"] is False
    assert backup_check["status"] == "checksum_mismatch"


def test_web_env_preflight_allows_local_demo_public_values(monkeypatch, tmp_path):
    monkeypatch.setenv("APP_ENV", "local")
    env_file = tmp_path / ".env.local"
    env_file.write_text(
        "\n".join(
            [
                "NEXT_PUBLIC_API_BASE=http://127.0.0.1:8001",
                "NEXT_PUBLIC_ACCESS_TOKEN=demo-token",
                "NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID=demo-household",
            ]
        ),
        encoding="utf-8",
    )
    sys.path.insert(0, str(TOOLS_ROOT))
    sys.modules.pop("web_env_preflight", None)

    web_env_preflight = importlib.import_module("web_env_preflight")
    result = web_env_preflight.run_preflight(env_file=env_file)

    assert result["ok"] is True
    assert {check["name"]: check["status"] for check in result["checks"]} == {
        "next_public_api_base": "development",
        "next_public_access_token": "development_only",
        "next_public_default_household_id": "development_only",
    }


def test_web_env_preflight_rejects_public_token_and_local_api_in_production(monkeypatch, tmp_path):
    monkeypatch.setenv("APP_ENV", "production")
    env_file = tmp_path / ".env.production"
    env_file.write_text(
        "\n".join(
            [
                "NEXT_PUBLIC_API_BASE=http://127.0.0.1:8001",
                "NEXT_PUBLIC_ACCESS_TOKEN=leaked-token",
                "NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID=customer-id",
            ]
        ),
        encoding="utf-8",
    )
    sys.path.insert(0, str(TOOLS_ROOT))
    sys.modules.pop("web_env_preflight", None)

    web_env_preflight = importlib.import_module("web_env_preflight")
    result = web_env_preflight.run_preflight(env_file=env_file)

    assert result["ok"] is False
    assert {check["name"]: check["status"] for check in result["checks"]} == {
        "next_public_api_base": "not_https",
        "next_public_access_token": "public_value_forbidden",
        "next_public_default_household_id": "public_value_forbidden",
    }


def test_secret_scan_allows_documented_placeholders(tmp_path):
    sample = tmp_path / ".env.example"
    sample.write_text(
        "\n".join(
            [
                "JWT_SECRET=CHANGE_ME_SUPER_SECRET",
                "NEXT_PUBLIC_ACCESS_TOKEN=PASTE_JWT",
                "SMTP_PASS=example-password",
            ]
        ),
        encoding="utf-8",
    )
    sys.path.insert(0, str(TOOLS_ROOT))
    sys.modules.pop("secret_scan", None)

    secret_scan = importlib.import_module("secret_scan")
    result = secret_scan.run_scan(roots=[tmp_path])

    assert result["ok"] is True
    assert result["findings"] == []


def test_secret_scan_rejects_high_risk_tokens(tmp_path):
    sample = tmp_path / "leak.txt"
    sample.write_text(
        "\n".join(
            [
                "JWT_SECRET=super-secret-production-value",
                "aws=" + "AKIA" + "1234567890ABCDEF",
                "-----BEGIN " + "PRIVATE KEY-----",
            ]
        ),
        encoding="utf-8",
    )
    sys.path.insert(0, str(TOOLS_ROOT))
    sys.modules.pop("secret_scan", None)

    secret_scan = importlib.import_module("secret_scan")
    result = secret_scan.run_scan(roots=[tmp_path])

    assert result["ok"] is False
    assert {finding["rule"] for finding in result["findings"]} == {
        "secret_assignment",
        "aws_access_key",
        "private_key",
    }


def test_web_session_security_lint_enforces_httponly_proxy_and_csrf():
    sys.path.insert(0, str(TOOLS_ROOT))
    sys.modules.pop("web_session_security_lint", None)

    web_session_security_lint = importlib.import_module("web_session_security_lint")
    result = web_session_security_lint.run_lint()

    assert result["ok"] is True
    assert {check["name"]: check["status"] for check in result["checks"]} == {
        "session_cookie_httponly": "ok",
        "csrf_cookie_issued": "ok",
        "logout_revokes_backend_session": "ok",
        "authenticated_proxy_csrf": "ok",
        "client_sends_csrf_header": "ok",
        "public_proxy_allowlist": "ok",
        "browser_connect_self_only": "ok",
        "protected_routes_require_session": "ok",
        "route_proxy_sets_no_store": "ok",
        "sensitive_routes_no_store": "ok",
        "proxy_responses_no_store": "ok",
        "proxy_request_size_limits": "ok",
    }


def test_retention_cleanup_dry_run_and_apply_only_remove_expired_records(monkeypatch, tmp_path):
    app, db_path = _load_app(monkeypatch, tmp_path)
    with TestClient(app) as client:
        token = _register_and_login(client, "retention@example.test")
        household = _create_household(client, token, "Retention Household")

    old = (datetime.now(timezone.utc) - timedelta(days=45)).isoformat()
    future = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
    con = sqlite3.connect(db_path)
    try:
        con.execute(
            """
            INSERT INTO signed_file_tokens (
              id, token_hash, household_id, organization_id, resource_type, resource_id,
              file_path, file_name, created_by_user_id, created_at, expires_at, revoked_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("expired-token", "hash-expired", household["id"], household["organization_id"], "logbook_attachment", "entry-1", "p", "f", "u", old, old, None),
        )
        con.execute(
            """
            INSERT INTO signed_file_tokens (
              id, token_hash, household_id, organization_id, resource_type, resource_id,
              file_path, file_name, created_by_user_id, created_at, expires_at, revoked_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("active-token", "hash-active", household["id"], household["organization_id"], "logbook_attachment", "entry-2", "p", "f", "u", old, future, None),
        )
        con.execute(
            """
            INSERT INTO household_invitations (
              id, household_id, organization_id, email, role, token_hash, invited_by_user_id,
              accepted_by_user_id, created_at, expires_at, accepted_at, revoked_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("expired-invite", household["id"], household["organization_id"], "old@example.test", "viewer", "invite-hash-old", "u", None, old, old, None, None),
        )
        con.execute(
            """
            INSERT INTO household_invitations (
              id, household_id, organization_id, email, role, token_hash, invited_by_user_id,
              accepted_by_user_id, created_at, expires_at, accepted_at, revoked_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("active-invite", household["id"], household["organization_id"], "new@example.test", "viewer", "invite-hash-new", "u", None, old, future, None, None),
        )
        con.execute(
            "INSERT INTO user_mfa_recovery_codes (id, user_id, code_hash, created_at, used_at) VALUES (?, ?, ?, ?, ?)",
            ("used-code", "u", "code-hash-used", old, old),
        )
        con.execute(
            "INSERT INTO user_mfa_recovery_codes (id, user_id, code_hash, created_at, used_at) VALUES (?, ?, ?, ?, ?)",
            ("unused-code", "u", "code-hash-unused", old, None),
        )
        con.execute(
            """
            INSERT INTO auth_sessions (id, user_id, token_jti, created_at, expires_at, revoked_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            ("expired-session", "u", "jti-expired", old, old, None),
        )
        con.execute(
            """
            INSERT INTO auth_sessions (id, user_id, token_jti, created_at, expires_at, revoked_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            ("active-session", "u", "jti-active", old, future, None),
        )
        con.execute(
            """
            INSERT INTO email_verification_tokens (id, user_id, token_hash, created_at, expires_at, used_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            ("used-email-token", "u", "email-hash-used", old, future, old),
        )
        con.execute(
            """
            INSERT INTO email_verification_tokens (id, user_id, token_hash, created_at, expires_at, used_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            ("active-email-token", "u", "email-hash-active", old, future, None),
        )
        con.execute(
            """
            INSERT INTO password_reset_tokens (id, user_id, token_hash, created_at, expires_at, used_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            ("expired-reset-token", "u", "reset-hash-expired", old, old, None),
        )
        con.execute(
            """
            INSERT INTO password_reset_tokens (id, user_id, token_hash, created_at, expires_at, used_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            ("active-reset-token", "u", "reset-hash-active", old, future, None),
        )
        con.commit()
    finally:
        con.close()

    sys.path.insert(0, str(API_ROOT / "scripts"))
    for name in list(sys.modules):
        if name == "retention_cleanup" or name == "app" or name.startswith("app."):
            del sys.modules[name]

    retention_cleanup = importlib.import_module("retention_cleanup")
    dry_run = retention_cleanup.run_cleanup(apply=False, grace_days=30)
    assert dry_run["summary"]["signed_file_tokens"]["removable"] == 1
    assert dry_run["summary"]["household_invitations"]["removable"] == 1
    assert dry_run["summary"]["user_mfa_recovery_codes"]["removable"] == 1
    assert dry_run["summary"]["auth_sessions"]["removable"] == 1
    assert dry_run["summary"]["email_verification_tokens"]["removable"] == 1
    assert dry_run["summary"]["password_reset_tokens"]["removable"] == 1

    applied = retention_cleanup.run_cleanup(apply=True, grace_days=30)
    assert applied["summary"]["signed_file_tokens"]["deleted"] == 1
    assert applied["summary"]["household_invitations"]["deleted"] == 1
    assert applied["summary"]["user_mfa_recovery_codes"]["deleted"] == 1
    assert applied["summary"]["auth_sessions"]["deleted"] == 1
    assert applied["summary"]["email_verification_tokens"]["deleted"] == 1
    assert applied["summary"]["password_reset_tokens"]["deleted"] == 1

    con = sqlite3.connect(db_path)
    try:
        assert con.execute("SELECT COUNT(*) FROM signed_file_tokens WHERE id='active-token'").fetchone()[0] == 1
        assert con.execute("SELECT COUNT(*) FROM signed_file_tokens WHERE id='expired-token'").fetchone()[0] == 0
        assert con.execute("SELECT COUNT(*) FROM household_invitations WHERE id='active-invite'").fetchone()[0] == 1
        assert con.execute("SELECT COUNT(*) FROM household_invitations WHERE id='expired-invite'").fetchone()[0] == 0
        assert con.execute("SELECT COUNT(*) FROM user_mfa_recovery_codes WHERE id='unused-code'").fetchone()[0] == 1
        assert con.execute("SELECT COUNT(*) FROM user_mfa_recovery_codes WHERE id='used-code'").fetchone()[0] == 0
        assert con.execute("SELECT COUNT(*) FROM auth_sessions WHERE id='active-session'").fetchone()[0] == 1
        assert con.execute("SELECT COUNT(*) FROM auth_sessions WHERE id='expired-session'").fetchone()[0] == 0
        assert con.execute("SELECT COUNT(*) FROM email_verification_tokens WHERE id='active-email-token'").fetchone()[0] == 1
        assert con.execute("SELECT COUNT(*) FROM email_verification_tokens WHERE id='used-email-token'").fetchone()[0] == 0
        assert con.execute("SELECT COUNT(*) FROM password_reset_tokens WHERE id='active-reset-token'").fetchone()[0] == 1
        assert con.execute("SELECT COUNT(*) FROM password_reset_tokens WHERE id='expired-reset-token'").fetchone()[0] == 0
        assert con.execute("SELECT COUNT(*) FROM security_events WHERE event_type='retention_cleanup'").fetchone()[0] == 1
    finally:
        con.close()


def test_mfa_totp_enforcement_for_login(monkeypatch, tmp_path):
    app, db_path = _load_app(monkeypatch, tmp_path)
    from app.mfa import totp_code

    with TestClient(app) as client:
        response = client.post("/auth/register", params={"email": "mfa@example.test", "password": "Sturdy-Pass-2026!"})
        assert response.status_code == 200, response.text

        response = client.post("/auth/login", params={"email": "mfa@example.test", "password": "Sturdy-Pass-2026!"})
        assert response.status_code == 200, response.text
        token = response.json()["access_token"]

        response = client.post("/auth/mfa/setup", headers=_auth(token))
        assert response.status_code == 200, response.text
        setup = response.json()
        assert setup["secret"]
        assert setup["otpauth_url"].startswith("otpauth://totp/")

        response = client.get("/auth/mfa/status", headers=_auth(token))
        assert response.status_code == 200, response.text
        assert response.json()["is_configured"] is True
        assert response.json()["is_enabled"] is False

        response = client.post("/auth/mfa/enable", params={"code": "000000"}, headers=_auth(token))
        assert response.status_code == 401, response.text

        code = totp_code(setup["secret"])
        response = client.post("/auth/mfa/enable", params={"code": code}, headers=_auth(token))
        assert response.status_code == 200, response.text
        assert response.json()["status"] == "enabled"
        recovery_codes = response.json()["recovery_codes"]
        assert len(recovery_codes) == 8

        con = sqlite3.connect(db_path)
        stored_secret = con.execute("SELECT totp_secret FROM user_mfa WHERE user_id=?", (response.json().get("user_id", ""),)).fetchone()
        if stored_secret is None:
            stored_secret = con.execute("SELECT totp_secret FROM user_mfa").fetchone()
        con.close()
        assert stored_secret[0] != setup["secret"]
        assert stored_secret[0].startswith("fernet:v1:")

        response = client.get("/auth/mfa/status", headers=_auth(token))
        assert response.status_code == 200, response.text
        assert response.json()["is_enabled"] is True
        assert response.json()["recovery_codes_remaining"] == 8

        response = client.post("/auth/login", params={"email": "mfa@example.test", "password": "Sturdy-Pass-2026!"})
        assert response.status_code == 428, response.text

        response = client.post(
            "/auth/login",
            params={"email": "mfa@example.test", "password": "Sturdy-Pass-2026!", "mfa_code": "123456"},
        )
        assert response.status_code == 401, response.text

        response = client.post(
            "/auth/login",
            params={"email": "mfa@example.test", "password": "Sturdy-Pass-2026!", "mfa_code": totp_code(setup["secret"])},
        )
        assert response.status_code == 200, response.text
        fresh_token = response.json()["access_token"]

        response = client.post(
            "/auth/login",
            params={"email": "mfa@example.test", "password": "Sturdy-Pass-2026!", "mfa_code": recovery_codes[0]},
        )
        assert response.status_code == 200, response.text

        response = client.post(
            "/auth/login",
            params={"email": "mfa@example.test", "password": "Sturdy-Pass-2026!", "mfa_code": recovery_codes[0]},
        )
        assert response.status_code == 401, response.text

        response = client.get("/auth/mfa/status", headers=_auth(fresh_token))
        assert response.status_code == 200, response.text
        assert response.json()["recovery_codes_remaining"] == 7

        response = client.post(
            "/auth/mfa/recovery-codes/regenerate",
            params={"code": "000000"},
            headers=_auth(fresh_token),
        )
        assert response.status_code == 401, response.text

        response = client.post(
            "/auth/mfa/recovery-codes/regenerate",
            params={"code": totp_code(setup["secret"])},
            headers=_auth(fresh_token),
        )
        assert response.status_code == 200, response.text
        regenerated_codes = response.json()["recovery_codes"]
        assert len(regenerated_codes) == 8
        assert set(regenerated_codes).isdisjoint(set(recovery_codes))

        response = client.post(
            "/auth/login",
            params={"email": "mfa@example.test", "password": "Sturdy-Pass-2026!", "mfa_code": recovery_codes[1]},
        )
        assert response.status_code == 401, response.text

        response = client.post("/auth/mfa/disable", params={"code": totp_code(setup["secret"])}, headers=_auth(fresh_token))
        assert response.status_code == 200, response.text
        assert response.json()["status"] == "disabled"

        response = client.post("/auth/login", params={"email": "mfa@example.test", "password": "Sturdy-Pass-2026!"})
        assert response.status_code == 200, response.text

        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row
        mfa_events = con.execute(
            "SELECT event_type, severity, metadata FROM security_events WHERE source='mfa' ORDER BY created_at"
        ).fetchall()
        con.close()
        mfa_event_types = {row["event_type"] for row in mfa_events}
        assert {"mfa_enabled", "mfa_recovery_codes_regenerated", "mfa_disabled"}.issubset(mfa_event_types)
        assert any(row["event_type"] == "mfa_disabled" and row["severity"] == "high" for row in mfa_events)
        assert any(
            row["event_type"] == "mfa_enabled"
            and json.loads(row["metadata"])["recovery_code_count"] == 8
            for row in mfa_events
        )


def test_admin_can_reset_mfa_for_household_member_only(monkeypatch, tmp_path):
    app, db_path = _load_app(monkeypatch, tmp_path)
    from app.mfa import totp_code

    with TestClient(app) as client:
        admin_a_token = _register_and_login(client, "mfa-admin-a@example.test")
        admin_b_token = _register_and_login(client, "mfa-admin-b@example.test")
        member_b_password = "Sturdy-Pass-2026!"
        response = client.post("/auth/register", params={"email": "mfa-member-b@example.test", "password": member_b_password})
        assert response.status_code == 200, response.text
        member_b_user_id = response.json()["user_id"]

        household_a = _create_household(client, admin_a_token, "MFA Admin A Unit")
        household_b = _create_household(client, admin_b_token, "MFA Admin B Unit")

        con = sqlite3.connect(db_path)
        admin_b_user_id = con.execute("SELECT id FROM users WHERE email=?", ("mfa-admin-b@example.test",)).fetchone()[0]
        con.execute(
            "INSERT INTO household_memberships (household_id, user_id, role, created_at) VALUES (?, ?, ?, ?)",
            (household_b["id"], member_b_user_id, "member", datetime.now(timezone.utc).isoformat()),
        )
        con.commit()
        con.close()

        response = client.post("/auth/login", params={"email": "mfa-member-b@example.test", "password": member_b_password})
        assert response.status_code == 200, response.text
        member_b_token = response.json()["access_token"]

        response = client.post("/auth/mfa/setup", headers=_auth(member_b_token))
        assert response.status_code == 200, response.text
        secret = response.json()["secret"]
        response = client.post("/auth/mfa/enable", params={"code": totp_code(secret)}, headers=_auth(member_b_token))
        assert response.status_code == 200, response.text

        response = client.post("/auth/login", params={"email": "mfa-member-b@example.test", "password": member_b_password})
        assert response.status_code == 428, response.text

        response = client.post(
            "/auth/mfa/admin-reset",
            params={"household_id": household_b["id"], "target_user_id": member_b_user_id},
            headers=_auth(admin_a_token),
        )
        assert response.status_code == 403, response.text

        response = client.post(
            "/auth/mfa/admin-reset",
            params={"household_id": household_b["id"], "target_user_id": member_b_user_id},
            headers=_auth(member_b_token),
        )
        assert response.status_code == 403, response.text

        response = client.post(
            "/auth/mfa/admin-reset",
            params={"household_id": household_b["id"], "target_user_id": admin_b_user_id},
            headers=_auth(admin_b_token),
        )
        assert response.status_code == 400, response.text

        response = client.post(
            "/auth/mfa/admin-reset",
            params={"household_id": household_b["id"], "target_user_id": member_b_user_id},
            headers=_auth(admin_b_token),
        )
        assert response.status_code == 200, response.text
        assert response.json()["status"] == "reset"

        response = client.post("/auth/login", params={"email": "mfa-member-b@example.test", "password": member_b_password})
        assert response.status_code == 200, response.text

        response = client.post(
            "/auth/mfa/admin-reset",
            params={"household_id": household_b["id"], "target_user_id": member_b_user_id},
            headers=_auth(admin_b_token),
        )
        assert response.status_code == 200, response.text

        response = client.post(
            "/auth/mfa/admin-reset",
            params={"household_id": household_b["id"], "target_user_id": "missing-user"},
            headers=_auth(admin_b_token),
        )
        assert response.status_code == 404, response.text

        response = client.post(
            "/auth/mfa/admin-reset",
            params={"household_id": household_b["id"], "target_user_id": "mfa-admin-b@example.test"},
            headers=_auth(admin_b_token),
        )
        assert response.status_code == 404, response.text

        response = client.get("/audit", params={"household_id": household_b["id"]}, headers=_auth(admin_b_token))
        assert response.status_code == 200, response.text
        assert any(item["action"] == "admin_reset_mfa" and item["resource_id"] == member_b_user_id for item in response.json()["items"])

        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row
        reset_events = con.execute(
            """
            SELECT event_type, severity, household_id, metadata
            FROM security_events
            WHERE source='mfa_admin'
            ORDER BY created_at
            """
        ).fetchall()
        con.close()
        assert any(
            row["event_type"] == "mfa_admin_reset"
            and row["severity"] == "high"
            and row["household_id"] == household_b["id"]
            and json.loads(row["metadata"])["target_user_id"] == member_b_user_id
            for row in reset_events
        )


def test_users_cannot_cross_read_or_mutate_other_tenants(monkeypatch, tmp_path):
    app, _db_path = _load_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        token_a = _register_and_login(client, "tenant-a@example.test")
        token_b = _register_and_login(client, "tenant-b@example.test")

        household_a = _create_household(client, token_a, "Tenant A Unit")
        household_b = _create_household(client, token_b, "Tenant B Unit")

        assert household_a["organization_id"] != household_b["organization_id"]

        response = client.get("/households", headers=_auth(token_a))
        assert response.status_code == 200, response.text
        ids_for_a = {item["id"] for item in response.json()["items"]}
        assert household_a["id"] in ids_for_a
        assert household_b["id"] not in ids_for_a

        response = client.get(f"/households/{household_b['id']}/dashboard", headers=_auth(token_a))
        assert response.status_code == 403, response.text

        response = client.post(
            "/tasks",
            params={"household_id": household_b["id"], "title": "Cross-tenant write", "priority": "low"},
            headers=_auth(token_a),
        )
        assert response.status_code == 403, response.text

        response = client.get("/audit", params={"household_id": household_b["id"]}, headers=_auth(token_a))
        assert response.status_code == 403, response.text

        response = client.post(
            "/tasks",
            params={"household_id": household_b["id"], "title": "Tenant B own task", "priority": "low"},
            headers=_auth(token_b),
        )
        assert response.status_code == 200, response.text
        task_id = response.json()["id"]

        response = client.get("/audit", params={"household_id": household_b["id"]}, headers=_auth(token_b))
        assert response.status_code == 200, response.text
        audit_items = response.json()["items"]
        assert any(item["resource_id"] == task_id for item in audit_items)
        assert all(item["organization_id"] == household_b["organization_id"] for item in audit_items)


def test_cross_tenant_person_references_are_rejected(monkeypatch, tmp_path):
    app, _db_path = _load_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        token_a = _register_and_login(client, "person-ref-a@example.test")
        token_b = _register_and_login(client, "person-ref-b@example.test")

        household_a = _create_household(client, token_a, "Person Ref A Unit")
        household_b = _create_household(client, token_b, "Person Ref B Unit")

        response = client.post(
            "/persons",
            params={"household_id": household_a["id"], "display_name": "Tenant A Person", "relation": "owner"},
            headers=_auth(token_a),
        )
        assert response.status_code == 200, response.text

        response = client.post(
            "/persons",
            params={"household_id": household_b["id"], "display_name": "Tenant B Person", "relation": "owner"},
            headers=_auth(token_b),
        )
        assert response.status_code == 200, response.text
        person_b_id = response.json()["id"]

        response = client.post(
            "/tasks",
            params={
                "household_id": household_a["id"],
                "title": "Cross-person assignment",
                "assigned_person_id": person_b_id,
            },
            headers=_auth(token_a),
        )
        assert response.status_code == 404, response.text

        response = client.post(
            "/finance/expenses",
            params={"household_id": household_a["id"], "amount": 10, "person_id": person_b_id},
            headers=_auth(token_a),
        )
        assert response.status_code == 404, response.text

        response = client.post(
            "/health/adherence/set",
            params={
                "household_id": household_a["id"],
                "person_id": person_b_id,
                "med_name": "CrossMed",
                "reminder_times": "08:00",
            },
            headers=_auth(token_a),
        )
        assert response.status_code == 404, response.text

        response = client.get(
            "/health/adherence/get",
            params={"household_id": household_a["id"], "person_id": person_b_id, "med_name": "CrossMed"},
            headers=_auth(token_a),
        )
        assert response.status_code == 404, response.text

        response = client.post(
            "/health/checkin",
            params={"household_id": household_a["id"], "person_id": person_b_id, "med_name": "CrossMed", "status": "taken"},
            headers=_auth(token_a),
        )
        assert response.status_code == 404, response.text


def test_cross_tenant_read_surfaces_are_forbidden(monkeypatch, tmp_path):
    app, _db_path = _load_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        token_a = _register_and_login(client, "read-surface-a@example.test")
        token_b = _register_and_login(client, "read-surface-b@example.test")

        household_a = _create_household(client, token_a, "Read Surface A Unit")
        household_b = _create_household(client, token_b, "Read Surface B Unit")

        response = client.post(
            "/persons",
            params={"household_id": household_b["id"], "display_name": "Private Person", "relation": "owner"},
            headers=_auth(token_b),
        )
        assert response.status_code == 200, response.text
        person_b_id = response.json()["id"]

        response = client.post(
            "/demo/seed",
            params={"household_id": household_b["id"], "mode": "home"},
            headers=_auth(token_b),
        )
        assert response.status_code == 200, response.text

        response = client.post(
            "/notifications/targets",
            json={"household_id": household_b["id"], "kind": "email", "destination": "private@example.test", "enabled": True},
            headers=_auth(token_b),
        )
        assert response.status_code == 200, response.text
        target_b_id = response.json()["id"]

        forbidden_gets = [
            ("/alerts", {"household_id": household_b["id"]}),
            ("/scores/latest", {"household_id": household_b["id"]}),
            ("/assistant/recommendations", {"household_id": household_b["id"]}),
            ("/audit/security-events", {"household_id": household_b["id"]}),
            ("/logbook", {"household_id": household_b["id"]}),
            ("/notifications/targets", {"household_id": household_b["id"]}),
            ("/notifications/outbox", {"household_id": household_b["id"]}),
            (f"/persons/{person_b_id}/health-timeline", {}),
        ]
        for path, params in forbidden_gets:
            response = client.get(path, params=params, headers=_auth(token_a))
            assert response.status_code == 403, f"{path}: {response.status_code} {response.text}"

        response = client.post(
            "/assistant/plan",
            params={"household_id": household_b["id"], "goal": "ahorrar"},
            headers=_auth(token_a),
        )
        assert response.status_code == 403, response.text

        response = client.post(
            "/assistant/chat",
            json={
                "household_id": household_b["id"],
                "messages": [{"role": "user", "content": "resume mi hogar"}],
            },
            headers=_auth(token_a),
        )
        assert response.status_code == 403, response.text

        response = client.post(
            f"/notifications/targets/{target_b_id}/toggle",
            params={"household_id": household_a["id"], "enabled": False},
            headers=_auth(token_a),
        )
        assert response.status_code == 404, response.text

        response = client.get("/organizations", headers=_auth(token_a))
        assert response.status_code == 200, response.text
        org_ids = {item["id"] for item in response.json()["items"]}
        assert household_a["organization_id"] in org_ids
        assert household_b["organization_id"] not in org_ids


def test_person_detail_and_ceo_dashboard_are_tenant_scoped(monkeypatch, tmp_path):
    app, _db_path = _load_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        token_a = _register_and_login(client, "person-detail-a@example.test")
        token_b = _register_and_login(client, "person-detail-b@example.test")
        household_a = _create_household(client, token_a, "Person Detail A")
        household_b = _create_household(client, token_b, "Person Detail B")

        response = client.post(
            "/persons",
            params={"household_id": household_b["id"], "display_name": "Tenant B Person"},
            headers=_auth(token_b),
        )
        assert response.status_code == 200, response.text
        person_b_id = response.json()["id"]

        response = client.get(f"/persons/{person_b_id}", headers=_auth(token_a))
        assert response.status_code in (403, 404), response.text

        response = client.get(f"/persons/{person_b_id}", headers=_auth(token_b))
        assert response.status_code == 200, response.text
        assert response.json()["household_id"] == household_b["id"]

        response = client.get("/ceo/dashboard", headers=_auth(token_a))
        assert response.status_code == 200, response.text
        department_ids = [
            dept["id"]
            for gerencia in response.json()["gerencias"]
            for dept in gerencia["departments"]
        ]
        assert household_a["id"] in department_ids
        assert household_b["id"] not in department_ids


def test_household_role_matrix_for_sensitive_actions(monkeypatch, tmp_path):
    monkeypatch.setenv("VANTDOMUS_PRIVATE_UPLOAD_DIR", str(tmp_path / "private_uploads"))
    app, db_path = _load_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        owner_token = _register_and_login(client, "role-owner@example.test")
        admin_email = "role-admin@example.test"
        member_email = "role-member@example.test"
        viewer_email = "role-viewer@example.test"
        admin_token = _register_and_login(client, admin_email)
        member_token = _register_and_login(client, member_email)
        viewer_token = _register_and_login(client, viewer_email)

        household = _create_household(client, owner_token, "Role Matrix Unit")
        household_id = household["id"]
        _add_membership(db_path, household_id, admin_email, "admin")
        _add_membership(db_path, household_id, member_email, "member")
        _add_membership(db_path, household_id, viewer_email, "viewer")

        response = client.get(f"/households/{household_id}/dashboard", headers=_auth(viewer_token))
        assert response.status_code == 200, response.text
        response = client.get("/tasks", params={"household_id": household_id}, headers=_auth(viewer_token))
        assert response.status_code == 200, response.text
        response = client.get("/scores/latest", params={"household_id": household_id}, headers=_auth(viewer_token))
        assert response.status_code == 200, response.text

        viewer_forbidden = [
            ("post", "/tasks", {"household_id": household_id, "title": "Viewer task"}),
            ("post", "/persons", {"household_id": household_id, "display_name": "Viewer Person"}),
            ("post", "/finance/expenses", {"household_id": household_id, "amount": 1}),
            ("post", "/demo/seed", {"household_id": household_id, "mode": "home"}),
            ("get", "/audit", {"household_id": household_id}),
            ("get", f"/households/{household_id}/export", {}),
        ]
        for method, path, params in viewer_forbidden:
            request = client.post if method == "post" else client.get
            response = request(path, params=params, headers=_auth(viewer_token))
            assert response.status_code == 403, f"{method.upper()} {path}: {response.status_code} {response.text}"

        response = client.post(
            "/tasks",
            params={"household_id": household_id, "title": "Member task", "priority": "medium"},
            headers=_auth(member_token),
        )
        assert response.status_code == 200, response.text

        response = client.post(
            "/logbook",
            params={"household_id": household_id},
            data={"entry_type": "auditoria", "content": "Member evidence"},
            files={"file": ("role.txt", b"role evidence", "text/plain")},
            headers=_auth(member_token),
        )
        assert response.status_code == 200, response.text
        entry_id = response.json()["id"]

        member_forbidden = [
            ("get", "/audit", {"household_id": household_id}),
            ("get", f"/households/{household_id}/export", {}),
            ("post", f"/coupling/{household_id}/gateways", {}),
            ("post", f"/logbook/{entry_id}/share", {}),
        ]
        for method, path, params in member_forbidden:
            request = client.post if method == "post" else client.get
            kwargs = {"headers": _auth(member_token)}
            if params:
                kwargs["params"] = params
            if path.endswith("/gateways"):
                kwargs["json"] = {"provider_type": "sap", "status": "active"}
            response = request(path, **kwargs)
            assert response.status_code == 403, f"{method.upper()} {path}: {response.status_code} {response.text}"

        response = client.get("/audit", params={"household_id": household_id}, headers=_auth(admin_token))
        assert response.status_code == 200, response.text
        response = client.get("/audit/security-events", params={"household_id": household_id}, headers=_auth(admin_token))
        assert response.status_code == 200, response.text
        response = client.get(f"/households/{household_id}/export", headers=_auth(admin_token))
        assert response.status_code == 200, response.text
        response = client.post(f"/logbook/{entry_id}/share", params={"ttl_seconds": 120}, headers=_auth(admin_token))
        assert response.status_code == 200, response.text
        response = client.post(
            f"/coupling/{household_id}/gateways",
            json={"provider_type": "sap", "status": "active"},
            headers=_auth(admin_token),
        )
        assert response.status_code == 200, response.text

        response = client.delete(f"/households/{household_id}", params={"confirm": "DELETE"}, headers=_auth(admin_token))
        assert response.status_code == 403, response.text
        response = client.delete(f"/households/{household_id}", params={"confirm": "DELETE"}, headers=_auth(owner_token))
        assert response.status_code == 200, response.text


def test_household_member_management_is_role_scoped_and_audited(monkeypatch, tmp_path):
    app, db_path = _load_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        owner_token = _register_and_login(client, "members-owner@example.test")
        admin_email = "members-admin@example.test"
        member_email = "members-member@example.test"
        viewer_email = "members-viewer@example.test"
        new_email = "members-new@example.test"
        second_owner_email = "members-owner-2@example.test"
        admin_token = _register_and_login(client, admin_email)
        member_token = _register_and_login(client, member_email)
        viewer_token = _register_and_login(client, viewer_email)
        _register_and_login(client, new_email)
        _register_and_login(client, second_owner_email)

        household = _create_household(client, owner_token, "Members Unit")
        household_id = household["id"]
        owner_user_id = _user_id_for_email(db_path, "members-owner@example.test")
        admin_user_id = _user_id_for_email(db_path, admin_email)
        member_user_id = _user_id_for_email(db_path, member_email)
        viewer_user_id = _user_id_for_email(db_path, viewer_email)
        second_owner_user_id = _user_id_for_email(db_path, second_owner_email)
        _add_membership(db_path, household_id, admin_email, "admin")
        _add_membership(db_path, household_id, member_email, "member")
        _add_membership(db_path, household_id, viewer_email, "viewer")

        # Diseño vigente (U3 I2 — presencia familiar): cualquier integrante del
        # hogar, incluso viewer, puede VER la lista de integrantes. Las
        # mutaciones (agregar/cambiar rol/eliminar) siguen role-scoped abajo.
        response = client.get(f"/households/{household_id}/members", headers=_auth(viewer_token))
        assert response.status_code == 200, response.text

        response = client.get(f"/households/{household_id}/members", headers=_auth(admin_token))
        assert response.status_code == 200, response.text
        assert {item["email"] for item in response.json()["items"]} >= {
            "members-owner@example.test",
            admin_email,
            member_email,
            viewer_email,
        }

        response = client.post(
            f"/households/{household_id}/members",
            json={"email": new_email, "role": "viewer"},
            headers=_auth(admin_token),
        )
        assert response.status_code == 200, response.text
        new_user_id = response.json()["user_id"]

        response = client.post(
            f"/households/{household_id}/members",
            json={"email": second_owner_email, "role": "owner"},
            headers=_auth(admin_token),
        )
        assert response.status_code == 403, response.text

        response = client.post(
            f"/households/{household_id}/members",
            json={"email": second_owner_email, "role": "owner"},
            headers=_auth(owner_token),
        )
        assert response.status_code == 200, response.text

        response = client.patch(
            f"/households/{household_id}/members/{new_user_id}",
            json={"role": "member"},
            headers=_auth(admin_token),
        )
        assert response.status_code == 200, response.text
        assert response.json()["role"] == "member"

        response = client.patch(
            f"/households/{household_id}/members/{second_owner_user_id}",
            json={"role": "admin"},
            headers=_auth(admin_token),
        )
        assert response.status_code == 403, response.text

        response = client.delete(f"/households/{household_id}/members/{second_owner_user_id}", headers=_auth(admin_token))
        assert response.status_code == 403, response.text

        response = client.delete(f"/households/{household_id}/members/{second_owner_user_id}", headers=_auth(owner_token))
        assert response.status_code == 200, response.text

        response = client.delete(f"/households/{household_id}/members/{owner_user_id}", headers=_auth(owner_token))
        assert response.status_code == 400, response.text

        response = client.delete(f"/households/{household_id}/members/{member_user_id}", headers=_auth(admin_token))
        assert response.status_code == 200, response.text

        response = client.get("/tasks", params={"household_id": household_id}, headers=_auth(member_token))
        assert response.status_code == 403, response.text

        response = client.delete(f"/households/{household_id}/members/{viewer_user_id}", headers=_auth(admin_token))
        assert response.status_code == 200, response.text

        response = client.get("/audit", params={"household_id": household_id}, headers=_auth(admin_token))
        assert response.status_code == 200, response.text
        actions = {item["action"] for item in response.json()["items"]}
        assert {"add_member", "update_member_role", "remove_member"}.issubset(actions)

        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row
        membership_events = con.execute(
            """
            SELECT event_type, severity, metadata
            FROM security_events
            WHERE household_id=? AND source='household_membership'
            ORDER BY created_at
            """,
            (household_id,),
        ).fetchall()
        con.close()
        event_types = {row["event_type"] for row in membership_events}
        assert {"household_member_added", "household_member_role_changed", "household_member_removed"}.issubset(event_types)
        assert any(row["event_type"] == "household_member_added" and row["severity"] == "high" for row in membership_events)
        assert any(row["event_type"] == "household_member_removed" and row["severity"] == "high" for row in membership_events)
        membership_metadata = json.dumps([json.loads(row["metadata"]) for row in membership_events])
        assert new_email not in membership_metadata
        assert second_owner_email not in membership_metadata
        assert "email_fingerprint" in membership_metadata
        assert any(
            row["event_type"] == "household_member_role_changed"
            and json.loads(row["metadata"])["target_user_id"] == new_user_id
            and json.loads(row["metadata"])["from_role"] == "viewer"
            and json.loads(row["metadata"])["to_role"] == "member"
            for row in membership_events
        )


def test_household_invitations_are_hashed_scoped_and_audited(monkeypatch, tmp_path):
    app, db_path = _load_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        owner_token = _register_and_login(client, "invite-owner@example.test")
        admin_email = "invite-admin@example.test"
        invitee_email = "invitee@example.test"
        wrong_email = "wrong-invitee@example.test"
        owner_invitee_email = "owner-invitee@example.test"
        admin_token = _register_and_login(client, admin_email)
        invitee_token = _register_and_login(client, invitee_email)
        wrong_token = _register_and_login(client, wrong_email)
        owner_invitee_token = _register_and_login(client, owner_invitee_email)

        household = _create_household(client, owner_token, "Invitation Unit")
        household_id = household["id"]
        _add_membership(db_path, household_id, admin_email, "admin")

        response = client.post(
            f"/households/{household_id}/invitations",
            json={"email": invitee_email, "role": "member", "ttl_hours": 24},
            headers=_auth(admin_token),
        )
        assert response.status_code == 200, response.text
        invitation = response.json()
        raw_token = invitation["token"]

        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row
        stored = con.execute("SELECT token_hash FROM household_invitations WHERE id=?", (invitation["id"],)).fetchone()
        con.close()
        assert stored["token_hash"] != raw_token

        response = client.get(f"/households/{household_id}/invitations", headers=_auth(admin_token))
        assert response.status_code == 200, response.text
        assert response.json()["items"][0]["email"] == invitee_email
        assert "token" not in response.text

        response = client.post(f"/households/invitations/{raw_token}/accept", headers=_auth(wrong_token))
        assert response.status_code == 403, response.text

        response = client.post(f"/households/invitations/{raw_token}/accept", headers=_auth(invitee_token))
        assert response.status_code == 200, response.text
        assert response.json()["role"] == "member"

        response = client.post(f"/households/invitations/{raw_token}/accept", headers=_auth(invitee_token))
        assert response.status_code == 400, response.text

        response = client.post(
            f"/households/{household_id}/invitations",
            json={"email": owner_invitee_email, "role": "owner", "ttl_hours": 24},
            headers=_auth(admin_token),
        )
        assert response.status_code == 403, response.text

        response = client.post(
            f"/households/{household_id}/invitations",
            json={"email": owner_invitee_email, "role": "owner", "ttl_hours": 24},
            headers=_auth(owner_token),
        )
        assert response.status_code == 200, response.text
        owner_invitation = response.json()

        response = client.post(
            f"/households/{household_id}/invitations/{owner_invitation['id']}/revoke",
            headers=_auth(admin_token),
        )
        assert response.status_code == 200, response.text

        response = client.post(f"/households/invitations/{owner_invitation['token']}/accept", headers=_auth(owner_invitee_token))
        assert response.status_code == 404, response.text

        response = client.post(
            f"/households/{household_id}/invitations",
            json={"email": owner_invitee_email, "role": "viewer", "ttl_hours": 1},
            headers=_auth(admin_token),
        )
        assert response.status_code == 200, response.text
        expired = response.json()
        expired_at = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
        con = sqlite3.connect(db_path)
        con.execute("UPDATE household_invitations SET expires_at=? WHERE id=?", (expired_at, expired["id"]))
        con.commit()
        con.close()

        response = client.post(f"/households/invitations/{expired['token']}/accept", headers=_auth(owner_invitee_token))
        assert response.status_code == 410, response.text

        response = client.get("/audit", params={"household_id": household_id}, headers=_auth(admin_token))
        assert response.status_code == 200, response.text
        actions = {item["action"] for item in response.json()["items"]}
        assert {"create_invitation", "accept_invitation", "revoke_invitation"}.issubset(actions)

        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row
        invitation_events = con.execute(
            """
            SELECT event_type, severity, metadata
            FROM security_events
            WHERE household_id=? AND source='household_invitation'
            ORDER BY created_at
            """,
            (household_id,),
        ).fetchall()
        con.close()
        invitation_event_types = {row["event_type"] for row in invitation_events}
        assert {
            "household_invitation_created",
            "household_invitation_accepted",
            "household_invitation_revoked",
        }.issubset(invitation_event_types)
        assert any(
            row["event_type"] == "household_invitation_created"
            and row["severity"] == "high"
            and json.loads(row["metadata"])["role"] == "owner"
            for row in invitation_events
        )
        assert any(
            row["event_type"] == "household_invitation_revoked"
            and row["severity"] == "high"
            and json.loads(row["metadata"])["invitation_id"] == owner_invitation["id"]
            for row in invitation_events
        )
        assert any(
            row["event_type"] == "household_invitation_accepted"
            and row["severity"] == "medium"
            and "email_fingerprint" in json.loads(row["metadata"])
            for row in invitation_events
        )
        metadata_dump = json.dumps([json.loads(row["metadata"]) for row in invitation_events])
        assert invitee_email not in metadata_dump
        assert owner_invitee_email not in metadata_dump


def test_private_logbook_attachments_and_coupling_are_tenant_scoped(monkeypatch, tmp_path):
    app, _db_path = _load_app(monkeypatch, tmp_path)
    monkeypatch.setenv("VANTDOMUS_PRIVATE_UPLOAD_DIR", str(tmp_path / "private_uploads"))

    with TestClient(app) as client:
        token_a = _register_and_login(client, "files-a@example.test")
        token_b = _register_and_login(client, "files-b@example.test")

        household_a = _create_household(client, token_a, "Files A Unit")
        household_b = _create_household(client, token_b, "Files B Unit")

        response = client.post(
            "/logbook",
            params={"household_id": household_b["id"]},
            data={"entry_type": "auditoria", "content": "Private evidence"},
            files={"file": ("evidence.txt", b"secret tenant b evidence", "text/plain")},
            headers=_auth(token_b),
        )
        assert response.status_code == 200, response.text
        entry_id = response.json()["id"]

        response = client.get(f"/logbook/{entry_id}/attachment", headers=_auth(token_a))
        assert response.status_code == 403, response.text

        response = client.get(f"/logbook/{entry_id}/attachment", headers=_auth(token_b))
        assert response.status_code == 200, response.text
        assert response.content == b"secret tenant b evidence"

        response = client.get(f"/coupling/{household_b['id']}/gateways", headers=_auth(token_a))
        assert response.status_code == 403, response.text

        response = client.post(
            f"/coupling/{household_b['id']}/gateways",
            json={"provider_type": "sap", "status": "active", "meta": {"system": "demo"}},
            headers=_auth(token_b),
        )
        assert response.status_code == 200, response.text
        gateway = response.json()

        response = client.post(
            f"/coupling/webhook/{gateway['id']}",
            json={"event_type": "external_alarm", "data": {"level": "low"}},
            headers={"Authorization": f"Bearer {gateway['auth_token']}", "X-VantDomus-Event-Id": "evt-001"},
        )
        assert response.status_code == 200, response.text
        alert_id = response.json()["alert_id"]

        response = client.post(
            f"/coupling/webhook/{gateway['id']}",
            json={"event_type": "external_alarm", "data": {"level": "low"}},
            headers={"Authorization": f"Bearer {gateway['auth_token']}", "X-VantDomus-Event-Id": "evt-001"},
        )
        assert response.status_code == 409, response.text

        response = client.get(f"/households/{household_b['id']}/dashboard", headers=_auth(token_b))
        assert response.status_code == 200, response.text
        alerts = response.json()["alerts"]
        assert any(alert["id"] == alert_id for alert in alerts)

        response = client.get("/audit", params={"household_id": household_b["id"]}, headers=_auth(token_b))
        assert response.status_code == 200, response.text
        audit_items = response.json()["items"]
        # Trazabilidad de agentes: resource_id del audit ahora apunta al evento
        # de agente, y el gateway queda en metadata.gateway_id.
        webhook_audits = [item for item in audit_items if item["action"] == "webhook_ingest"]
        assert webhook_audits, audit_items
        assert any(gateway["id"] in json.dumps(item) for item in webhook_audits)
        assert all(item["organization_id"] == household_b["organization_id"] for item in audit_items)


def test_logbook_signed_attachment_links_are_short_lived_and_hashed(monkeypatch, tmp_path):
    monkeypatch.setenv("VANTDOMUS_PRIVATE_UPLOAD_DIR", str(tmp_path / "private_uploads"))
    monkeypatch.setenv("VANTDOMUS_SIGNED_URL_MAX_TTL_SECONDS", "3600")
    app, db_path = _load_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        token_a = _register_and_login(client, "share-a@example.test")
        token_b = _register_and_login(client, "share-b@example.test")

        household_a = _create_household(client, token_a, "Share A Unit")
        household_b = _create_household(client, token_b, "Share B Unit")

        response = client.post(
            "/logbook",
            params={"household_id": household_b["id"]},
            data={"entry_type": "auditoria", "content": "Shareable evidence"},
            files={"file": ("share.txt", b"signed evidence", "text/plain")},
            headers=_auth(token_b),
        )
        assert response.status_code == 200, response.text
        entry_id = response.json()["id"]

        response = client.post(f"/logbook/{entry_id}/share", headers=_auth(token_a))
        assert response.status_code == 403, response.text

        response = client.post(f"/logbook/{entry_id}/share", params={"ttl_seconds": 120}, headers=_auth(token_b))
        assert response.status_code == 200, response.text
        share = response.json()
        assert share["url"].startswith("/logbook/shared/")
        raw_token = share["url"].rsplit("/", 1)[-1]

        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row
        rows = con.execute("SELECT token_hash, expires_at FROM signed_file_tokens").fetchall()
        assert len(rows) == 1
        assert rows[0]["token_hash"] != raw_token
        con.close()

        response = client.get(share["url"])
        assert response.status_code == 200, response.text
        assert response.content == b"signed evidence"

        response = client.post(f"{share['url']}/revoke", headers=_auth(token_a))
        assert response.status_code == 403, response.text

        response = client.post(f"{share['url']}/revoke", headers=_auth(token_b))
        assert response.status_code == 200, response.text
        assert response.json()["status"] == "revoked"

        response = client.get(share["url"])
        assert response.status_code == 404, response.text

        response = client.post(f"{share['url']}/revoke", headers=_auth(token_b))
        assert response.status_code == 200, response.text
        assert response.json()["status"] == "revoked"

        response = client.post(f"/logbook/{entry_id}/share", params={"ttl_seconds": 120}, headers=_auth(token_b))
        assert response.status_code == 200, response.text
        share = response.json()

        expired_at = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
        con = sqlite3.connect(db_path)
        con.execute("UPDATE signed_file_tokens SET expires_at=? WHERE token_hash IS NOT NULL AND revoked_at IS NULL", (expired_at,))
        con.commit()
        con.close()

        response = client.get(share["url"])
        assert response.status_code == 410, response.text

        response = client.get("/audit", params={"household_id": household_b["id"]}, headers=_auth(token_b))
        assert response.status_code == 200, response.text
        actions = {item["action"] for item in response.json()["items"]}
        assert "create_signed_link" in actions
        assert "download_signed_link" in actions
        assert "revoke_signed_link" in actions


def test_household_export_and_contractual_delete_are_tenant_scoped(monkeypatch, tmp_path):
    monkeypatch.setenv("VANTDOMUS_PRIVATE_UPLOAD_DIR", str(tmp_path / "private_uploads"))
    app, db_path = _load_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        token_a = _register_and_login(client, "retention-a@example.test")
        token_b = _register_and_login(client, "retention-b@example.test")

        household_a = _create_household(client, token_a, "Retention A Unit")
        household_b = _create_household(client, token_b, "Retention B Unit")

        response = client.post(
            "/persons",
            params={"household_id": household_b["id"], "display_name": "Retention Person", "relation": "owner"},
            headers=_auth(token_b),
        )
        assert response.status_code == 200, response.text
        person_b_id = response.json()["id"]

        response = client.post(
            "/tasks",
            params={"household_id": household_b["id"], "title": "Contractual task", "priority": "high"},
            headers=_auth(token_b),
        )
        assert response.status_code == 200, response.text

        response = client.post(
            "/finance/expenses",
            params={"household_id": household_b["id"], "amount": 1500, "category": "security", "merchant": "Vendor"},
            headers=_auth(token_b),
        )
        assert response.status_code == 200, response.text

        response = client.post(
            "/health/adherence/set",
            params={
                "household_id": household_b["id"],
                "person_id": person_b_id,
                "med_name": "RetentionMed",
                "reminder_times": "08:00,20:00",
            },
            headers=_auth(token_b),
        )
        assert response.status_code == 200, response.text

        response = client.post(
            "/health/checkin",
            params={"household_id": household_b["id"], "person_id": person_b_id, "med_name": "RetentionMed", "status": "missed"},
            headers=_auth(token_b),
        )
        assert response.status_code == 200, response.text

        response = client.post(
            "/logbook",
            params={"household_id": household_b["id"]},
            data={"entry_type": "auditoria", "content": "Retention evidence"},
            files={"file": ("retention.txt", b"delete me", "text/plain")},
            headers=_auth(token_b),
        )
        assert response.status_code == 200, response.text
        entry_id = response.json()["id"]

        response = client.post(f"/logbook/{entry_id}/share", params={"ttl_seconds": 120}, headers=_auth(token_b))
        assert response.status_code == 200, response.text

        response = client.post(
            f"/coupling/{household_b['id']}/gateways",
            json={"provider_type": "sap", "status": "active", "meta": {"system": "retention"}},
            headers=_auth(token_b),
        )
        assert response.status_code == 200, response.text
        raw_gateway_token = response.json()["auth_token"]

        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row
        attachment_path = con.execute(
            "SELECT attachment_path FROM logbook_entries WHERE id=?",
            (entry_id,),
        ).fetchone()["attachment_path"]
        assert Path(attachment_path).is_file()
        con.close()

        response = client.get(f"/households/{household_b['id']}/export", headers=_auth(token_a))
        assert response.status_code == 403, response.text

        response = client.get(f"/households/{household_b['id']}/export", headers=_auth(token_b))
        assert response.status_code == 200, response.text
        export = response.json()
        assert export["metadata"]["household_id"] == household_b["id"]
        assert export["tables"]["task_items"]
        assert export["tables"]["adherence_plans"]
        assert export["tables"]["medication_state"]
        assert export["tables"]["logbook_entries"][0]["attachment_path"] == "[redacted]"
        assert export["tables"]["signed_file_tokens"][0]["token_hash"] == "[redacted]"
        assert export["tables"]["signed_file_tokens"][0]["file_path"] == "[redacted]"
        assert export["tables"]["coupling_gateways"][0]["auth_token"] == "[redacted]"
        assert raw_gateway_token not in json.dumps(export)

        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row
        export_event = con.execute(
            "SELECT event_type, severity, source FROM security_events WHERE household_id=? AND event_type='household_data_exported'",
            (household_b["id"],),
        ).fetchone()
        con.close()
        assert tuple(export_event) == ("household_data_exported", "high", "household_export")

        response = client.delete(f"/households/{household_b['id']}", params={"confirm": "DELETE"}, headers=_auth(token_a))
        assert response.status_code == 403, response.text

        response = client.delete(f"/households/{household_b['id']}", params={"confirm": "WRONG"}, headers=_auth(token_b))
        assert response.status_code == 400, response.text

        response = client.delete(f"/households/{household_b['id']}", params={"confirm": "DELETE"}, headers=_auth(token_b))
        assert response.status_code == 200, response.text
        deleted = response.json()
        assert deleted["deleted_counts"]["households"] == 1
        assert deleted["deleted_counts"]["logbook_entries"] == 1
        assert deleted["deleted_counts"]["signed_file_tokens"] == 1
        assert deleted["deleted_counts"]["adherence_plans"] == 1
        assert deleted["deleted_counts"]["medication_state"] == 1
        assert deleted["deleted_counts"]["auth_sessions_revoked"] >= 1
        assert not Path(attachment_path).exists()

        response = client.get("/households", headers=_auth(token_b))
        assert response.status_code == 401, response.text

        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row
        assert con.execute("SELECT COUNT(*) FROM households WHERE id=?", (household_b["id"],)).fetchone()[0] == 0
        assert con.execute("SELECT COUNT(*) FROM task_items WHERE household_id=?", (household_b["id"],)).fetchone()[0] == 0
        assert con.execute("SELECT COUNT(*) FROM adherence_plans WHERE household_id=?", (household_b["id"],)).fetchone()[0] == 0
        assert con.execute("SELECT COUNT(*) FROM medication_state WHERE household_id=?", (household_b["id"],)).fetchone()[0] == 0
        assert con.execute("SELECT COUNT(*) FROM signed_file_tokens WHERE household_id=?", (household_b["id"],)).fetchone()[0] == 0
        assert con.execute(
            """
            SELECT COUNT(*)
            FROM auth_sessions
            WHERE user_id=(SELECT id FROM users WHERE email='retention-b@example.test')
              AND revoked_at IS NOT NULL
            """
        ).fetchone()[0] >= 1
        final_audit = con.execute(
            "SELECT action, organization_id FROM audit_log WHERE household_id=?",
            (household_b["id"],),
        ).fetchall()
        final_security_events = con.execute(
            "SELECT event_type, severity, source, organization_id FROM security_events WHERE household_id=?",
            (household_b["id"],),
        ).fetchall()
        con.close()
        assert [row["action"] for row in final_audit] == ["delete_household_data"]
        assert final_audit[0]["organization_id"] == household_b["organization_id"]
        assert [row["event_type"] for row in final_security_events] == ["household_data_deleted"]
        assert final_security_events[0]["severity"] == "critical"
        assert final_security_events[0]["source"] == "contractual_delete"
        assert final_security_events[0]["organization_id"] == household_b["organization_id"]


def test_logbook_rejects_disallowed_attachment_type(monkeypatch, tmp_path):
    app, _db_path = _load_app(monkeypatch, tmp_path)
    monkeypatch.setenv("VANTDOMUS_PRIVATE_UPLOAD_DIR", str(tmp_path / "private_uploads"))

    with TestClient(app) as client:
        token = _register_and_login(client, "file-policy@example.test")
        household = _create_household(client, token, "File Policy Unit")

        response = client.post(
            "/logbook",
            params={"household_id": household["id"]},
            data={"entry_type": "auditoria", "content": "Bad file"},
            files={"file": ("script.exe", b"not allowed", "application/octet-stream")},
            headers=_auth(token),
        )
        assert response.status_code == 400, response.text


def test_logbook_rejects_malware_signature(monkeypatch, tmp_path):
    monkeypatch.setenv("VANTDOMUS_PRIVATE_UPLOAD_DIR", str(tmp_path / "private_uploads"))
    monkeypatch.setenv("VANTDOMUS_MALWARE_SIGNATURES", TEST_MALWARE_BYTES.decode("utf-8"))
    app, db_path = _load_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        token = _register_and_login(client, "malware-logbook@example.test")
        household = _create_household(client, token, "Malware Logbook Unit")

        response = client.post(
            "/logbook",
            params={"household_id": household["id"]},
            data={"entry_type": "auditoria", "content": "Malware test"},
            files={"file": ("blocked.txt", TEST_MALWARE_BYTES, "text/plain")},
            headers=_auth(token),
        )
        assert response.status_code == 400, response.text
        assert "malware" in response.text.lower()

        stored_files = list((tmp_path / "private_uploads").glob("**/*"))
        assert not any(item.is_file() for item in stored_files)

        response = client.get("/audit/security-events", params={"household_id": household["id"]}, headers=_auth(token))
        assert response.status_code == 200, response.text
        events = response.json()["items"]
        assert any(item["event_type"] == "malware_detected" and item["severity"] == "critical" for item in events)

        con = sqlite3.connect(db_path)
        try:
            row = con.execute(
                "SELECT event_type, severity, source FROM security_events WHERE household_id=?",
                (household["id"],),
            ).fetchone()
        finally:
            con.close()
        assert row == ("malware_detected", "critical", "logbook_upload")


def test_webhook_rate_limit_is_enforced(monkeypatch, tmp_path):
    monkeypatch.setenv("VANTDOMUS_WEBHOOK_RATE_LIMIT_EVENTS", "1")
    monkeypatch.setenv("VANTDOMUS_WEBHOOK_RATE_LIMIT_WINDOW_SECONDS", "60")
    app, _db_path = _load_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        token = _register_and_login(client, "rate-limit@example.test")
        household = _create_household(client, token, "Rate Limit Unit")

        response = client.post(
            f"/coupling/{household['id']}/gateways",
            json={"provider_type": "sap", "status": "active"},
            headers=_auth(token),
        )
        assert response.status_code == 200, response.text
        gateway = response.json()

        response = client.post(
            f"/coupling/webhook/{gateway['id']}",
            json={"event_type": "first", "data": {}},
            headers={"Authorization": f"Bearer {gateway['auth_token']}", "X-VantDomus-Event-Id": "evt-rate-1"},
        )
        assert response.status_code == 200, response.text

        response = client.post(
            f"/coupling/webhook/{gateway['id']}",
            json={"event_type": "second", "data": {}},
            headers={"Authorization": f"Bearer {gateway['auth_token']}", "X-VantDomus-Event-Id": "evt-rate-2"},
        )
        assert response.status_code == 429, response.text


def test_gateway_token_rotation_and_expiry(monkeypatch, tmp_path):
    monkeypatch.setenv("VANTDOMUS_GATEWAY_TOKEN_TTL_DAYS", "1")
    app, db_path = _load_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        token = _register_and_login(client, "rotate-token@example.test")
        household = _create_household(client, token, "Rotate Token Unit")

        response = client.post(
            f"/coupling/{household['id']}/gateways",
            json={"provider_type": "sap", "status": "active"},
            headers=_auth(token),
        )
        assert response.status_code == 200, response.text
        gateway = response.json()
        old_token = gateway["auth_token"]

        response = client.post(
            f"/coupling/{household['id']}/gateways/{gateway['id']}/rotate-token",
            headers=_auth(token),
        )
        assert response.status_code == 200, response.text
        rotated = response.json()
        assert rotated["auth_token"] != old_token

        response = client.post(
            f"/coupling/webhook/{gateway['id']}",
            json={"event_type": "old_token", "data": {}},
            headers={"Authorization": f"Bearer {old_token}", "X-VantDomus-Event-Id": "evt-old-token"},
        )
        assert response.status_code == 403, response.text

        response = client.post(
            f"/coupling/webhook/{gateway['id']}",
            json={"event_type": "new_token", "data": {}},
            headers={"Authorization": f"Bearer {rotated['auth_token']}", "X-VantDomus-Event-Id": "evt-new-token"},
        )
        assert response.status_code == 200, response.text

        expired_at = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        con = sqlite3.connect(db_path)
        con.execute("UPDATE coupling_gateways SET token_expires_at=? WHERE id=?", (expired_at, gateway["id"]))
        con.commit()
        con.close()

        response = client.post(
            f"/coupling/webhook/{gateway['id']}",
            json={"event_type": "expired_token", "data": {}},
            headers={"Authorization": f"Bearer {rotated['auth_token']}", "X-VantDomus-Event-Id": "evt-expired-token"},
        )
        assert response.status_code == 403, response.text
        assert "expired" in response.text.lower()


def test_vision_batches_are_private_and_tenant_scoped(monkeypatch, tmp_path):
    monkeypatch.setenv("VANTDOMUS_PRIVATE_UPLOAD_DIR", str(tmp_path / "private_uploads"))
    app, _db_path = _load_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        token_a = _register_and_login(client, "vision-a@example.test")
        token_b = _register_and_login(client, "vision-b@example.test")

        household_a = _create_household(client, token_a, "Vision A Unit")
        household_b = _create_household(client, token_b, "Vision B Unit")

        # Endurecimiento vigente: process_batch SOLO puede recorrer el área de
        # ingestión del propio tenant y target_directory es RELATIVO a ella.
        intake_b = (
            tmp_path / "private_uploads" / "vision_intake"
            / household_b["organization_id"] / household_b["id"] / "reports"
        )
        intake_b.mkdir(parents=True)
        pdf_path = intake_b / "daily_report_2026-05-03.pdf"
        doc = fitz.open()
        page = doc.new_page(width=300, height=200)
        page.insert_text((30, 80), "Tenant confidential report")
        doc.save(pdf_path)
        doc.close()

        response = client.post(
            "/vision/process_batch",
            json={
                "household_id": household_b["id"],
                "batch_name": "Private Reports",
                "target_directory": "reports",
                "target_dates": ["2026-05-03"],
                "crop_x": 0,
                "crop_y": 0,
                "crop_w": 300,
                "crop_h": 200,
            },
            headers=_auth(token_b),
        )
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["processed_count"] == 1
        assert payload["gallery_url"].startswith("/vision/batches/")
        assert "/uploads/" not in payload["gallery_url"]

        response = client.get(payload["gallery_url"], headers=_auth(token_a))
        assert response.status_code == 403, response.text

        response = client.get(payload["gallery_url"], headers=_auth(token_b))
        assert response.status_code == 200, response.text
        assert "data:image/png;base64" in response.text

        response = client.post(
            "/vision/process_batch",
            json={
                "household_id": household_b["id"],
                "batch_name": "Cross Tenant",
                "target_directory": "reports",
            },
            headers=_auth(token_a),
        )
        assert response.status_code == 403, response.text

        response = client.get("/audit", params={"household_id": household_b["id"]}, headers=_auth(token_b))
        assert response.status_code == 200, response.text
        audit_items = response.json()["items"]
        assert any(item["action"] == "process_batch" and item["resource_type"] == "vision_batch" for item in audit_items)
        assert all(item["organization_id"] == household_b["organization_id"] for item in audit_items)


def test_vision_rejects_malware_signature_before_processing(monkeypatch, tmp_path):
    monkeypatch.setenv("VANTDOMUS_PRIVATE_UPLOAD_DIR", str(tmp_path / "private_uploads"))
    monkeypatch.setenv("VANTDOMUS_MALWARE_SIGNATURES", TEST_MALWARE_BYTES.decode("utf-8"))
    app, _db_path = _load_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        token = _register_and_login(client, "malware-vision@example.test")
        household = _create_household(client, token, "Malware Vision Unit")

        # El área de ingestión es per-tenant; target_directory es relativo.
        intake = (
            tmp_path / "private_uploads" / "vision_intake"
            / household["organization_id"] / household["id"] / "infected"
        )
        intake.mkdir(parents=True)
        (intake / "infected_2026-05-03.pdf").write_bytes(TEST_MALWARE_BYTES)

        response = client.post(
            "/vision/process_batch",
            json={
                "household_id": household["id"],
                "batch_name": "Infected Reports",
                "target_directory": "infected",
                "target_dates": ["2026-05-03"],
            },
            headers=_auth(token),
        )
        assert response.status_code == 400, response.text
        assert "malware" in response.text.lower()

        gallery_files = list((tmp_path / "private_uploads").glob("**/gallery.html"))
        assert gallery_files == []
