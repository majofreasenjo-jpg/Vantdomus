import json
import hmac
import hashlib
import os
import urllib.request
import uuid
from datetime import datetime, timezone
from typing import Any


SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}
SENSITIVE_METADATA_KEYS = {"token", "auth_token", "token_hash", "password", "secret", "file_path", "attachment_path"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _alert_webhook_url() -> str:
    return os.getenv("VANTDOMUS_SECURITY_ALERT_WEBHOOK_URL", "").strip()


def _alert_min_severity() -> str:
    return os.getenv("VANTDOMUS_SECURITY_ALERT_MIN_SEVERITY", "high").strip().lower()


def _alert_timeout_seconds() -> float:
    return float(os.getenv("VANTDOMUS_SECURITY_ALERT_TIMEOUT_SECONDS", "5"))


def _should_alert(severity: str) -> bool:
    url = _alert_webhook_url()
    if not url:
        return False
    min_rank = SEVERITY_RANK.get(_alert_min_severity(), SEVERITY_RANK["high"])
    return SEVERITY_RANK.get(severity, -1) >= min_rank


def _redact_metadata(metadata: dict[str, Any] | None) -> dict[str, Any]:
    redacted = {}
    for key, value in (metadata or {}).items():
        if key.lower() in SENSITIVE_METADATA_KEYS:
            redacted[key] = "[redacted]"
        else:
            redacted[key] = value
    return redacted


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


def _event_hash(**payload) -> str:
    return hashlib.sha256(_canonical_event_payload(**payload)).hexdigest()


def _security_event_hash_columns_available(db) -> bool:
    try:
        columns = {row["name"] for row in db.execute("PRAGMA table_info(security_events)").fetchall()}
        return {"previous_hash", "event_hash"}.issubset(columns)
    except Exception:
        return False


def _previous_security_event_hash(db, household_id: str | None) -> str | None:
    if household_id:
        row = db.execute(
            """
            SELECT event_hash FROM security_events
            WHERE household_id=? AND event_hash IS NOT NULL
            ORDER BY rowid DESC
            LIMIT 1
            """,
            (household_id,),
        ).fetchone()
    else:
        row = db.execute(
            """
            SELECT event_hash FROM security_events
            WHERE household_id IS NULL AND event_hash IS NOT NULL
            ORDER BY rowid DESC
            LIMIT 1
            """
        ).fetchone()
    return row["event_hash"] if row else None


def verify_security_event_chain(db, household_id: str | None = None) -> dict:
    if not _security_event_hash_columns_available(db):
        return {"ok": False, "status": "hash_columns_missing", "checked": 0}
    if household_id:
        rows = db.execute(
            """
            SELECT id, household_id, organization_id, user_id, event_type, severity, source, metadata, created_at, previous_hash, event_hash
            FROM security_events
            WHERE household_id=?
            ORDER BY rowid ASC
            """,
            (household_id,),
        ).fetchall()
    else:
        rows = db.execute(
            """
            SELECT id, household_id, organization_id, user_id, event_type, severity, source, metadata, created_at, previous_hash, event_hash
            FROM security_events
            WHERE household_id IS NULL
            ORDER BY rowid ASC
            """
        ).fetchall()
    previous_hash = None
    for index, row in enumerate(rows):
        metadata = json.loads(row["metadata"] or "{}")
        expected_hash = _event_hash(
            event_id=row["id"],
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
        if row["previous_hash"] != previous_hash or row["event_hash"] != expected_hash:
            return {"ok": False, "status": "tampered", "checked": index, "event_id": row["id"]}
        previous_hash = row["event_hash"]
    return {"ok": True, "status": "ok", "checked": len(rows)}


def _dispatch_security_alert(payload: dict[str, Any]) -> None:
    url = _alert_webhook_url()
    if not url:
        return
    body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "VantDomus-SecurityEvents/1.0",
    }
    signing_secret = os.getenv("VANTDOMUS_SECURITY_ALERT_SIGNING_SECRET", "").strip()
    if signing_secret:
        signature = hmac.new(signing_secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
        headers["X-VantDomus-Signature"] = f"sha256={signature}"
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=_alert_timeout_seconds()) as resp:
            resp.read()
    except Exception:
        # Alert delivery is best-effort; the original security event remains persisted.
        return


def write_security_event(
    db,
    *,
    event_type: str,
    severity: str,
    source: str,
    household_id: str | None = None,
    organization_id: str | None = None,
    user_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    commit: bool = False,
) -> str:
    event_id = str(uuid.uuid4())
    metadata = _redact_metadata(metadata)
    created_at = now_iso()
    if household_id and not organization_id:
        row = db.execute("SELECT organization_id FROM households WHERE id=?", (household_id,)).fetchone()
        organization_id = row["organization_id"] if row else None
    metadata_json = json.dumps(metadata, ensure_ascii=False, default=str)
    previous_hash = None
    event_hash = None
    has_hash_chain = _security_event_hash_columns_available(db)
    if has_hash_chain:
        previous_hash = _previous_security_event_hash(db, household_id)
        event_hash = _event_hash(
            event_id=event_id,
            household_id=household_id,
            organization_id=organization_id,
            user_id=user_id,
            event_type=event_type,
            severity=severity,
            source=source,
            metadata=metadata,
            created_at=created_at,
            previous_hash=previous_hash,
        )
        db.execute(
            """
            INSERT INTO security_events (
              id, household_id, organization_id, user_id, event_type, severity, source, metadata, created_at, previous_hash, event_hash
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_id,
                household_id,
                organization_id,
                user_id,
                event_type,
                severity,
                source,
                metadata_json,
                created_at,
                previous_hash,
                event_hash,
            ),
        )
    else:
        db.execute(
            """
            INSERT INTO security_events (
              id, household_id, organization_id, user_id, event_type, severity, source, metadata, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_id,
                household_id,
                organization_id,
                user_id,
                event_type,
                severity,
                source,
                metadata_json,
                created_at,
            ),
        )
    if commit:
        db.commit()
    if _should_alert(severity):
        _dispatch_security_alert(
            {
                "id": event_id,
                "event_type": event_type,
                "severity": severity,
                "source": source,
                "household_id": household_id,
                "organization_id": organization_id,
                "user_id": user_id,
                "metadata": metadata,
                "created_at": created_at,
                "previous_hash": previous_hash,
                "event_hash": event_hash,
            }
        )
    return event_id
