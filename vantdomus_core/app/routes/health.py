import uuid, json, hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from ..deps import get_db, get_current_user, require_household_role

router = APIRouter(prefix="/health", tags=["Health"])

def now():
    return datetime.now(timezone.utc).isoformat()

def _dedupe(hid: str, pid: str, med: str):
    raw = f"{hid}:{pid}:{med}:nonadherence"
    return "alert:health:" + hashlib.sha256(raw.encode()).hexdigest()[:18]

@router.post("/adherence/set")
def set_plan(household_id: str, person_id: str, med_name: str, reminder_times: str, verification_mode: str="none",
             user=Depends(get_current_user), db=Depends(get_db)):
    if verification_mode not in ("none","tap","voice"):
        raise HTTPException(status_code=400, detail="verification_mode must be none|tap|voice")
    require_household_role(db, user["user_id"], household_id, "member")
    times = [t.strip() for t in reminder_times.split(",") if t.strip()]
    if not times:
        raise HTTPException(status_code=400, detail="reminder_times required")

    db.execute("""
      INSERT INTO adherence_plans (household_id, person_id, med_name, reminder_times, verification_mode, updated_at)
      VALUES (?,?,?,?,?,?)
      ON CONFLICT(household_id, person_id, med_name) DO UPDATE SET
        reminder_times=excluded.reminder_times,
        verification_mode=excluded.verification_mode,
        updated_at=excluded.updated_at
    """, (household_id, person_id, med_name, json.dumps(times), verification_mode, now()))

    ev_id = str(uuid.uuid4())
    payload = json.dumps({"medication":{"name":med_name},"adherence_plan":{"reminder_times":times,"verification_mode":verification_mode}})
    db.execute("INSERT INTO events (id,household_id,domain,event_type,occurred_at,summary,payload,created_at) VALUES (?,?,?,?,?,?,?,?)",
               (ev_id, household_id, "health", "adherence_plan_set", now(), f"Plan adherencia set: {med_name}", payload, now()))
    db.execute("INSERT OR IGNORE INTO event_actors (event_id, person_id, role) VALUES (?,?,?)", (ev_id, person_id, "patient"))
    db.commit()
    return {"ok": True, "event_id": ev_id, "reminder_times": times}

@router.get("/adherence/get")
def get_plan(household_id: str, person_id: str, med_name: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "viewer")
    row = db.execute("SELECT reminder_times, verification_mode, updated_at FROM adherence_plans WHERE household_id=? AND person_id=? AND med_name=?",
                     (household_id, person_id, med_name)).fetchone()
    if not row:
        return {"exists": False}
    return {"exists": True, "reminder_times": json.loads(row["reminder_times"] or "[]"), "verification_mode": row["verification_mode"], "updated_at": row["updated_at"]}

@router.post("/checkin")
def checkin(household_id: str, person_id: str, med_name: str, status: str, user=Depends(get_current_user), db=Depends(get_db)):
    if status not in ("taken","missed"):
        raise HTTPException(status_code=400, detail="status must be taken|missed")
    require_household_role(db, user["user_id"], household_id, "member")

    ts = now()
    ev_id = str(uuid.uuid4())
    payload = json.dumps({"medication":{"name":med_name},"checkin":{"status":status,"timestamp":ts}})
    db.execute("INSERT INTO events (id,household_id,domain,event_type,occurred_at,summary,payload,created_at) VALUES (?,?,?,?,?,?,?,?)",
               (ev_id, household_id, "health", "medication_checkin", ts, f"Check-in {med_name}: {status}", payload, ts))
    db.execute("INSERT OR IGNORE INTO event_actors (event_id, person_id, role) VALUES (?,?,?)", (ev_id, person_id, "patient"))

    st = db.execute("SELECT consecutive_missed FROM medication_state WHERE household_id=? AND person_id=? AND med_name=?",
                    (household_id, person_id, med_name)).fetchone()
    prev = int(st["consecutive_missed"]) if st else 0
    new = prev + 1 if status == "missed" else 0

    if st:
        db.execute("UPDATE medication_state SET consecutive_missed=?, last_status=?, last_checkin_at=? WHERE household_id=? AND person_id=? AND med_name=?",
                   (new, status, ts, household_id, person_id, med_name))
    else:
        db.execute("INSERT INTO medication_state (household_id,person_id,med_name,consecutive_missed,last_status,last_checkin_at) VALUES (?,?,?,?,?,?)",
                   (household_id, person_id, med_name, new, status, ts))

    alert_created = False
    if new >= 2:
        dk = _dedupe(household_id, person_id, med_name)
        db.execute("""
          INSERT OR IGNORE INTO alerts (id,household_id,severity,event_id,title,message,status,dedupe_key,created_at)
          VALUES (?,?,?,?,?,?,?,?,?)
        """, (str(uuid.uuid4()), household_id, "high", ev_id, f"Riesgo de no adherencia: {med_name}",
                f"Detectadas {new} dosis omitidas consecutivas.", "open", dk, ts))
        alert_created = True

    db.commit()
    return {"event_id": ev_id, "consecutive_missed": new, "alert_created": alert_created}
