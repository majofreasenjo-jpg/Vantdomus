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


class ClassificationPatch(BaseModel):
    # CP1d-1b.1: SOLO el owner clasifica; jamás desde una operación básica.
    age_band: str | None = None
    minor_privacy_profile: str | None = None


# Límite defensivo para fotos en data-url (demo local, SQLite). ~700KB de base64.
MAX_AVATAR_LEN = 700_000


def _load_person(db, person_id: str):
    from ..minor_guardian_policy import get_person
    p = get_person(db, person_id)
    if not p:
        raise HTTPException(status_code=404, detail="Person not found")
    return p


def _require_basic_edit(db, user, person):
    """CP1d-1b.1: editar campos básicos = owner/admin, titular o guardián full."""
    from ..minor_guardian_policy import can_edit_person_basic
    role = require_household_role(db, user["user_id"], person["household_id"], "viewer")
    if not can_edit_person_basic(db, editor_user_id=user["user_id"], editor_role=role, person=person):
        raise HTTPException(status_code=403, detail="No puedes modificar esta ficha")
    return role


@router.post("")
def create_person(household_id: str, display_name: str, relation: str = "", user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "member")
    pid = str(uuid.uuid4())
    organization_id = get_household_organization_id(db, household_id)
    # age_band y minor_privacy_profile quedan en sus defaults FAIL-CLOSED
    # ('unclassified'/'restricted', migración 281); solo el owner clasifica.
    db.execute("INSERT INTO persons (id, household_id, organization_id, display_name, relation, created_at) VALUES (?,?,?,?,?,?)",
               (pid, household_id, organization_id, display_name, relation, now()))
    db.commit()
    return {"id": pid}


@router.get("/{person_id}")
def get_person(person_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    from ..minor_guardian_policy import person_view_level
    p = _load_person(db, person_id)
    role = require_household_role(db, user["user_id"], p["household_id"], "viewer")
    level = person_view_level(db, viewer_user_id=user["user_id"], viewer_role=role, person=p)
    if level == "minimal":
        # CP1d-1b.1: vista mínima para miembros no relacionados — sin estado
        # privado, sin banda, sin guardianes/consentimientos, sin campos internos.
        return {
            "id": p["id"],
            "display_name": p["display_name"],
            "relation": p["relation"],
            "view": "minimal",
        }
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
        "age_band": p["age_band"],
        "minor_privacy_profile": p["minor_privacy_profile"],
        "view": "full",
    }


@router.patch("/{person_id}")
def update_person(person_id: str, patch: PersonPatch, user=Depends(get_current_user), db=Depends(get_db)):
    p = _load_person(db, person_id)
    _require_basic_edit(db, user, p)
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


@router.patch("/{person_id}/classification")
def classify_person(person_id: str, patch: ClassificationPatch, user=Depends(get_current_user), db=Depends(get_db)):
    """CP1d-1b.1: SOLO el owner clasifica banda y perfil de privacidad. Auditado."""
    from ..audit import write_audit_log
    from ..minor_guardian_policy import POLICY_VERSION, validate_age_band, validate_privacy_profile
    from ..security_events import write_security_event
    p = _load_person(db, person_id)
    require_household_role(db, user["user_id"], p["household_id"], "owner")
    sets, params, changes = [], [], {}
    if patch.age_band is not None:
        band = validate_age_band(patch.age_band)
        sets.append("age_band=?"); params.append(band); changes["age_band"] = band
    if patch.minor_privacy_profile is not None:
        profile = validate_privacy_profile(patch.minor_privacy_profile)
        sets.append("minor_privacy_profile=?"); params.append(profile); changes["minor_privacy_profile"] = profile
    if not sets:
        return {"ok": True, "unchanged": True}
    params.append(person_id)
    db.execute(f"UPDATE persons SET {', '.join(sets)} WHERE id=?", params)
    write_audit_log(
        db,
        action="person_classified",
        resource_type="person",
        household_id=p["household_id"],
        user_id=user["user_id"],
        resource_id=person_id,
        metadata={**changes, "policy_version": POLICY_VERSION},
    )
    write_security_event(
        db,
        event_type="person_classified",
        severity="medium",
        source="guardians",
        household_id=p["household_id"],
        user_id=user["user_id"],
        metadata={"person_id": person_id, **changes, "policy_version": POLICY_VERSION},
    )
    db.commit()
    return {"ok": True, **changes}


@router.put("/{person_id}/status")
def set_status(person_id: str, body: StatusSet, user=Depends(get_current_user), db=Depends(get_db)):
    p = _load_person(db, person_id)
    # CP1d-1b.1: el estado/avatar ya NO lo cambia cualquier member — solo
    # titular, owner/admin o guardián full (misma regla de edición básica).
    _require_basic_edit(db, user, p)
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
    p = _load_person(db, person_id)
    _require_basic_edit(db, user, p)
    db.execute(
        "UPDATE persons SET status_emoji=NULL, status_text=NULL, status_set_at=NULL WHERE id=?",
        (person_id,),
    )
    db.commit()
    return {"ok": True}


@router.get("/{person_id}/health-timeline")
def health_timeline(person_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    p = _load_person(db, person_id)
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
