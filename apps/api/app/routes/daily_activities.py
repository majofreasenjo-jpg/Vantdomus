"""
U1-LOCAL — Actividades del Día.

Cada integrante publica "Hoy tengo...". Visibilidad family|caregivers|private.
Vinculación opcional a UnitFunction. Sin push, sin scheduler runtime.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..deps import get_current_user, get_db, require_household_role
from ..tenancy import get_household_organization_id

router = APIRouter(prefix="/daily_activities", tags=["DailyActivities"])

ALLOWED_TYPES = {"school", "work", "health", "errand", "sport", "social", "home", "travel", "other"}
ALLOWED_VISIBILITIES = {"family", "caregivers", "private"}
ALLOWED_STATUSES = {"planned", "in_progress", "done", "cancelled"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_dict(row) -> dict:
    d = dict(row)
    try:
        d["metadata"] = json.loads(d.get("metadata") or "{}")
    except (TypeError, ValueError):
        d["metadata"] = {}
    return d


def _current_person_id(db, user_id: str, household_id: str) -> Optional[str]:
    try:
        r = db.execute(
            "SELECT id FROM persons WHERE household_id=? AND user_id=?",
            (household_id, user_id),
        ).fetchone()
        return r["id"] if r else None
    except Exception:
        return None


class ActivityCreate(BaseModel):
    person_id: str
    title: str
    description: Optional[str] = None
    activity_type: str = "other"
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    location_label: Optional[str] = None
    visibility: str = "family"
    linked_unit_function_id: Optional[str] = None
    metadata: dict = Field(default_factory=dict)
    # OPS-2 M11 — calendario↔recordatorios: minutos antes del evento para avisar
    # (crea un family_reminder M7 vinculado; requiere starts_at).
    reminder_minutes_before: Optional[int] = None


class ActivityPatch(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    activity_type: Optional[str] = None
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    location_label: Optional[str] = None
    visibility: Optional[str] = None
    status: Optional[str] = None


def _validate(activity_type=None, visibility=None, status=None):
    if activity_type is not None and activity_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Invalid activity_type. Allowed: {sorted(ALLOWED_TYPES)}")
    if visibility is not None and visibility not in ALLOWED_VISIBILITIES:
        raise HTTPException(400, f"Invalid visibility. Allowed: {sorted(ALLOWED_VISIBILITIES)}")
    if status is not None and status not in ALLOWED_STATUSES:
        raise HTTPException(400, f"Invalid status. Allowed: {sorted(ALLOWED_STATUSES)}")


def _visible_activities(db, household_id: str, role: str, user_id: str,
                        date: Optional[str] = None,
                        date_from: Optional[str] = None,
                        date_to: Optional[str] = None) -> list[dict]:
    """Actividades del hogar filtradas por fecha/rango y visibilidad del requester."""
    where = "household_id=?"
    params: list = [household_id]
    if date:
        where += " AND (starts_at LIKE ? OR (starts_at IS NULL AND DATE(created_at) = ?))"
        params.extend([f"{date}%", date])
    # OPS-2 M11 — rango [date_from, date_to] (YYYY-MM-DD, inclusivo) para la
    # vista de calendario mensual/semanal.
    if date_from:
        where += " AND starts_at >= ?"
        params.append(date_from)
    if date_to:
        where += " AND starts_at < ?"
        params.append(f"{date_to}~")  # '~' > cualquier sufijo horario del mismo día
    rows = db.execute(
        f"SELECT * FROM daily_activities WHERE {where} ORDER BY COALESCE(starts_at, created_at) ASC LIMIT 500",
        tuple(params),
    ).fetchall()
    items = [_row_to_dict(r) for r in rows]
    if role not in ("owner", "admin"):
        my_pid = _current_person_id(db, user_id, household_id)
        items = [a for a in items
                 if not (a["visibility"] == "private" and a["person_id"] != my_pid)]
    return items


@router.get("/{household_id}")
def list_activities(
    household_id: str,
    date: Optional[str] = None,        # YYYY-MM-DD (un día)
    date_from: Optional[str] = None,   # YYYY-MM-DD (rango, para calendario)
    date_to: Optional[str] = None,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    role = require_household_role(db, user["user_id"], household_id, "viewer")
    return {"items": _visible_activities(db, household_id, role, user["user_id"],
                                         date, date_from, date_to)}


@router.get("/{household_id}/calendar.ics")
def calendar_ics(
    household_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    OPS-2 M11 — Descarga el calendario del hogar como .ics (importable en
    Google/Apple/Outlook, sin OAuth). Solo incluye lo que ESTE usuario puede ver.
    """
    from fastapi.responses import Response
    from ..assistant.calendar_export import build_ics
    role = require_household_role(db, user["user_id"], household_id, "viewer")
    items = _visible_activities(db, household_id, role, user["user_id"])
    ics = build_ics(items)
    return Response(content=ics, media_type="text/calendar; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="vantdomus-hogar.ics"'})


@router.post("/{household_id}")
def create_activity(
    household_id: str,
    body: ActivityCreate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_household_role(db, user["user_id"], household_id, "member")
    _validate(body.activity_type, body.visibility)
    # person debe pertenecer al household
    p = db.execute("SELECT id FROM persons WHERE id=? AND household_id=?", (body.person_id, household_id)).fetchone()
    if not p:
        raise HTTPException(400, "person_id not in household")
    org = get_household_organization_id(db, household_id)
    now = _now()
    aid = str(uuid.uuid4())
    db.execute(
        "INSERT INTO daily_activities ("
        "id, household_id, organization_id, person_id, created_by_user_id, "
        "title, description, activity_type, starts_at, ends_at, location_label, "
        "visibility, status, linked_unit_function_id, metadata, created_at, updated_at"
        ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            aid, household_id, org, body.person_id, user["user_id"],
            body.title, body.description, body.activity_type,
            body.starts_at, body.ends_at, body.location_label,
            body.visibility, "planned", body.linked_unit_function_id,
            json.dumps(body.metadata or {}, ensure_ascii=False),
            now, now,
        ),
    )
    db.commit()

    # OPS-2 M11 — calendario↔recordatorios: aviso N minutos antes del evento
    # (family_reminder M7; entra a la campana y al push si está habilitado).
    # Best-effort: si algo falla, el evento igual queda creado.
    reminder_id = None
    if body.reminder_minutes_before and body.starts_at:
        try:
            from datetime import timedelta
            from ..assistant import reminders as rem
            mins = max(0, min(7 * 24 * 60, int(body.reminder_minutes_before)))
            s = str(body.starts_at).strip().replace("Z", "+00:00")
            start_dt = datetime.fromisoformat(s)
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=timezone.utc)
            remind_at = (start_dt - timedelta(minutes=mins)).isoformat()
            scope = "private_self" if body.visibility == "private" else "household_shared"
            reminder_id = rem.create_reminder(
                db, household_id=household_id, organization_id=org,
                person_id=body.person_id, created_by_user_id=user["user_id"],
                title=f"{body.title} (en {mins} min)" if mins else body.title,
                body=body.location_label,
                remind_at=remind_at, visibility_scope=scope,
                dedupe_key=f"activity-{aid}",
            )
            db.commit()
        except Exception:
            reminder_id = None

    row = db.execute("SELECT * FROM daily_activities WHERE id=?", (aid,)).fetchone()
    out = _row_to_dict(row)
    if reminder_id:
        out["reminder_id"] = reminder_id
    return out


