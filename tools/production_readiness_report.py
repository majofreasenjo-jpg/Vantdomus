import argparse
import json
import os
from pathlib import Path


REQUIRED_API_KEYS = [
    "APP_ENV",
    "DATABASE_URL",
    "JWT_SECRET",
    "VANTDOMUS_ALLOWED_HOSTS",
    "CORS_ALLOWED_ORIGINS",
    "VANTDOMUS_APP_PUBLIC_URL",
    "VANTDOMUS_API_RATE_LIMIT_MODE",
    "VANTDOMUS_REDIS_URL",
    "VANTDOMUS_MALWARE_SCAN_MODE",
    "VANTDOMUS_CLAMAV_HOST",
    "VANTDOMUS_CLAMAV_PORT",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS",
    "SMTP_FROM",
    "VANTDOMUS_BACKUP_ENCRYPTION_KEY",
    "VANTDOMUS_SECURITY_ALERT_WEBHOOK_URL",
    "VANTDOMUS_SECURITY_ALERT_SIGNING_SECRET",
]

REQUIRED_WEB_KEYS = [
    "VANTDOMUS_DEPLOY_ENV",
    "NEXT_PUBLIC_API_BASE",
    "VANTDOMUS_WEB_PROXY_MAX_BODY_BYTES",
    "VANTDOMUS_WEB_PUBLIC_PROXY_MAX_BODY_BYTES",
]

FORBIDDEN_WEB_KEYS = [
    "NEXT_PUBLIC_ACCESS_TOKEN",
    "NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID",
]

PLACEHOLDER_MARKERS = ["CHANGE_ME", "example.com", "PASTE_", "<secret", "localhost", "127.0.0.1"]


def _parse_env(path: Path | None) -> dict[str, str]:
    values = {}
    if not path:
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def _check(name: str, ok: bool, status: str, **extra) -> dict:
    return {"name": name, "ok": ok, "status": status, **extra}


def _missing_keys(prefix: str, env: dict[str, str], required: list[str]) -> list[dict]:
    return [
        _check(f"{prefix}_{key.lower()}", bool(env.get(key, "").strip()), "ok" if env.get(key, "").strip() else "missing")
        for key in required
    ]


def _placeholder_checks(prefix: str, env: dict[str, str], keys: list[str]) -> list[dict]:
    checks = []
    for key in keys:
        value = env.get(key, "")
        has_placeholder = any(marker.lower() in value.lower() for marker in PLACEHOLDER_MARKERS)
        checks.append(_check(f"{prefix}_{key.lower()}_real_value", not has_placeholder and bool(value), "ok" if not has_placeholder and bool(value) else "placeholder_or_empty"))
    return checks


def _forbidden_web_checks(web_env: dict[str, str]) -> list[dict]:
    return [
        _check(f"web_{key.lower()}_absent", not web_env.get(key, "").strip(), "ok" if not web_env.get(key, "").strip() else "forbidden_public_value")
        for key in FORBIDDEN_WEB_KEYS
    ]


def _backup_checks(backup_dir: Path | None) -> list[dict]:
    if not backup_dir:
        return [_check("backup_dir_configured", False, "missing")]
    if not backup_dir.exists():
        return [_check("backup_dir_exists", False, "missing", path=str(backup_dir))]
    encrypted = list(backup_dir.glob("*.db.enc"))
    manifests = list(backup_dir.glob("*.manifest.json"))
    return [
        _check("backup_dir_exists", True, "ok", path=str(backup_dir)),
        _check("encrypted_backup_present", bool(encrypted), "ok" if encrypted else "missing"),
        _check("backup_manifest_present", bool(manifests), "ok" if manifests else "missing"),
    ]


def _document_checks(root: Path) -> list[dict]:
    docs = [
        "docs/PRODUCTION_RUNBOOK.md",
        "docs/PRODUCTION_READINESS_7_POINT_PLAN.md",
        "docs/LAUNCH_SIGNOFF_CHECKLIST.md",
        "docs/STAGING_SMOKE_TEST.md",
        "docs/LEGAL_DATA_PROTECTION_PACK.md",
        "docs/SECRET_ROTATION_REGISTER.md",
        "docs/SUBPROCESSOR_REGISTER.md",
        "docs/INCIDENT_NOTIFICATION_TEMPLATE.md",
        "docs/BACKUP_RESTORE_DRILL_SIGNOFF.md",
        "docs/SECURITY_BASELINE.md",
    ]
    return [
        _check(f"doc_{Path(doc).stem.lower()}", (root / doc).exists(), "ok" if (root / doc).exists() else "missing", path=doc)
        for doc in docs
    ]


def run_report(*, api_env_path: Path | None, web_env_path: Path | None, backup_dir: Path | None, root: Path) -> dict:
    api_env = _parse_env(api_env_path)
    web_env = _parse_env(web_env_path)
    checks = []
    checks.extend(_missing_keys("api", api_env, REQUIRED_API_KEYS))
    checks.extend(_missing_keys("web", web_env, REQUIRED_WEB_KEYS))
    checks.extend(_placeholder_checks("api", api_env, REQUIRED_API_KEYS))
    checks.extend(_placeholder_checks("web", web_env, REQUIRED_WEB_KEYS))
    checks.extend(_forbidden_web_checks(web_env))
    checks.extend(_backup_checks(backup_dir))
    checks.extend(_document_checks(root))
    critical_failures = [check for check in checks if not check["ok"]]
    return {
        "ok": not critical_failures,
        "summary": {
            "checks": len(checks),
            "failed": len(critical_failures),
        },
        "checks": checks,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a production readiness report from env files and local artifacts.")
    parser.add_argument("--api-env", help="API production env file to inspect.")
    parser.add_argument("--web-env", help="Web production env file to inspect.")
    parser.add_argument("--backup-dir", help="Backup directory to inspect for encrypted artifacts.")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    result = run_report(
        api_env_path=Path(args.api_env) if args.api_env else None,
        web_env_path=Path(args.web_env) if args.web_env else None,
        backup_dir=Path(args.backup_dir) if args.backup_dir else None,
        root=root,
    )
    print(json.dumps(result, indent=2, sort_keys=True))
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
