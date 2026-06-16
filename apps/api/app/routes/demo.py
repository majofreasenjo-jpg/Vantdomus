import json
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..deps import get_current_user, get_db, require_household_role, require_operational_feature_enabled
from ..tenancy import get_household_organization_id

router = APIRouter(prefix="/demo", tags=["Demo"])


def now():
    return datetime.now(timezone.utc).isoformat()


@router.post("/seed")
def seed(household_id: str, mode: str = "home", user=Depends(get_current_user), db=Depends(get_db)):
    require_operational_feature_enabled("Demo seed", "VANTDOMUS_ALLOW_DEMO_SEED")
    if mode not in ("home", "team"):
        raise HTTPException(status_code=400, detail="mode must be home|team")
    require_household_role(db, user["user_id"], household_id, "owner")
    organization_id = get_household_organization_id(db, household_id)

    row = db.execute("SELECT meta FROM households WHERE id=?", (household_id,)).fetchone()
    meta = {}
    if row and row["meta"]:
        try:
            meta = json.loads(row["meta"])
        except Exception:
            meta = {}
    meta["mode"] = mode
    meta.setdefault("monthly_budget", 1200)
    db.execute("UPDATE households SET meta=? WHERE id=?", (json.dumps(meta), household_id))

    pid1 = str(uuid.uuid4())
    pid2 = str(uuid.uuid4())
    ts = now()
    db.execute(
        "INSERT OR IGNORE INTO persons (id, household_id, organization_id, display_name, relation, created_at) VALUES (?,?,?,?,?,?)",
        (pid1, household_id, organization_id, "Pedro Perez", "Padre" if mode == "home" else "Operaciones", ts),
    )
    db.execute(
        "INSERT OR IGNORE INTO persons (id, household_id, organization_id, display_name, relation, created_at) VALUES (?,?,?,?,?,?)",
        (pid2, household_id, organization_id, "Camila Soto", "Madre" if mode == "home" else "Finanzas", ts),
    )

    times = ["08:00", "20:00"]
    db.execute(
        """
        INSERT INTO adherence_plans (household_id, person_id, med_name, reminder_times, verification_mode, updated_at)
        VALUES (?,?,?,?,?,?)
        ON CONFLICT(household_id, person_id, med_name) DO UPDATE SET
          reminder_times=excluded.reminder_times,
          verification_mode=excluded.verification_mode,
          updated_at=excluded.updated_at
        """,
        (household_id, pid1, "Losartan", json.dumps(times), "tap", ts),
    )

    ev_plan = str(uuid.uuid4())
    plan_payload = json.dumps({"medication": {"name": "Losartan"}, "adherence_plan": {"reminder_times": times, "verification_mode": "tap"}})
    db.execute(
        "INSERT INTO events (id, household_id, organization_id, domain, event_type, occurred_at, summary, payload, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        (ev_plan, household_id, organization_id, "health", "adherence_plan_set", ts, "Plan adherencia set: Losartan", plan_payload, ts),
    )
    db.execute("INSERT OR IGNORE INTO event_actors (event_id, person_id, role) VALUES (?,?,?)", (ev_plan, pid1, "patient"))

    for delta in (60, 10):
        ev = str(uuid.uuid4())
        event_time = (datetime.now(timezone.utc) - timedelta(minutes=delta)).isoformat()
        payload = json.dumps({"medication": {"name": "Losartan"}, "checkin": {"status": "missed", "timestamp": event_time}})
        db.execute(
            "INSERT INTO events (id, household_id, organization_id, domain, event_type, occurred_at, summary, payload, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (ev, household_id, organization_id, "health", "medication_checkin", event_time, "Check-in Losartan: missed", payload, event_time),
        )
        db.execute("INSERT OR IGNORE INTO event_actors (event_id, person_id, role) VALUES (?,?,?)", (ev, pid1, "patient"))

    db.execute(
        """
        INSERT OR REPLACE INTO medication_state (household_id, person_id, med_name, consecutive_missed, last_status, last_checkin_at)
        VALUES (?,?,?,?,?,?)
        """,
        (household_id, pid1, "Losartan", 2, "missed", ts),
    )

    db.execute(
        "INSERT INTO alerts (id, household_id, organization_id, severity, event_id, title, message, status, dedupe_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (str(uuid.uuid4()), household_id, organization_id, "high", None, "Riesgo de no adherencia: Losartan", "Detectadas 2 dosis omitidas consecutivas.", "open", None, ts),
    )

    db.execute(
        "INSERT OR IGNORE INTO task_items (id, household_id, organization_id, title, status, due_at, assigned_person_id, priority, tags, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (str(uuid.uuid4()), household_id, organization_id, "Pagar cuentas (luz/agua)", "open", (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(), pid2, "high", json.dumps(["critical"]), ts, ts),
    )
    db.execute(
        "INSERT OR IGNORE INTO task_items (id, household_id, organization_id, title, status, due_at, assigned_person_id, priority, tags, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (str(uuid.uuid4()), household_id, organization_id, "Revisar botiquin / stock", "done", (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(), pid1, "medium", json.dumps(["routine"]), ts, ts),
    )

    db.execute(
        "INSERT OR IGNORE INTO expenses (id, household_id, organization_id, amount, currency, category, merchant, expense_at, notes, person_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (str(uuid.uuid4()), household_id, organization_id, 45.0, "USD", "pharmacy", "Farmacia Central", (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(), "Losartan", pid1, ts),
    )
    db.execute(
        "INSERT OR IGNORE INTO expenses (id, household_id, organization_id, amount, currency, category, merchant, expense_at, notes, person_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (str(uuid.uuid4()), household_id, organization_id, 320.0, "USD", "utilities", "Energia", (datetime.now(timezone.utc) - timedelta(days=5)).isoformat(), "Cuenta luz", pid2, ts),
    )

    db.commit()
    return {"ok": True, "mode": mode, "persons": [{"id": pid1, "name": "Pedro Perez"}, {"id": pid2, "name": "Camila Soto"}]}
