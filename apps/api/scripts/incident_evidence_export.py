import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from app.db import connect, ensure_schema  # noqa: E402
from app.security_events import verify_security_event_chain  # noqa: E402


def _json_or_empty(value: str | None):
    try:
        return json.loads(value or "{}")
    except Exception:
        return {"_parse_error": True}


def _window_clause(start_at: str | None, end_at: str | None, column: str = "created_at") -> tuple[str, list[str]]:
    clauses = []
    params = []
    if start_at:
        clauses.append(f"{column} >= ?")
        params.append(start_at)
    if end_at:
        clauses.append(f"{column} <= ?")
        params.append(end_at)
    return (" AND " + " AND ".join(clauses) if clauses else ""), params


def _fetch_audit(db, household_id: str, start_at: str | None, end_at: str | None) -> list[dict]:
    window, params = _window_clause(start_at, end_at)
    rows = db.execute(
        f"""
        SELECT id, household_id, organization_id, user_id, action, resource_type, resource_id, metadata, created_at
        FROM audit_log
        WHERE household_id=?{window}
        ORDER BY created_at ASC, id ASC
        """,
        (household_id, *params),
    ).fetchall()
    return [
        {
            "id": row["id"],
            "household_id": row["household_id"],
            "organization_id": row["organization_id"] if "organization_id" in row.keys() else None,
            "user_id": row["user_id"],
            "action": row["action"],
            "resource_type": row["resource_type"],
            "resource_id": row["resource_id"],
            "metadata": _json_or_empty(row["metadata"]),
            "created_at": row["created_at"],
        }
        for row in rows
    ]


def _fetch_security_events(db, household_id: str, start_at: str | None, end_at: str | None) -> list[dict]:
    window, params = _window_clause(start_at, end_at)
    rows = db.execute(
        f"""
        SELECT id, household_id, organization_id, user_id, event_type, severity, source, metadata, created_at, previous_hash, event_hash
        FROM security_events
        WHERE household_id=?{window}
        ORDER BY created_at ASC, id ASC
        """,
        (household_id, *params),
    ).fetchall()
    return [
        {
            "id": row["id"],
            "household_id": row["household_id"],
            "organization_id": row["organization_id"],
            "user_id": row["user_id"],
            "event_type": row["event_type"],
            "severity": row["severity"],
            "source": row["source"],
            "metadata": _json_or_empty(row["metadata"]),
            "created_at": row["created_at"],
            "previous_hash": row["previous_hash"] if "previous_hash" in row.keys() else None,
            "event_hash": row["event_hash"] if "event_hash" in row.keys() else None,
        }
        for row in rows
    ]


def _fetch_assistant_actions(db, household_id: str, start_at: str | None, end_at: str | None) -> list[dict]:
    window, params = _window_clause(start_at, end_at)
    rows = db.execute(
        f"""
        SELECT id, household_id, organization_id, user_id, tool_name, arguments, result, status, created_at
        FROM assistant_action_log
        WHERE household_id=?{window}
        ORDER BY created_at ASC, id ASC
        """,
        (household_id, *params),
    ).fetchall()
    return [
        {
            "id": row["id"],
            "household_id": row["household_id"],
            "organization_id": row["organization_id"] if "organization_id" in row.keys() else None,
            "user_id": row["user_id"],
            "tool_name": row["tool_name"],
            "arguments": _json_or_empty(row["arguments"]),
            "result": row["result"],
            "status": row["status"],
            "created_at": row["created_at"],
        }
        for row in rows
    ]


def build_evidence_package(household_id: str, *, start_at: str | None = None, end_at: str | None = None) -> dict:
    ensure_schema()
    db = connect()
    try:
        household = db.execute(
            "SELECT id, name, organization_id FROM households WHERE id=?",
            (household_id,),
        ).fetchone()
        if not household:
            raise ValueError(f"Household not found: {household_id}")
        evidence = {
            "metadata": {
                "version": 1,
                "household_id": household["id"],
                "household_name": household["name"],
                "organization_id": household["organization_id"],
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "start_at": start_at,
                "end_at": end_at,
            },
            "chain_verification": verify_security_event_chain(db, household_id),
            "audit_log": _fetch_audit(db, household_id, start_at, end_at),
            "security_events": _fetch_security_events(db, household_id, start_at, end_at),
            "assistant_action_log": _fetch_assistant_actions(db, household_id, start_at, end_at),
        }
    finally:
        db.close()
    payload = json.dumps(evidence, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    evidence["metadata"]["package_sha256"] = hashlib.sha256(payload).hexdigest()
    return evidence


def write_evidence_package(output_dir: Path, household_id: str, *, start_at: str | None = None, end_at: str | None = None) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    package = build_evidence_package(household_id, start_at=start_at, end_at=end_at)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = output_dir / f"incident-evidence-{household_id}-{timestamp}.json"
    path.write_text(json.dumps(package, indent=2, sort_keys=True, ensure_ascii=False), encoding="utf-8")
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description="Export tenant-scoped incident evidence.")
    parser.add_argument("--household-id", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--start-at")
    parser.add_argument("--end-at")
    args = parser.parse_args()
    path = write_evidence_package(
        Path(args.output_dir),
        args.household_id,
        start_at=args.start_at,
        end_at=args.end_at,
    )
    print(path)


if __name__ == "__main__":
    main()
