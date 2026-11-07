"""DOMI R94-C: first fictional owner in a CLOSED family-pilot, offline only.

This is deliberately a separate, one-shot wrapper around the existing
bootstrap_admin primitive. It never opens a listening socket or a registration
endpoint and never resets an existing user. Do not run against real family data.

Interactive CLI:
  python scripts/bootstrap_first_owner_r94c.py --email test@example.invalid \\
    --home-name "Hogar ficticio" --confirm-synthetic

The password is entered through getpass, NOT argv, environment or logs.
The database must already have its schema and be an isolated synthetic disk.
"""
from __future__ import annotations

import argparse
import getpass
import re
import sys


def bootstrap_first_owner(email: str, password: str, home_name: str = "Hogar ficticio") -> dict:
    """Create *only* the first synthetic family-pilot owner. No password resets."""
    from app.config import is_family_pilot, public_registration_enabled, validate_runtime_security
    from app.db import connect

    if not is_family_pilot() or public_registration_enabled():
        raise SystemExit("R94C_REFUSED_PROFILE_OR_PUBLIC_REGISTRATION")
    # This includes strong secrets, HTTPS public URL, closed registration,
    # a persistent SQLite path outside the repository, and mock-only AI.
    try:
        validate_runtime_security()
    except RuntimeError as exc:
        raise SystemExit("R94C_RUNTIME_SECURITY_REJECTED:" + type(exc).__name__) from None

    normalized = (email or "").strip().lower()
    if (not re.fullmatch(r"[a-z0-9][a-z0-9._+-]{1,50}@(?:[a-z0-9-]+\.)*example\.invalid", normalized)
            or len(password or "") < 12 or len(password) > 128
            or not (3 <= len(home_name.strip()) <= 70)):
        raise SystemExit("R94C_SYNTHETIC_INPUT_INVALID")

    db = connect()
    try:
        # No schema setup or destructive migration is performed here. A local,
        # already-migrated, empty synthetic DB is a hard precondition.
        for table in ("users", "households", "household_memberships", "persons"):
            row = db.execute("SELECT COUNT(*) AS n FROM " + table).fetchone()
            if int(row["n"]) != 0:
                raise SystemExit("R94C_DATABASE_NOT_EMPTY")
    except SystemExit:
        raise
    except Exception:
        raise SystemExit("R94C_SCHEMA_UNAVAILABLE") from None
    finally:
        db.close()

    # This existing primitive creates a verified owner, a household, an
    # organization and a person linked to the same user. No network calls.
    from scripts.bootstrap_admin import bootstrap_admin
    return bootstrap_admin(normalized, password, home_name.strip())


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="R94-C synthetic first-owner bootstrap, offline only")
    parser.add_argument("--email", required=True)
    parser.add_argument("--home-name", default="Hogar ficticio")
    parser.add_argument("--confirm-synthetic", action="store_true")
    args, unknown = parser.parse_known_args(argv)
    # parse_args normally echoes unknown positional arguments to stderr; an
    # accidental legacy positional PASSWORD must never be echoed back.
    if unknown:
        raise SystemExit("R94C_UNKNOWN_ARGUMENTS_REDACTED")
    if not args.confirm_synthetic:
        raise SystemExit("R94C_EXPLICIT_SYNTHETIC_CONFIRMATION_REQUIRED")
    if not sys.stdin.isatty():
        raise SystemExit("R94C_INTERACTIVE_TERMINAL_REQUIRED")
    password = getpass.getpass("Contraseña de laboratorio (no visible): ")
    bootstrap_first_owner(args.email, password, args.home_name)
    print("R94C_FIRST_OWNER_CREATED: fictitious account and household (identifiers withheld)")


if __name__ == "__main__":
    main()
