import argparse
from pathlib import Path
import sys


API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from app.db import connect  # noqa: E402
from app.mfa import protect_totp_secret, reveal_totp_secret, should_reprotect_totp_secret  # noqa: E402


def rotate_mfa_secrets(dry_run: bool = True) -> dict:
    db = connect()
    rotated = 0
    skipped = 0
    failed = 0
    try:
        rows = db.execute("SELECT user_id, totp_secret FROM user_mfa WHERE totp_secret IS NOT NULL").fetchall()
        for row in rows:
            user_id = row["user_id"]
            stored_secret = row["totp_secret"]
            if not should_reprotect_totp_secret(stored_secret):
                skipped += 1
                continue
            try:
                secret = reveal_totp_secret(stored_secret)
                protected = protect_totp_secret(secret)
                if not dry_run:
                    db.execute("UPDATE user_mfa SET totp_secret=? WHERE user_id=?", (protected, user_id))
                rotated += 1
            except Exception as exc:
                failed += 1
                print(f"FAILED user_id={user_id}: {exc}")
        if not dry_run:
            db.commit()
        return {"rotated": rotated, "skipped": skipped, "failed": failed, "dry_run": dry_run}
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Rotate encrypted MFA TOTP secrets to the active VANTDOMUS_MFA_SECRET_KEYS key.")
    parser.add_argument("--apply", action="store_true", help="Persist the rotation. Without this flag the command is a dry run.")
    args = parser.parse_args()
    result = rotate_mfa_secrets(dry_run=not args.apply)
    print(result)
    if result["failed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
