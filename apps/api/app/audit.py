import json
import uuid
from datetime import datetime, timezone
from typing import Any


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_json(value: dict[str, Any] | None) -> str:
    return json.dumps(value or {}, ensure_ascii=False, default=str)


def write_audit_log(
    db,
    *,
    action: str,
    resource_type: str,
    household_id: str | None = None,
    user_id: str | None = None,
    resource_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    organization_id: str | None = None,
    commit: bool = False,
) -> str:
    audit_id = str(uuid.uuid4())
    if not organization_id and household_id:
        row = db.execute("SELECT organization_id FROM households WHERE id=?", (household_id,)).fetchone()
        organization_id = row["organization_id"] if row else None
    db.execute(
        """
        INSERT INTO audit_log (id, household_id, organization_id, user_id, action, resource_type, resource_id, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (audit_id, household_id, organization_id, user_id, action, resource_type, resource_id, _safe_json(metadata), utcnow_iso()),
    )
    if commit:
        db.commit()
    return audit_id


def write_assistant_action_log(
    db,
    *,
    household_id: str,
    tool_name: str,
    arguments: dict[str, Any] | None = None,
    result: str = "",
    user_id: str | None = None,
    organization_id: str | None = None,
    status: str = "unknown",
    commit: bool = False,
) -> str:
    log_id = str(uuid.uuid4())
    if not organization_id:
        row = db.execute("SELECT organization_id FROM households WHERE id=?", (household_id,)).fetchone()
        organization_id = row["organization_id"] if row else None
    db.execute(
        """
        INSERT INTO assistant_action_log (id, household_id, organization_id, user_id, tool_name, arguments, result, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (log_id, household_id, organization_id, user_id, tool_name, _safe_json(arguments), result[:4000], status, utcnow_iso()),
    )
    if commit:
        db.commit()
    return log_id
