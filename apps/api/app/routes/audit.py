import json
import os
from pathlib import Path

from fastapi import APIRouter, Depends

from ..deps import get_current_user, get_db, require_household_role
from ..malware import check_clamav_health
from ..rate_limit import check_redis_health
from ..security_events import verify_security_event_chain

router = APIRouter(prefix="/audit", tags=["Audit"])


def _component(ok: bool, status: str, **extra) -> dict:
    return {"ok": ok, "status": status, **extra}


def _database_status(db) -> dict:
    try:
        db.execute("SELECT 1").fetchone()
        try:
            integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
        except Exception:
            integrity = "not_applicable"
        return _component(integrity in {"ok", "not_applicable"}, "ok", integrity=integrity)
    except Exception as exc:
        return _component(False, "unavailable", detail=str(exc))


def _backup_status() -> dict:
    backup_dir = Path(os.getenv("VANTDOMUS_BACKUP_DIR", str(Path(__file__).resolve().parents[2] / "data" / "backups")))
    if not backup_dir.exists():
        return _component(False, "missing", backup_dir=str(backup_dir))
    backups = sorted(
        [path for path in backup_dir.iterdir() if path.is_file() and (path.name.endswith(".db") or path.name.endswith(".db.enc"))],
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    if not backups:
        return _component(False, "empty", backup_dir=str(backup_dir))
    latest = backups[0]
    return _component(
        True,
        "ok",
        backup_dir=str(backup_dir),
        latest_backup=latest.name,
        latest_backup_bytes=latest.stat().st_size,
        encrypted=latest.name.endswith(".enc"),
    )


@router.get("")
def list_audit_events(
    household_id: str,
    limit: int = 100,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_household_role(db, user["user_id"], household_id, "admin")
    safe_limit = max(1, min(int(limit or 100), 500))
    rows = db.execute(
        """
        SELECT a.id, a.household_id, h.organization_id, a.user_id, a.action, a.resource_type, a.resource_id, a.metadata, a.created_at
        FROM audit_log a
        LEFT JOIN households h ON h.id=a.household_id
        WHERE a.household_id=?
        ORDER BY a.created_at DESC
        LIMIT ?
        """,
        (household_id, safe_limit),
    ).fetchall()

    return {
        "items": [
            {
                "id": row["id"],
                "household_id": row["household_id"],
                "organization_id": row["organization_id"],
                "user_id": row["user_id"],
                "action": row["action"],
                "resource_type": row["resource_type"],
                "resource_id": row["resource_id"],
                "metadata": json.loads(row["metadata"] or "{}"),
                "created_at": row["created_at"],
            }
            for row in rows
        ]
    }


@router.get("/security-events")
def list_security_events(
    household_id: str,
    limit: int = 100,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_household_role(db, user["user_id"], household_id, "admin")
    safe_limit = max(1, min(int(limit or 100), 500))
    rows = db.execute(
        """
        SELECT id, household_id, organization_id, user_id, event_type, severity, source, metadata, created_at
        FROM security_events
        WHERE household_id=?
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (household_id, safe_limit),
    ).fetchall()

    return {
        "items": [
            {
                "id": row["id"],
                "household_id": row["household_id"],
                "organization_id": row["organization_id"],
                "user_id": row["user_id"],
                "event_type": row["event_type"],
                "severity": row["severity"],
                "source": row["source"],
                "metadata": json.loads(row["metadata"] or "{}"),
                "created_at": row["created_at"],
            }
            for row in rows
        ]
    }


@router.get("/operational-status")
def operational_status(
    household_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_household_role(db, user["user_id"], household_id, "admin")
    rows = db.execute(
        """
        SELECT id, event_type, severity, source, metadata, created_at
        FROM security_events
        WHERE household_id=? AND severity IN ('high', 'critical')
        ORDER BY created_at DESC
        LIMIT 10
        """,
        (household_id,),
    ).fetchall()
    components = {
        "database": _database_status(db),
        "redis": check_redis_health(),
        "clamav": check_clamav_health(),
        "backups": _backup_status(),
        "security_event_chain": verify_security_event_chain(db, household_id),
    }
    return {
        "ok": all(component.get("ok") for component in components.values()),
        "household_id": household_id,
        "components": components,
        "recent_high_severity_events": [
            {
                "id": row["id"],
                "event_type": row["event_type"],
                "severity": row["severity"],
                "source": row["source"],
                "metadata": json.loads(row["metadata"] or "{}"),
                "created_at": row["created_at"],
            }
            for row in rows
        ],
    }


@router.get("/assistant-actions")
def list_assistant_actions(
    household_id: str,
    limit: int = 100,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_household_role(db, user["user_id"], household_id, "admin")
    safe_limit = max(1, min(int(limit or 100), 500))
    rows = db.execute(
        """
        SELECT a.id, a.household_id, h.organization_id, a.user_id, a.tool_name, a.arguments, a.result, a.status, a.created_at
        FROM assistant_action_log a
        LEFT JOIN households h ON h.id=a.household_id
        WHERE a.household_id=?
        ORDER BY a.created_at DESC
        LIMIT ?
        """,
        (household_id, safe_limit),
    ).fetchall()

    return {
        "items": [
            {
                "id": row["id"],
                "household_id": row["household_id"],
                "organization_id": row["organization_id"],
                "user_id": row["user_id"],
                "tool_name": row["tool_name"],
                "arguments": json.loads(row["arguments"] or "{}"),
                "result": row["result"],
                "status": row["status"],
                "created_at": row["created_at"],
            }
            for row in rows
        ]
    }
