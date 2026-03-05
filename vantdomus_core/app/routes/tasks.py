import uuid, json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from ..deps import get_db, get_current_user, require_household_role

router = APIRouter(prefix="/tasks", tags=["Tasks"])

def now():
    return datetime.now(timezone.utc).isoformat()

@router.post("")
def create_task(household_id: str, title: str, due_date: str|None=None, assigned_person_id: str|None=None,
                priority: str="medium", tags: str="", user=Depends(get_current_user), db=Depends(get_db)):
    if priority not in ("low","medium","high"):
        raise HTTPException(status_code=400, detail="priority must be low|medium|high")
    require_household_role(db, user["user_id"], household_id, "member")
    due_at = f"{due_date}T23:59:59+00:00" if due_date else None
    tag_list = [t.strip() for t in (tags or "").split(",") if t.strip()]
    tid = str(uuid.uuid4())
    ts = now()
    db.execute("""
      INSERT INTO task_items (id,household_id,title,status,due_at,assigned_person_id,priority,tags,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    """, (tid, household_id, title, "open", due_at, assigned_person_id, priority, json.dumps(tag_list), ts, ts))
    db.commit()
    return {"id": tid}

@router.get("")
def list_tasks(household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "viewer")
    rows = db.execute("""
      SELECT id,title,status,due_at,assigned_person_id,priority,tags,created_at,updated_at
      FROM task_items
      WHERE household_id=?
      ORDER BY created_at DESC
      LIMIT 200
    """, (household_id,)).fetchall()
    items = []
    for r in rows:
        items.append({
            "id": r["id"], "title": r["title"], "status": r["status"], "due_at": r["due_at"],
            "assigned_person_id": r["assigned_person_id"], "priority": r["priority"],
            "tags": json.loads(r["tags"] or "[]"),
            "created_at": r["created_at"], "updated_at": r["updated_at"],
        })
    return {"items": items}

@router.post("/{task_id}/done")
def mark_done(task_id: str, household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "member")
    row = db.execute("SELECT id FROM task_items WHERE id=? AND household_id=?", (task_id, household_id)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    ts = now()
    db.execute("UPDATE task_items SET status='done', updated_at=? WHERE id=?", (ts, task_id))
    db.commit()
    return {"ok": True}
