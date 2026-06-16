import argparse
import sys
from pathlib import Path


API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from app.db import connect, ensure_schema  # noqa: E402
from app.malware import check_clamav_health  # noqa: E402
from app.security_events import write_security_event  # noqa: E402


def run_check(*, record_event: bool = True) -> dict:
    ensure_schema()
    result = check_clamav_health()
    if result["ok"] or not record_event:
        return result

    db = connect()
    try:
        event_id = write_security_event(
            db,
            event_type="clamav_healthcheck_failed",
            severity="high",
            source="clamav_healthcheck",
            metadata=result,
            commit=True,
        )
    finally:
        db.close()
    return {**result, "event_id": event_id}


def main() -> None:
    parser = argparse.ArgumentParser(description="Check ClamAV daemon health and record a security event on failure.")
    parser.add_argument(
        "--no-record-event",
        action="store_true",
        help="Only print health status; do not write security_events on failure.",
    )
    args = parser.parse_args()
    result = run_check(record_event=not args.no_record_event)
    print(result)
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
