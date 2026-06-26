import uuid, json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from ..deps import get_db, get_current_user, require_household_role
from ..tenancy import get_household_organization_id

router = APIRouter(prefix="/persons", tags=["Persons"])

def now():
    return datetime.now(timezone.utc).isoformat()


class PersonPatch(BaseModel):
    display_name: str | None = None
    relation: str | None = None
    avatar: str | None = None  # "emoji:🐻" | "data:image/...;base64,..." | "" para limpiar


class StatusSet(BaseModel):
    emoji: str | None = None
    text: str | None = None


# Límite defensivo para fotos en data-url (demo local, SQLite). ~700KB de base64.
MAX_AVATAR_LEN = 700_000

@router.post("")
def create_person(household_id: str, display_name: str, relation: str = "", user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "member")
    pid = str(uuid.uuid4())
    organization_id = get_household_organization_id(db, household_id)
    db.execute("INSERT INTO persons (id, household_id, organization_id, display_name, relation, created_at) VALUES (?,?,?,?,?,?)",
               (pid, household_id, organization_id, display_name, relation, now()))
    db.commit()
    return {"id": pid}


@router.get("/{person_id}")
def get_person(person_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    p = db.execute(
        "SELECT id, household_id, display_name, relation, created_at, avatar, status_emoji, status_text, status_set_at FROM persons WHERE id=?",
        (person_id,),
    ).fetchone()
    if not p:
        raise HTTPException(status_code=404, detail="Person not found")
    require_household_role(db, user["user_id"], p["household_id"], "viewer")
    return {
        "id": p["id"],
        "household_id": p["household_id"],
        "display_name": p["display_name"],
        "relation": p["relation"],
        "created_at": p["created_at"],
        "avatar": p["avatar"],
        "status_emoji": p["status_emoji"],
        "status_text": p["status_text"],
        "status_set_at": p["status_set_at"],
    }


@router.patch("/{person_id}")
def update_person(person_id: str, patch: PersonPatch, user=Depends(get_current_user), db=Depends(get_db)):
    p = db.execute("SELECT id, household_id FROM persons WHERE id=?", (person_id,)).fetchone()
    if not p:
        raise HTTPException(status_code=404, detail="Person not found")
    require_household_role(db, user["user_id"], p["household_id"], "member")
    sets, params = [], []
    if patch.display_name is not None:
        sets.append("display_name=?"); params.append(patch.display_name.strip())
    if patch.relation is not None:
        sets.append("relation=?"); params.append(patch.relation.strip())
    if patch.avatar is not None:
        av = patch.avatar.strip()
        if len(av) > MAX_AVATAR_LEN:
            raise HTTPException(status_code=413, detail="Avatar demasiado grande. Usá una foto más liviana.")
        sets.append("avatar=?"); params.append(av or None)
    if not sets:
        return {"ok": True, "unchanged": True}
    params.append(person_id)
    db.execute(f"UPDATE persons SET {', '.join(sets)} WHERE id=?", params)
    db.commit()
    return {"ok": True}


@router.put("/{person_id}/status")
def set_status(person_id: str, body: StatusSet, user=Depends(get_current_user), db=Depends(get_db)):
    p = db.execute("SELECT id, household_id FROM persons WHERE id=?", (person_id,)).fetchone()
    if not p:
        raise HTTPException(status_code=404, detail="Person not found")
    require_household_role(db, user["user_id"], p["household_id"], "member")
    emoji = (body.emoji or "").strip()[:8] or None
    text = (body.text or "").strip()[:120] or None
    db.execute(
        "UPDATE persons SET status_emoji=?, status_text=?, status_set_at=? WHERE id=?",
        (emoji, text, now(), person_id),
    )
    db.commit()
    return {"ok": True, "status_emoji": emoji, "status_text": text}


@router.delete("/{person_id}/status")
def clear_status(person_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    p = db.execute("SELECT id, household_id FROM persons WHERE id=?", (person_id,)).fetchone()
    if not p:
        raise HTTPException(status_code=404, detail="Person not found")
    require_household_role(db, user["user_id"], p["household_id"], "member")
    db.execute(
        "UPDATE persons SET status_emoji=NULL, status_text=NULL, status_set_at=NULL WHERE id=?",
        (person_id,),
    )
    db.commit()
    return {"ok": True}


@router.get("/{person_id}/health-timeline")
def health_timeline(person_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    p = db.execute("SELECT id, household_id, display_name FROM persons WHERE id=?", (person_id,)).fetchone()
    if not p:
        raise HTTPException(status_code=404, detail="Person not found")
    household_id = p["household_id"]
    from ..rbac import require_module_visible
    require_module_visible(db, user["user_id"], household_id, "health")

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