@router.patch("/{household_id}/{activity_id}")
def patch_activity(
    household_id: str,
    activity_id: str,
    body: ActivityPatch,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_household_role(db, user["user_id"], household_id, "member")
    _validate(body.activity_type, body.visibility, body.status)
    row = db.execute(
        "SELECT id FROM daily_activities WHERE id=? AND household_id=?",
        (activity_id, household_id),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Activity not found")
    sets, params = [], []
    for k in ("title", "description", "activity_type", "starts_at", "ends_at",
              "location_label", "visibility", "status"):
        v = getattr(body, k)
        if v is not None:
            sets.append(f"{k}=?"); params.append(v)
    if not sets:
        raise HTTPException(400, "No fields to update")
    sets.append("updated_at=?"); params.append(_now()); params.append(activity_id)
    db.execute(f"UPDATE daily_activities SET {', '.join(sets)} WHERE id=?", tuple(params))
    db.commit()
    r2 = db.execute("SELECT * FROM daily_activities WHERE id=?", (activity_id,)).fetchone()
    return _row_to_dict(r2)


@router.post("/{household_id}/{activity_id}/complete")
def complete_activity(household_id: str, activity_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "member")
    cur = db.execute(
        "UPDATE daily_activities SET status='done', updated_at=? WHERE id=? AND household_id=?",
        (_now(), activity_id, household_id),
    )
    if cur.rowcount == 0:
        raise HTTPException(404, "Activity not found")
    db.commit()
    return {"ok": True, "status": "done"}


@router.post("/{household_id}/{activity_id}/cancel")
def cancel_activity(household_id: str, activity_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "member")
    cur = db.execute(
        "UPDATE daily_activities SET status='cancelled', updated_at=? WHERE id=? AND household_id=?",
        (_now(), activity_id, household_id),
    )
    if cur.rowcount == 0:
        raise HTTPException(404, "Activity not found")
    db.commit()
    return {"ok": True, "status": "cancelled"}
