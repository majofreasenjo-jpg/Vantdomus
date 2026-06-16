import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path


API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from app.db import connect, ensure_schema  # noqa: E402
from app.security_events import write_security_event  # noqa: E402


def _cutoff_iso(grace_days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=max(1, grace_days))).isoformat()


def _grace_days() -> int:
    return int(os.getenv("VANTDOMUS_RETENTION_CLEANUP_GRACE_DAYS", "30"))


RETENTION_QUERIES = {
    "signed_file_tokens": {
        "count": """
            SELECT COUNT(*) FROM signed_file_tokens
            WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)
        """,
        "delete": """
            DELETE FROM signed_file_tokens
            WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)
        """,
    },
    "household_invitations": {
        "count": """
            SELECT COUNT(*) FROM household_invitations
            WHERE expires_at < ?
               OR (accepted_at IS NOT NULL AND accepted_at < ?)
               OR (revoked_at IS NOT NULL AND revoked_at < ?)
        """,
        "delete": """
            DELETE FROM household_invitations
            WHERE expires_at < ?
               OR (accepted_at IS NOT NULL AND accepted_at < ?)
               OR (revoked_at IS NOT NULL AND revoked_at < ?)
        """,
    },
    "user_mfa_recovery_codes": {
        "count": """
            SELECT COUNT(*) FROM user_mfa_recovery_codes
            WHERE used_at IS NOT NULL AND used_at < ?
        """,
        "delete": """
            DELETE FROM user_mfa_recovery_codes
            WHERE used_at IS NOT NULL AND used_at < ?
        """,
    },
    "auth_sessions": {
        "count": """
            SELECT COUNT(*) FROM auth_sessions
            WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)
        """,
        "delete": """
            DELETE FROM auth_sessions
            WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)
        """,
    },
    "email_verification_tokens": {
        "count": """
            SELECT COUNT(*) FROM email_verification_tokens
            WHERE expires_at < ? OR (used_at IS NOT NULL AND used_at < ?)
        """,
        "delete": """
            DELETE FROM email_verification_tokens
            WHERE expires_at < ? OR (used_at IS NOT NULL AND used_at < ?)
        """,
    },
    "password_reset_tokens": {
        "count": """
            SELECT COUNT(*) FROM password_reset_tokens
            WHERE expires_at < ? OR (used_at IS NOT NULL AND used_at < ?)
        """,
        "delete": """
            DELETE FROM password_reset_tokens
            WHERE expires_at < ? OR (used_at IS NOT NULL AND used_at < ?)
        """,
    },
}


def _params_for(table: str, cutoff: str) -> tuple[str, ...]:
    if table == "household_invitations":
        return (cutoff, cutoff, cutoff)
    if table in {"signed_file_tokens", "auth_sessions", "email_verification_tokens", "password_reset_tokens"}:
        return (cutoff, cutoff)
    return (cutoff,)


def run_cleanup(*, apply: bool = False, grace_days: int | None = None) -> dict:
    ensure_schema()
    cutoff = _cutoff_iso(grace_days if grace_days is not None else _grace_days())
    db = connect()
    summary = {}
    try:
        for table, queries in RETENTION_QUERIES.items():
            params = _params_for(table, cutoff)
            removable = db.execute(queries["count"], params).fetchone()[0]
            deleted = 0
            if apply and removable:
                cur = db.execute(queries["delete"], params)
                deleted = cur.rowcount if cur.rowcount is not None else removable
            summary[table] = {"removable": int(removable), "deleted": int(deleted)}
        if apply:
            write_security_event(
                db,
                event_type="retention_cleanup",
                severity="low",
                source="retention_cleanup",
                metadata={"cutoff": cutoff, "summary": summary},
                commit=False,
            )
            db.commit()
    finally:
        db.close()
    return {"ok": True, "applied": apply, "cutoff": cutoff, "summary": summary}


def main() -> None:
    parser = argparse.ArgumentParser(description="Purge expired temporary security records after a grace period.")
    parser.add_argument("--apply", action="store_true", help="Delete eligible records. Without this flag, dry-run only.")
    parser.add_argument("--grace-days", type=int, help="Grace period before temporary records are purged.")
    args = parser.parse_args()
    print(run_cleanup(apply=args.apply, grace_days=args.grace_days))


if __name__ == "__main__":
    main()
