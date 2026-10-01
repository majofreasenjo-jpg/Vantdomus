#!/usr/bin/env python3
"""
Autonomous, read-only verifier for the VantDomus security_events hash chain.

Properties:
- fail-closed by default;
- supports SQLite directly and Postgres when psycopg2 is available;
- performs no writes;
- emits privacy-minimized JSON receipts (no raw metadata, credentials, or IDs);
- validates event hashes and chain topology without relying on row ordering.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sqlite3
import sys
from pathlib import Path
from typing import Any, Iterable

HEX64_RE = re.compile(r"^[0-9a-f]{64}$", re.IGNORECASE)
DEFAULT_MAX_EVENTS = 100_000


def _canonical_event_payload(
    *,
    event_id: str,
    household_id: str | None,
    organization_id: str | None,
    user_id: str | None,
    event_type: str,
    severity: str,
    source: str,
    metadata: dict[str, Any],
    created_at: str,
    previous_hash: str | None,
) -> bytes:
    return json.dumps(
        {
            "id": event_id,
            "household_id": household_id,
            "organization_id": organization_id,
            "user_id": user_id,
            "event_type": event_type,
            "severity": severity,
            "source": source,
            "metadata": metadata,
            "created_at": created_at,
            "previous_hash": previous_hash,
        },
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=str,
    ).encode("utf-8")


def _event_hash(**payload: Any) -> str:
    return hashlib.sha256(_canonical_event_payload(**payload)).hexdigest()


def _opaque_ref(prefix: str, value: str | None) -> str:
    if value is None:
        return f"{prefix}:NULL"
    digest = hashlib.sha256(f"{prefix}:{value}".encode("utf-8")).hexdigest()[:16]
    return f"{prefix}:{digest}"


def _row_to_dict(row: Any) -> dict[str, Any]:
    if isinstance(row, dict):
        return dict(row)
    try:
        return {key: row[key] for key in row.keys()}
    except Exception as exc:  # pragma: no cover - defensive adapter guard
        raise RuntimeError("DATABASE_ROW_MAPPING_UNSUPPORTED") from exc


def _sqlite_readonly(path: Path):
    if not path.exists():
        raise FileNotFoundError(f"SQLite database does not exist: {path}")
    uri = f"file:{path.resolve().as_posix()}?mode=ro"
    con = sqlite3.connect(uri, uri=True)
    con.row_factory = sqlite3.Row
    return con


def _postgres_readonly(database_url: str):
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
    except ImportError as exc:  # pragma: no cover - exercised only in deployed PG environments
        raise RuntimeError("PSYCOPG2_REQUIRED_FOR_POSTGRES") from exc
    con = psycopg2.connect(database_url)
    con.set_session(readonly=True, autocommit=True)

    class _PgReadonly:
        def execute(self, sql: str, params: tuple[Any, ...] = ()):
            cur = con.cursor(cursor_factory=RealDictCursor)
            cur.execute(sql.replace("?", "%s"), params)
            return cur

        def close(self):
            con.close()

    return _PgReadonly()


def _connect(args: argparse.Namespace):
    if args.db_path:
        return _sqlite_readonly(Path(args.db_path))
    database_url = (args.database_url or os.getenv("DATABASE_URL", "")).strip()
    if database_url:
        if database_url.startswith(("postgres://", "postgresql://")):
            return _postgres_readonly(database_url)
        raise RuntimeError("UNSUPPORTED_DATABASE_URL_SCHEME")
    db_path = os.getenv("DB_PATH", "").strip()
    if not db_path:
        raise RuntimeError("DATABASE_LOCATION_REQUIRED")
    return _sqlite_readonly(Path(db_path))


def _fetch_rows(db: Any, household_id: str | None, max_events: int) -> list[dict[str, Any]]:
    columns = (
        "id, household_id, organization_id, user_id, event_type, severity, "
        "source, metadata, created_at, previous_hash, event_hash"
    )
    if household_id is None:
        sql = f"SELECT {columns} FROM security_events LIMIT ?"
        params: tuple[Any, ...] = (max_events + 1,)
    else:
        sql = f"SELECT {columns} FROM security_events WHERE household_id=? LIMIT ?"
        params = (household_id, max_events + 1)
    try:
        rows = db.execute(sql, params).fetchall()
    except Exception as exc:
        raise RuntimeError(f"SECURITY_EVENT_CHAIN_SCHEMA_OR_QUERY_FAILURE:{exc.__class__.__name__}") from exc
    mapped = [_row_to_dict(row) for row in rows]
    if len(mapped) > max_events:
        raise RuntimeError("MAX_EVENTS_EXCEEDED")
    return mapped


def _failure(
    code: str,
    *,
    checked: int = 0,
    chain_key: str | None = None,
    event_id: str | None = None,
    detail: str | None = None,
) -> dict[str, Any]:
    receipt: dict[str, Any] = {
        "ok": False,
        "status": "HOLD_SECURITY_EVENT_CHAIN",
        "failure_code": code,
        "checked": checked,
    }
    if chain_key is not None:
        receipt["chain_ref"] = _opaque_ref("chain", chain_key)
    if event_id is not None:
        receipt["event_ref"] = _opaque_ref("event", event_id)
    if detail:
        receipt["detail"] = detail[:160]
    return receipt


def verify_rows(rows: Iterable[dict[str, Any]], *, allow_empty: bool = False) -> dict[str, Any]:
    rows = list(rows)
    if not rows:
        if allow_empty:
            return {
                "ok": True,
                "status": "PASS_EMPTY_ALLOWED",
                "checked": 0,
                "chain_count": 0,
                "chains": [],
            }
        return _failure("EMPTY_CHAIN_SET")

    checked = 0
    hashes_global: set[str] = set()
    groups: dict[str | None, list[dict[str, Any]]] = {}

    for row in rows:
        required = (
            "id",
            "household_id",
            "organization_id",
            "user_id",
            "event_type",
            "severity",
            "source",
            "metadata",
            "created_at",
            "previous_hash",
            "event_hash",
        )
        if any(key not in row for key in required):
            return _failure("ROW_SHAPE_INVALID", checked=checked)

        event_id = str(row["id"] or "")
        event_hash = str(row["event_hash"] or "")
        previous_hash = row["previous_hash"]
        previous_hash = None if previous_hash is None else str(previous_hash)

        if not event_id:
            return _failure("EVENT_ID_MISSING", checked=checked)
        if not HEX64_RE.fullmatch(event_hash):
            return _failure("EVENT_HASH_INVALID", checked=checked, event_id=event_id)
        if previous_hash is not None and not HEX64_RE.fullmatch(previous_hash):
            return _failure("PREVIOUS_HASH_INVALID", checked=checked, event_id=event_id)
        if event_hash in hashes_global:
            return _failure("DUPLICATE_EVENT_HASH", checked=checked, event_id=event_id)

        raw_metadata = row["metadata"]
        try:
            metadata = json.loads(raw_metadata or "{}") if isinstance(raw_metadata, str) else raw_metadata
        except Exception:
            return _failure("METADATA_JSON_INVALID", checked=checked, event_id=event_id)
        if not isinstance(metadata, dict):
            return _failure("METADATA_OBJECT_REQUIRED", checked=checked, event_id=event_id)

        expected_hash = _event_hash(
            event_id=event_id,
            household_id=row["household_id"],
            organization_id=row["organization_id"],
            user_id=row["user_id"],
            event_type=row["event_type"],
            severity=row["severity"],
            source=row["source"],
            metadata=metadata,
            created_at=row["created_at"],
            previous_hash=previous_hash,
        )
        if event_hash != expected_hash:
            return _failure("EVENT_HASH_MISMATCH", checked=checked, event_id=event_id)

        normalized = dict(row)
        normalized["id"] = event_id
        normalized["event_hash"] = event_hash
        normalized["previous_hash"] = previous_hash
        groups.setdefault(row["household_id"], []).append(normalized)
        hashes_global.add(event_hash)
        checked += 1

    chain_receipts: list[dict[str, Any]] = []

    for chain_key, chain_rows in groups.items():
        by_hash = {row["event_hash"]: row for row in chain_rows}
        genesis = [row for row in chain_rows if row["previous_hash"] is None]
        if len(genesis) != 1:
            return _failure(
                "CHAIN_GENESIS_COUNT_INVALID",
                checked=checked,
                chain_key=chain_key,
                detail=f"genesis_count={len(genesis)}",
            )

        children: dict[str, list[dict[str, Any]]] = {}
        for row in chain_rows:
            prev = row["previous_hash"]
            if prev is None:
                continue
            if prev not in by_hash:
                return _failure(
                    "CHAIN_ORPHAN_PREVIOUS_HASH",
                    checked=checked,
                    chain_key=chain_key,
                    event_id=row["id"],
                )
            children.setdefault(prev, []).append(row)

        for parent_hash, child_rows in children.items():
            if len(child_rows) != 1:
                parent = by_hash[parent_hash]
                return _failure(
                    "CHAIN_BRANCH_DETECTED",
                    checked=checked,
                    chain_key=chain_key,
                    event_id=parent["id"],
                    detail=f"child_count={len(child_rows)}",
                )

        visited: set[str] = set()
        current = genesis[0]
        while True:
            current_hash = current["event_hash"]
            if current_hash in visited:
                return _failure(
                    "CHAIN_CYCLE_DETECTED",
                    checked=checked,
                    chain_key=chain_key,
                    event_id=current["id"],
                )
            visited.add(current_hash)
            next_rows = children.get(current_hash, [])
            if not next_rows:
                head_hash = current_hash
                break
            current = next_rows[0]

        if len(visited) != len(chain_rows):
            return _failure(
                "CHAIN_DISCONNECTED_COMPONENT",
                checked=checked,
                chain_key=chain_key,
                detail=f"visited={len(visited)} total={len(chain_rows)}",
            )

        chain_receipts.append(
            {
                "chain_ref": _opaque_ref("chain", chain_key),
                "event_count": len(chain_rows),
                "head_hash": head_hash,
            }
        )

    chain_receipts.sort(key=lambda item: item["chain_ref"])
    receipt_material = json.dumps(
        {
            "checked": checked,
            "chains": chain_receipts,
        },
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")

    return {
        "ok": True,
        "status": "PASS_SECURITY_EVENT_CHAIN",
        "checked": checked,
        "chain_count": len(chain_receipts),
        "chains": chain_receipts,
        "receipt_digest": "sha256:" + hashlib.sha256(receipt_material).hexdigest(),
        "read_only": True,
        "metadata_emitted": False,
        "raw_identifiers_emitted": False,
    }


def verify_database(
    db: Any,
    *,
    household_id: str | None = None,
    allow_empty: bool = False,
    max_events: int = DEFAULT_MAX_EVENTS,
) -> dict[str, Any]:
    rows = _fetch_rows(db, household_id, max_events)
    return verify_rows(rows, allow_empty=allow_empty)


def _write_receipt(receipt: dict[str, Any], output: str | None) -> None:
    payload = json.dumps(receipt, indent=2, sort_keys=True)
    if output:
        path = Path(output)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(payload + "\n", encoding="utf-8")
    print(payload)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Read-only fail-closed verifier for the VantDomus security-event hash chain."
    )
    parser.add_argument("--db-path", help="SQLite database path. Opened read-only.")
    parser.add_argument("--database-url", help="Postgres DATABASE_URL. Prefer env injection in CI.")
    parser.add_argument("--household-id", help="Verify only one household chain.")
    parser.add_argument("--allow-empty", action="store_true", help="Allow zero security events.")
    parser.add_argument("--max-events", type=int, default=DEFAULT_MAX_EVENTS)
    parser.add_argument("--output", help="Optional path for the privacy-minimized JSON receipt.")
    args = parser.parse_args(argv)

    if args.max_events < 1:
        receipt = _failure("MAX_EVENTS_INVALID")
        _write_receipt(receipt, args.output)
        return 2

    db = None
    try:
        db = _connect(args)
        receipt = verify_database(
            db,
            household_id=args.household_id,
            allow_empty=args.allow_empty,
            max_events=args.max_events,
        )
    except Exception as exc:
        receipt = _failure(
            "VERIFIER_EXECUTION_FAILURE",
            detail=f"{exc.__class__.__name__}:{str(exc)[:120]}",
        )
    finally:
        if db is not None:
            try:
                db.close()
            except Exception:
                pass

    _write_receipt(receipt, args.output)
    return 0 if receipt.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
