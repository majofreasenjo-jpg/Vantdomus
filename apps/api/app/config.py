from pydantic_settings import BaseSettings
from pathlib import Path
import os
from urllib.parse import urlparse

DEFAULT_JWT_SECRET = "CHANGE_ME_SUPER_SECRET"
APP_DIR = Path(__file__).resolve().parents[1]


def _load_local_env() -> None:
    # Suite determinista (CP1d-FAMILY-PILOT-1a): los tests NUNCA deben heredar
    # los .env del desarrollador; conftest.py fija VANTDOMUS_SKIP_LOCAL_ENV=1.
    if os.getenv("VANTDOMUS_SKIP_LOCAL_ENV", "").strip().lower() in {"1", "true", "yes"}:
        return
    for env_path in (APP_DIR / ".env.local", APP_DIR / ".env"):
        if not env_path.exists():
            continue
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


_load_local_env()

class Settings(BaseSettings):
    APP_ENV: str = "local"
    DB_PATH: str = str(Path(__file__).resolve().parents[1] / "vantdomus.db")
    DATABASE_URL: str | None = None
    JWT_SECRET: str = DEFAULT_JWT_SECRET
    JWT_ALG: str = "HS256"
    ACCESS_TOKEN_EXPIRES_SECONDS: int = 28800

settings = Settings()


def public_registration_enabled() -> bool:
    """
    CP1d-FAMILY-PILOT-1a — Gate del registro público.

    - Configuración explícita manda: VANTDOMUS_PUBLIC_REGISTRATION=true|false.
    - Sin configuración: CERRADO en producción/staging (fail-closed), abierto
      solo en entornos locales de desarrollo/demo/test.
    El alta de integrantes en entornos cerrados es SIEMPRE por invitación
    privada del hogar (tokens de un solo uso, expirables).
    """
    configured = os.getenv("VANTDOMUS_PUBLIC_REGISTRATION", "").strip().lower()
    if configured in {"1", "true", "yes"}:
        return True
    if configured in {"0", "false", "no"}:
        return False
    env = settings.APP_ENV.strip().lower()
    return env in {"local", "dev", "development", "demo", "test"}


