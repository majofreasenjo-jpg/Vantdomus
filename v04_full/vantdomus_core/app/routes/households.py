import uuid, json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from ..deps import get_db, get_current_user, require_household_role
from ..features import compute_and_store

router = APIRouter(prefix="/households", tags=["Households"])

def now():
    return datetime.now(timezone.utc).isoformat()

@router.post("")
def create_household(name: str, user=Depends(get_current_user), db=Depends(get_db)):
    hid = str(uuid.uuid4())
    db.execute("INSERT INTO households (id,name,meta,created_at) VALUES (?,?,?,?)",
               (hid, name, json.dumps({"mode":"home","monthly_budget":0}), now()))
    db.execute("INSERT INTO household_memberships (household_id,user_id,role,created_at) VALUES (?,?,?,?)",
               (hid, user["user_id"], "owner", now()))
    db.commit()
    return {"id": hid}

@router.get("/{household_id}/dashboard")
def dashboard(household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "viewer")
    h = db.execute("SELECT id,name,meta,created_at FROM households WHERE id=?", (household_id,)).fetchone()
    if not h:
        raise HTTPException(status_code=404, detail="Household not found")

    persons = db.execute("SELECT id, display_name, relation FROM persons WHERE household_id=? ORDER BY display_name", (household_id,)).fetchall()
    alerts = db.execute("SELECT id,severity,title,message,status,created_at FROM alerts WHERE household_id=? ORDER BY created_at DESC LIMIT 50", (household_id,)).fetchall()
    events = db.execute("SELECT id,domain,event_type,summary,occurred_at FROM events WHERE household_id=? ORDER BY occurred_at DESC LIMIT 50", (household_id,)).fetchall()

    # compute scores/features (persist)
    features = compute_and_store(db, household_id)

    # assistant open recos
    recos = db.execute("""
      SELECT id, kind, title, rationale, impact, payload, created_at
      FROM assistant_recommendations
      WHERE household_id=? AND status='open'
      ORDER BY created_at DESC
      LIMIT 10
    """, (household_id,)).fetchall()
    assistant = []
    for r in recos:
        assistant.append({
            "id": r["id"], "kind": r["kind"], "title": r["title"], "rationale": r["rationale"],
            "impact": int(r["impact"]), "payload": json.loads(r["payload"] or "{}"),
            "created_at": r["created_at"],
        })

    return {
        "household": {"id": h["id"], "name": h["name"], "meta": json.loads(h["meta"] or "{}"), "created_at": h["created_at"]},
        "features": features,
        "assistant": assistant,
        "persons": [{"id": p["id"], "display_name": p["display_name"], "relation": p["relation"]} for p in persons],
        "alerts": [{"id": a["id"], "severity": a["severity"], "title": a["title"], "message": a["message"], "status": a["status"], "created_at": a["created_at"]} for a in alerts],
        "events": [{"id": e["id"], "domain": e["domain"], "event_type": e["event_type"], "summary": e["summary"], "occurred_at": e["occurred_at"]} for e in events],
    }
