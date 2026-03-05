from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone
import json

from app.db import get_conn, fetch_one, fetch_all, execute
from app.security import hash_password, verify_password, create_access_token, decode_access_token
from app.schemas import RegisterRequest, LoginRequest, HouseholdCreate, PersonCreate, CheckinRequest, AdherenceSetRequest
from app.rbac import require_role

app = FastAPI(title="VantDomus Core API", version="0.2.0")
bearer = HTTPBearer(auto_error=False)

def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    if not creds:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    try:
        p = decode_access_token(creds.credentials)
        return {"user_id": p["sub"], "email": p.get("email")}
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

@app.get("/health")
def health():
    return {"ok": True}

# --- Auth ---
@app.post("/auth/register")
def register(req: RegisterRequest):
    with get_conn() as conn:
        if fetch_one(conn, "SELECT 1 FROM users WHERE email=%s", (req.email,)):
            raise HTTPException(status_code=400, detail="Email exists")
        uid = fetch_one(conn, "INSERT INTO users (email, password_hash) VALUES (%s,%s) RETURNING id",
                        (req.email, hash_password(req.password)))[0]
        return {"user_id": str(uid)}

@app.post("/auth/login")
def login(req: LoginRequest):
    with get_conn() as conn:
        row = fetch_one(conn, "SELECT id, password_hash FROM users WHERE email=%s", (req.email,))
        if not row or not verify_password(req.password, row[1]):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        token = create_access_token(sub=str(row[0]), email=req.email)
        return {"access_token": token, "token_type": "bearer"}

# --- Households ---
@app.post("/households")
def create_household(req: HouseholdCreate, user=Depends(current_user)):
    with get_conn() as conn:
        hid = fetch_one(conn, "INSERT INTO households (name) VALUES (%s) RETURNING id", (req.name,))[0]
        execute(conn, "INSERT INTO household_memberships (household_id, user_id, role) VALUES (%s,%s,'owner')",
                (hid, user["user_id"]))
        return {"id": str(hid)}

@app.get("/households/{household_id}/dashboard")
def dashboard(household_id: str, user=Depends(current_user)):
    with get_conn() as conn:
        require_role(conn, user["user_id"], household_id, "viewer")
        h = fetch_one(conn, "SELECT id, name, created_at FROM households WHERE id=%s", (household_id,))
        if not h:
            raise HTTPException(status_code=404, detail="Household not found")
        persons = fetch_all(conn, "SELECT id, display_name, relation FROM persons WHERE household_id=%s ORDER BY display_name", (household_id,))
        events = fetch_all(conn, "SELECT id, domain, event_type, summary, occurred_at FROM events WHERE household_id=%s ORDER BY occurred_at DESC LIMIT 50", (household_id,))
        alerts = fetch_all(conn, "SELECT id, severity, title, message, status, event_id, created_at FROM alerts WHERE household_id=%s ORDER BY created_at DESC LIMIT 50", (household_id,))
        tasks = fetch_all(conn, "SELECT id, type, status, event_id, subject_person_id, created_at FROM tasks WHERE household_id=%s ORDER BY created_at DESC LIMIT 50", (household_id,))
        return {
          "household": {"id": str(h[0]), "name": h[1], "created_at": h[2].isoformat()},
          "persons": [{"id": str(p[0]), "display_name": p[1], "relation": p[2]} for p in persons],
          "recent_events": [{"id": str(e[0]), "domain": e[1], "event_type": e[2], "summary": e[3], "occurred_at": e[4].isoformat()} for e in events],
          "alerts": [{"id": str(a[0]), "severity": a[1], "title": a[2], "message": a[3], "status": a[4], "event_id": str(a[5]) if a[5] else None, "created_at": a[6].isoformat()} for a in alerts],
          "tasks": [{"id": str(t[0]), "type": t[1], "status": t[2], "event_id": str(t[3]) if t[3] else None, "subject_person_id": str(t[4]) if t[4] else None, "created_at": t[5].isoformat()} for t in tasks],
        }

# --- Persons ---
@app.post("/persons")
def create_person(req: PersonCreate, user=Depends(current_user)):
    with get_conn() as conn:
        require_role(conn, user["user_id"], req.household_id, "member")
        pid = fetch_one(conn, "INSERT INTO persons (household_id, display_name, relation) VALUES (%s,%s,%s) RETURNING id",
                        (req.household_id, req.display_name, req.relation))[0]
        return {"id": str(pid)}

@app.get("/persons/{person_id}/health-timeline")
def health_timeline(person_id: str, user=Depends(current_user)):
    with get_conn() as conn:
        p = fetch_one(conn, "SELECT household_id, display_name FROM persons WHERE id=%s", (person_id,))
        if not p:
            raise HTTPException(status_code=404, detail="Person not found")
        household_id = str(p[0])
        require_role(conn, user["user_id"], household_id, "viewer")
        rows = fetch_all(conn,
          "SELECT e.id, e.event_type, e.summary, e.occurred_at, e.payload "
          "FROM events e JOIN event_actors ea ON ea.event_id=e.id "
          "WHERE ea.person_id=%s AND e.domain='health' "
          "ORDER BY e.occurred_at DESC LIMIT 200",
          (person_id,)
        )
        return {"person": {"id": person_id, "display_name": p[1], "household_id": household_id},
                "items": [{"id": str(r[0]), "event_type": r[1], "summary": r[2], "occurred_at": r[3].isoformat(), "payload": r[4]} for r in rows]}

