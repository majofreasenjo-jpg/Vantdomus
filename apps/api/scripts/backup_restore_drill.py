import argparse
import base64
import hashlib
import json
import os
import shutil
import sqlite3
import tempfile
from datetime import datetime, timezone
from pathlib import Path
import sys

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from app.config import settings  # noqa: E402


REQUIRED_TABLES = {
    "users",
    "households",
    "household_memberships",
    "audit_log",
    "user_mfa",
    "logbook_entries",
    "signed_file_tokens",
}
BACKUP_ENVELOPE_VERSION = 1
BACKUP_KDF_ITERATIONS = 480_000


def _timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def _write_backup_manifest(backup_path: Path, *, encrypted: bool, source_path: Path, verification: dict) -> Path:
    manifest_path = backup_path.with_name(f"{backup_path.name}.manifest.json")
    manifest = {
        "version": 1,
        "backup_file": backup_path.name,
        "backup_bytes": backup_path.stat().st_size,
        "backup_sha256": _sha256_file(backup_path),
        "encrypted": encrypted,
        "source": str(source_path),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "verification": verification,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    return manifest_path


def _copy_offsite(backup_path: Path, manifest_path: Path, offsite_dir: Path) -> dict:
    offsite_dir.mkdir(parents=True, exist_ok=True)
    offsite_backup = offsite_dir / backup_path.name
    offsite_manifest = offsite_dir / manifest_path.name
    shutil.copy2(backup_path, offsite_backup)
    shutil.copy2(manifest_path, offsite_manifest)
    source_hash = _sha256_file(backup_path)
    offsite_hash = _sha256_file(offsite_backup)
    return {
        "ok": source_hash == offsite_hash,
        "backup": str(offsite_backup),
        "manifest": str(offsite_manifest),
        "backup_sha256": offsite_hash,
    }


def _sqlite_backup(source_path: Path, backup_path: Path) -> None:
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    source = sqlite3.connect(source_path)
    try:
        target = sqlite3.connect(backup_path)
        try:
            source.backup(target)
        finally:
            target.close()
    finally:
        source.close()


def _derive_backup_key(secret: str, salt: bytes) -> bytes:
    if len(secret) < 32:
        raise ValueError("Backup encryption key must be at least 32 characters long")
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=BACKUP_KDF_ITERATIONS,
    )
    return base64.urlsafe_b64encode(kdf.derive(secret.encode("utf-8")))


def _encrypt_backup(plain_path: Path, encrypted_path: Path, secret: str) -> None:
    encrypted_path.parent.mkdir(parents=True, exist_ok=True)
    salt = os.urandom(16)
    token = Fernet(_derive_backup_key(secret, salt)).encrypt(plain_path.read_bytes())
    envelope = {
        "version": BACKUP_ENVELOPE_VERSION,
        "algorithm": "fernet-aes128-cbc-hmac-sha256",
        "kdf": "pbkdf2-sha256",
        "iterations": BACKUP_KDF_ITERATIONS,
        "salt": base64.b64encode(salt).decode("ascii"),
        "ciphertext": token.decode("ascii"),
    }
    encrypted_path.write_text(json.dumps(envelope, separators=(",", ":")), encoding="utf-8")


def _decrypt_backup(encrypted_path: Path, restored_path: Path, secret: str) -> None:
    envelope = json.loads(encrypted_path.read_text(encoding="utf-8"))
    if envelope.get("version") != BACKUP_ENVELOPE_VERSION:
        raise ValueError("Unsupported encrypted backup version")
    salt = base64.b64decode(envelope["salt"])
    token = envelope["ciphertext"].encode("ascii")
    restored_path.write_bytes(Fernet(_derive_backup_key(secret, salt)).decrypt(token))


def _verify_restore(backup_path: Path, encryption_key: str | None = None) -> dict:
    with tempfile.TemporaryDirectory(prefix="vantdomus-restore-drill-") as temp_dir:
        restored_path = Path(temp_dir) / "restored.db"
        if encryption_key:
            _decrypt_backup(backup_path, restored_path, encryption_key)
        else:
            _sqlite_backup(backup_path, restored_path)
        con = sqlite3.connect(restored_path)
        try:
            integrity = con.execute("PRAGMA integrity_check").fetchone()[0]
            tables = {
                row[0]
                for row in con.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
                ).fetchall()
            }
            missing_tables = sorted(REQUIRED_TABLES - tables)
            table_counts = {}
            for table in sorted(REQUIRED_TABLES & tables):
                table_counts[table] = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        finally:
            con.close()
    return {
        "integrity": integrity,
        "missing_tables": missing_tables,
        "table_counts": table_counts,
    }


def run_drill(
    backup_dir: Path,
    *,
    encrypt: bool = False,
    encryption_key: str | None = None,
    offsite_dir: Path | None = None,
) -> dict:
    if settings.DATABASE_URL or os.getenv("DATABASE_URL"):
        raise RuntimeError("backup_restore_drill.py currently supports SQLite DB_PATH only")

    source_path = Path(settings.DB_PATH).resolve()
    if not source_path.exists():
        raise FileNotFoundError(f"SQLite database not found: {source_path}")

    backup_dir = backup_dir.resolve()
    if encrypt:
        encryption_key = encryption_key or os.getenv("VANTDOMUS_BACKUP_ENCRYPTION_KEY")
        if not encryption_key:
            raise RuntimeError("Encrypted backups require VANTDOMUS_BACKUP_ENCRYPTION_KEY")
        backup_path = backup_dir / f"vantdomus-backup-{_timestamp()}.db.enc"
        with tempfile.TemporaryDirectory(prefix="vantdomus-backup-plain-") as temp_dir:
            plain_backup_path = Path(temp_dir) / "backup.db"
            _sqlite_backup(source_path, plain_backup_path)
            _encrypt_backup(plain_backup_path, backup_path, encryption_key)
        verification = _verify_restore(backup_path, encryption_key=encryption_key)
    else:
        backup_path = backup_dir / f"vantdomus-backup-{_timestamp()}.db"
        _sqlite_backup(source_path, backup_path)
        verification = _verify_restore(backup_path)
    manifest_path = _write_backup_manifest(
        backup_path,
        encrypted=encrypt,
        source_path=source_path,
        verification=verification,
    )
    offsite = _copy_offsite(backup_path, manifest_path, offsite_dir.resolve()) if offsite_dir else None
    ok = verification["integrity"] == "ok" and not verification["missing_tables"]
    if offsite:
        ok = ok and offsite["ok"]
    return {
        "ok": ok,
        "encrypted": encrypt,
        "source": str(source_path),
        "backup": str(backup_path),
        "manifest": str(manifest_path),
        "offsite": offsite,
        "verification": verification,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a SQLite backup and verify it can be restored.")
    parser.add_argument(
        "--backup-dir",
        default=str(API_ROOT / "data" / "backups"),
        help="Directory where the verified backup copy will be written.",
    )
    parser.add_argument(
        "--encrypt",
        action="store_true",
        help="Write an encrypted backup envelope and verify restore by decrypting it.",
    )
    parser.add_argument(
        "--offsite-dir",
        help="Optional directory where the backup and manifest will be copied after local verification.",
    )
    args = parser.parse_args()
    result = run_drill(Path(args.backup_dir), encrypt=args.encrypt, offsite_dir=Path(args.offsite_dir) if args.offsite_dir else None)
    print(result)
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
