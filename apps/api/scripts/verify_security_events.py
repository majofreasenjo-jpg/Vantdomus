import argparse
import json
import sys
from pathlib import Path


API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from app.db import connect, ensure_schema  # noqa: E402
from app.security_events import verify_security_event_chain  # noqa: E402


def _household_ids_with_security_events(db) -> list[str]:
    rows = db.execute(
        """
        SELECT DISTINCT household_id
        FROM security_events
        WHERE household_id IS NOT NULL
        ORDER BY household_id
        """
    ).fetchall()
    return [row["household_id"] for row in rows]


def run_verification(*, household_id: str | None = None, include_global: bool = True) -> dict:
    ensure_schema()
    db = connect()
    try:
        checks = []
        if household_id:
            checks.append({"scope": household_id, **verify_security_event_chain(db, household_id)})
        else:
            if include_global:
                checks.append({"scope": "global", **verify_security_event_chain(db, None)})
            for hid in _household_ids_with_security_events(db):
                checks.append({"scope": hid, **verify_security_event_chain(db, hid)})
    finally:
        db.close()
    return {"ok": all(check["ok"] for check in checks), "checks": checks}


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify tamper-evident security event hash chains.")
    parser.add_argument("--household-id", help="Verify only one household chain.")
    parser.add_argument("--skip-global", action="store_true", help="Skip global security events without household_id.")
    args = parser.parse_args()
    result = run_verification(household_id=args.household_id, include_global=not args.skip_global)
    print(json.dumps(result, indent=2, sort_keys=True))
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
