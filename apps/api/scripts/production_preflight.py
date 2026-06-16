import argparse
import hashlib
import json
import os
import sys
from pathlib import Path


API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from app.config import validate_runtime_security  # noqa: E402
from app.db import connect  # noqa: E402
from app.malware import check_clamav_health  # noqa: E402
from app.rate_limit import check_redis_health  # noqa: E402


def _check(name: str, ok: bool, status: str, **extra) -> dict:
    return {"name": name, "ok": ok, "status": status, **extra}


def _runtime_check() -> dict:
    try:
        validate_runtime_security()
        return _check("runtime", True, "ok")
    except Exception as exc:
        return _check("runtime", False, "failed", detail=str(exc))


def _database_check() -> dict:
    try:
        db = connect()
        try:
            db.execute("SELECT 1").fetchone()
        finally:
            db.close()
        return _check("database", True, "ok")
    except Exception as exc:
        return _check("database", False, "unavailable", detail=str(exc))


def _redis_check() -> dict:
    result = check_redis_health()
    return _check("redis", bool(result.get("ok")), result.get("status", "unknown"), detail=result.get("detail"))


def _clamav_check() -> dict:
    result = check_clamav_health()
    return _check("clamav", bool(result.get("ok")), result.get("status", "unknown"), detail=result.get("detail"))


def _backup_check(backup_dir: Path | None = None) -> dict:
    resolved = backup_dir or Path(os.getenv("VANTDOMUS_BACKUP_DIR", str(API_ROOT / "data" / "backups")))
    if not resolved.exists():
        return _check("backups", False, "missing", backup_dir=str(resolved))
    backups = sorted(
        [path for path in resolved.iterdir() if path.is_file() and (path.name.endswith(".db") or path.name.endswith(".db.enc"))],
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    if not backups:
        return _check("backups", False, "empty", backup_dir=str(resolved))
    latest = backups[0]
    manifest_path = latest.with_name(f"{latest.name}.manifest.json")
    if latest.name.endswith(".db.enc"):
        if not manifest_path.exists():
            return _check("backups", False, "manifest_missing", backup_dir=str(resolved), latest_backup=latest.name)
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except Exception as exc:
            return _check("backups", False, "manifest_invalid", backup_dir=str(resolved), latest_backup=latest.name, detail=str(exc))
        digest = hashlib.sha256(latest.read_bytes()).hexdigest()
        if manifest.get("backup_file") != latest.name or manifest.get("backup_sha256") != digest:
            return _check("backups", False, "checksum_mismatch", backup_dir=str(resolved), latest_backup=latest.name)
    return _check(
        "backups",
        latest.name.endswith(".db.enc"),
        "ok" if latest.name.endswith(".db.enc") else "unencrypted",
        backup_dir=str(resolved),
        latest_backup=latest.name,
        latest_backup_bytes=latest.stat().st_size,
        manifest=manifest_path.name if manifest_path.exists() else None,
    )


def run_preflight(*, backup_dir: Path | None = None, skip_network: bool = False) -> dict:
    checks = [_runtime_check(), _database_check(), _backup_check(backup_dir)]
    if skip_network:
        checks.append(_check("redis", True, "skipped"))
        checks.append(_check("clamav", True, "skipped"))
    else:
        checks.append(_redis_check())
        checks.append(_clamav_check())
    return {"ok": all(item["ok"] for item in checks), "checks": checks}


def main() -> None:
    parser = argparse.ArgumentParser(description="Run VantDomus production readiness checks.")
    parser.add_argument("--backup-dir", help="Directory containing encrypted backup artifacts.")
    parser.add_argument("--skip-network", action="store_true", help="Skip Redis and ClamAV network checks.")
    args = parser.parse_args()
    result = run_preflight(
        backup_dir=Path(args.backup_dir) if args.backup_dir else None,
        skip_network=args.skip_network,
    )
    print(json.dumps(result, indent=2, sort_keys=True))
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