def validate_runtime_security() -> None:
    env = settings.APP_ENV.strip().lower()
    if env not in {"production", "prod", "staging"}:
        return
    if settings.JWT_SECRET == DEFAULT_JWT_SECRET or len(settings.JWT_SECRET) < 32:
        raise RuntimeError("JWT_SECRET must be configured with a strong value for staging/production")
    mfa_keys = [item.strip() for item in os.getenv("VANTDOMUS_MFA_SECRET_KEYS", "").split(",") if item.strip()]
    if not mfa_keys:
        mfa_keys = [os.getenv("VANTDOMUS_MFA_SECRET_KEY", "")]
    if any(len(key) < 32 for key in mfa_keys):
        raise RuntimeError("VANTDOMUS_MFA_SECRET_KEY or VANTDOMUS_MFA_SECRET_KEYS must contain only 32+ character keys for staging/production")
    malware_mode = os.getenv("VANTDOMUS_MALWARE_SCAN_MODE", "basic").strip().lower()
    if malware_mode != "clamav":
        raise RuntimeError("VANTDOMUS_MALWARE_SCAN_MODE=clamav is required for staging/production")
    rate_limit_mode = os.getenv("VANTDOMUS_API_RATE_LIMIT_MODE", "memory").strip().lower()
    if rate_limit_mode == "off":
        raise RuntimeError("VANTDOMUS_API_RATE_LIMIT_MODE must not be off for staging/production")
    if rate_limit_mode != "redis":
        raise RuntimeError("VANTDOMUS_API_RATE_LIMIT_MODE=redis is required for staging/production")
    if not os.getenv("VANTDOMUS_REDIS_URL", "").strip():
        raise RuntimeError("VANTDOMUS_REDIS_URL is required for staging/production API rate limiting")
    backup_key = os.getenv("VANTDOMUS_BACKUP_ENCRYPTION_KEY", "")
    if len(backup_key) < 32 or backup_key.startswith("CHANGE_ME"):
        raise RuntimeError("VANTDOMUS_BACKUP_ENCRYPTION_KEY must be configured with a strong 32+ character value for staging/production")
    alert_url = os.getenv("VANTDOMUS_SECURITY_ALERT_WEBHOOK_URL", "").strip()
    alert_secret = os.getenv("VANTDOMUS_SECURITY_ALERT_SIGNING_SECRET", "")
    if not alert_url:
        raise RuntimeError("VANTDOMUS_SECURITY_ALERT_WEBHOOK_URL is required for staging/production")
    if len(alert_secret) < 32 or alert_secret.startswith("CHANGE_ME"):
        raise RuntimeError("VANTDOMUS_SECURITY_ALERT_SIGNING_SECRET must be configured with a strong 32+ character value for staging/production")
    cors_origins = [origin.strip().lower() for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if origin.strip()]
    if not cors_origins or "*" in cors_origins:
        raise RuntimeError("CORS_ALLOWED_ORIGINS must be explicit for staging/production")
    if any("localhost" in origin or "127.0.0.1" in origin for origin in cors_origins):
        raise RuntimeError("CORS_ALLOWED_ORIGINS must not include localhost origins for staging/production")
    if os.getenv("VANTDOMUS_ENABLE_PUBLIC_UPLOADS", "").strip().lower() in {"1", "true", "yes"}:
        raise RuntimeError("VANTDOMUS_ENABLE_PUBLIC_UPLOADS must not be enabled for staging/production")
    ai_enabled = os.getenv("VANTDOMUS_AI_FEATURES_ENABLED", "true").strip().lower() in {"1", "true", "yes"}
    if ai_enabled:
        ai_key_mode = os.getenv("VANTDOMUS_AI_KEYS_MODE", "platform").strip().lower()
        if ai_key_mode not in {"platform", "tenant_byok"}:
            raise RuntimeError("VANTDOMUS_AI_KEYS_MODE must be platform or tenant_byok")
        secret_manager = os.getenv("VANTDOMUS_SECRET_MANAGER", "env").strip().lower()
        if secret_manager not in {"env", "azure_key_vault", "aws_secrets_manager", "gcp_secret_manager", "doppler", "onepassword"}:
            raise RuntimeError("VANTDOMUS_SECRET_MANAGER must be a supported secret manager")
        if ai_key_mode == "platform" and not os.getenv("OPENAI_API_KEY", "").strip():
            raise RuntimeError("OPENAI_API_KEY is required for platform-managed AI/STT/TTS in staging/production")
        if ai_key_mode == "tenant_byok" and secret_manager == "env":
            raise RuntimeError("tenant_byok requires a real secret manager, not env")
    public_url = os.getenv("VANTDOMUS_APP_PUBLIC_URL", "").strip()
    if not public_url.startswith("https://"):
        raise RuntimeError("VANTDOMUS_APP_PUBLIC_URL must be configured with an https:// URL for staging/production")
    allowed_hosts = [host.strip().lower() for host in os.getenv("VANTDOMUS_ALLOWED_HOSTS", "").split(",") if host.strip()]
    public_host = urlparse(public_url).hostname
    if not allowed_hosts:
        raise RuntimeError("VANTDOMUS_ALLOWED_HOSTS must be explicit for staging/production")
    if "*" in allowed_hosts or any(host in {"localhost", "127.0.0.1"} for host in allowed_hosts):
        raise RuntimeError("VANTDOMUS_ALLOWED_HOSTS must not include wildcard or localhost hosts for staging/production")
    if public_host and public_host.lower() not in allowed_hosts:
        raise RuntimeError("VANTDOMUS_ALLOWED_HOSTS must include the host from VANTDOMUS_APP_PUBLIC_URL")
    smtp_required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"]
    missing_smtp = [name for name in smtp_required if not os.getenv(name, "").strip()]
    if missing_smtp:
        raise RuntimeError(f"SMTP email delivery must be configured for staging/production: {', '.join(missing_smtp)}")
