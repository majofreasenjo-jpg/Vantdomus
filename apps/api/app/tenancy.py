import uuid
from datetime import datetime, timezone


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_user_default_organization(db, user_id: str, name: str | None = None) -> str:
    row = db.execute(
        """
        SELECT o.id
        FROM organizations o
        JOIN organization_memberships m ON m.organization_id=o.id
        WHERE m.user_id=?
        ORDER BY o.created_at ASC
        LIMIT 1
        """,
        (user_id,),
    ).fetchone()
    if row:
        return row["id"]

    organization_id = str(uuid.uuid4())
    created_at = utcnow_iso()
    db.execute(
        "INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)",
        (organization_id, name or "Default Organization", created_at),
    )
    db.execute(
        "INSERT INTO organization_memberships (organization_id, user_id, role, created_at) VALUES (?, ?, ?, ?)",
        (organization_id, user_id, "owner", created_at),
    )
    return organization_id


def ensure_household_organization(db, household_id: str, user_id: str) -> str:
    row = db.execute("SELECT organization_id FROM households WHERE id=?", (household_id,)).fetchone()
    if row and row["organization_id"]:
        return row["organization_id"]

    organization_id = ensure_user_default_organization(db, user_id)
    db.execute("UPDATE households SET organization_id=? WHERE id=?", (organization_id, household_id))
    return organization_id


def get_household_organization_id(db, household_id: str) -> str | None:
    row = db.execute("SELECT organization_id FROM households WHERE id=?", (household_id,)).fetchone()
    if not row:
        return None
    return row["organization_id"]


def backfill_user_households(db, user_id: str) -> str:
    organization_id = ensure_user_default_organization(db, user_id)
    rows = db.execute(
        """
        SELECT h.id
        FROM households h
        JOIN household_memberships m ON m.household_id=h.id
        WHERE m.user_id=? AND (h.organization_id IS NULL OR h.organization_id='')
        """,
        (user_id,),
    ).fetchall()
    for row in rows:
        db.execute("UPDATE households SET organization_id=? WHERE id=?", (organization_id, row["id"]))
    return organization_id


def backfill_tenant_columns(db) -> None:
    tables = [
        "persons",
        "events",
        "alerts",
        "task_items",
        "expenses",
        "features_daily",
        "state_snapshot",
        "logbook_entries",
        "audit_log",
        "assistant_action_log",
        "coupling_gateways",
    ]
    for table in tables:
        try:
            db.execute(
                f"""
                UPDATE {table}
                SET organization_id = (
                  SELECT organization_id FROM households WHERE households.id = {table}.household_id
                )
                WHERE organization_id IS NULL OR organization_id = ''
                """
            )
        except Exception:
            pass