# --- Health: check-in (alert if 2 missed) ---
@app.post("/health/checkin")
def checkin(req: CheckinRequest, user=Depends(current_user)):
    now = datetime.now(timezone.utc)
    with get_conn() as conn:
        require_role(conn, user["user_id"], req.household_id, "member")

        payload = {"medication": {"name": req.med_name}, "checkin": {"status": req.status, "timestamp": now.isoformat()}}
        ev_id = fetch_one(conn,
          "INSERT INTO events (household_id, domain, event_type, occurred_at, summary, payload) "
          "VALUES (%s,'health','medication_checkin',%s,%s,%s::jsonb) RETURNING id",
          (req.household_id, now, f"Check-in {req.med_name}: {req.status}", json.dumps(payload))
        )[0]
        execute(conn, "INSERT INTO event_actors (event_id, person_id, role) VALUES (%s,%s,'patient') ON CONFLICT DO NOTHING", (ev_id, req.person_id))

        st = fetch_one(conn, "SELECT consecutive_missed FROM medication_state WHERE household_id=%s AND person_id=%s AND med_name=%s",
                       (req.household_id, req.person_id, req.med_name))
        prev = int(st[0]) if st else 0
        new = prev + 1 if req.status == "missed" else 0

        if st:
            execute(conn, "UPDATE medication_state SET consecutive_missed=%s, last_status=%s, last_checkin_at=%s WHERE household_id=%s AND person_id=%s AND med_name=%s",
                    (new, req.status, now, req.household_id, req.person_id, req.med_name))
        else:
            execute(conn, "INSERT INTO medication_state (household_id, person_id, med_name, consecutive_missed, last_status, last_checkin_at) VALUES (%s,%s,%s,%s,%s,%s)",
                    (req.household_id, req.person_id, req.med_name, new, req.status, now))

        alert_created = False
        if new >= 2:
            execute(conn,
                "INSERT INTO alerts (household_id, severity, event_id, title, message, status) "
                "VALUES (%s,'medium',%s,%s,%s,'open')",
                (req.household_id, ev_id, f"Riesgo de no adherencia: {req.med_name}", f"Detectadas {new} dosis omitidas consecutivas.")
            )
            alert_created = True

        return {"event_id": str(ev_id), "consecutive_missed": new, "alert_created": alert_created}

# --- Health: adherence plan ---
@app.post("/health/adherence/set")
def set_plan(req: AdherenceSetRequest, user=Depends(current_user)):
    now = datetime.now(timezone.utc)
    with get_conn() as conn:
        require_role(conn, user["user_id"], req.household_id, "member")
        execute(conn,
          "INSERT INTO adherence_plans (household_id, person_id, med_name, reminder_times, verification_mode, updated_at) "
          "VALUES (%s,%s,%s,%s::jsonb,%s,%s) "
          "ON CONFLICT (household_id, person_id, med_name) "
          "DO UPDATE SET reminder_times=EXCLUDED.reminder_times, verification_mode=EXCLUDED.verification_mode, updated_at=EXCLUDED.updated_at",
          (req.household_id, req.person_id, req.med_name, json.dumps(req.reminder_times), req.verification_mode, now)
        )

        payload = {"medication": {"name": req.med_name}, "adherence_plan": {"reminder_times": req.reminder_times, "verification_mode": req.verification_mode}}
        ev_id = fetch_one(conn,
          "INSERT INTO events (household_id, domain, event_type, occurred_at, summary, payload) "
          "VALUES (%s,'health','adherence_plan_set',%s,%s,%s::jsonb) RETURNING id",
          (req.household_id, now, f"Plan adherencia set: {req.med_name}", json.dumps(payload))
        )[0]
        execute(conn, "INSERT INTO event_actors (event_id, person_id, role) VALUES (%s,%s,'patient') ON CONFLICT DO NOTHING", (ev_id, req.person_id))
        return {"ok": True, "event_id": str(ev_id)}

@app.get("/health/adherence/get")
def get_plan(household_id: str, person_id: str, med_name: str, user=Depends(current_user)):
    with get_conn() as conn:
        require_role(conn, user["user_id"], household_id, "viewer")
        row = fetch_one(conn, "SELECT reminder_times, verification_mode, updated_at FROM adherence_plans WHERE household_id=%s AND person_id=%s AND med_name=%s",
                        (household_id, person_id, med_name))
        if not row:
            return {"exists": False}
        return {"exists": True, "reminder_times": row[0], "verification_mode": row[1], "updated_at": row[2].isoformat()}
