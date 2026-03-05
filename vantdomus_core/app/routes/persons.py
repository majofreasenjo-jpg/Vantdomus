import uuid, json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from ..deps import get_db, get_current_user, require_household_role

router = APIRouter(prefix="/persons", tags=["Persons"])

def now():
    return datetime.now(timezone.utc).isoformat()

@router.post("")
def create_person(household_id: str, display_name: str, relation: str = "", user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "member")
    pid = str(uuid.uuid4())
    db.execute("INSERT INTO persons (id, household_id, display_name, relation, created_at) VALUES (?,?,?,?,?)",
               (pid, household_id, display_name, relation, now()))
    db.commit()
    return {"id": pid}

@router.get("/{person_id}/health-timeline")
def health_timeline(person_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    p = db.execute("SELECT id, household_id, display_name FROM persons WHERE id=?", (person_id,)).fetchone()
    if not p:
        raise HTTPException(status_code=404, detail="Person not found")
    household_id = p["household_id"]
    require_household_role(db, user["user_id"], household_id, "viewer")

    rows = db.execute("""
      SELECT e.id, e.event_type, e.summary, e.occurred_at, e.payload
      FROM events e
      JOIN event_actors ea ON ea.event_id=e.id
      WHERE e.household_id=? AND e.domain='health' AND ea.person_id=?
      ORDER BY e.occurred_at DESC
      LIMIT 200
    """, (household_id, person_id)).fetchall()

    return {
        "person": {"id": p["id"], "display_name": p["display_name"], "household_id": household_id},
        "items": [{"id": r["id"], "event_type": r["event_type"], "summary": r["summary"], "occurred_at": r["occurred_at"], "payload": json.loads(r["payload"] or "{}")} for r in rows]
    }
