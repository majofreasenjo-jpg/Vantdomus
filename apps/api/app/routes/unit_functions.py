"""
VantGuide — endpoints CRUD para `unit_functions`.

Esta es la entidad central del nuevo modelo (ver `docs/VANTGUIDE_ARCHITECTURE.md`).
Cualquier función que una persona/rol debe cumplir (estudio, medicación,
rutina hogar, protocolo B2B, etc.) entra por acá.

Compatibilidad backward:
    - Cuando se crea un UnitFunction, opcionalmente se hace dual-write a
      `task_items` para que las pantallas viejas (kanban web, mobile)
      sigan viendo el ítem. El registro en `task_items` queda atado al
      `unit_function` vía `legacy_task_id`.
    - Los endpoints viejos (`/tasks/*`, `/health/adherence/*`) NO se rompen.
      Se los puede ir migrando progresivamente a llamar internamente al
      creator de UnitFunction.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..audit import write_audit_log
from ..deps import get_current_user, get_db, require_household_role
from ..tenancy import get_household_organization_id

router = APIRouter(prefix="/unit_functions", tags=["VantGuide"])


# =============================================================================
# Constantes (mantenerlas en sync con docs/VANTGUIDE_ARCHITECTURE.md y la
# migración 260_vantguide_core.sql).
# =============================================================================

ALLOWED_CATEGORIES = {
    "study", "medication", "health_routine", "hygiene", "nutrition", "sleep",
    "home_chore", "appointment", "document_deadline", "finance",
    "social_connection", "calm_regulation", "exercise", "caregiver_task",
    "work_task", "operational_protocol", "safety_check",
}

ALLOWED_SOURCE_TYPES = {
    "school_notice", "university_assignment", "prescription",
    "doctor_instruction", "caregiver_instruction", "family_rule",
    "manual_entry", "uploaded_document", "voice_note", "photo",
    "calendar_event", "email_inbound", "whatsapp_inbound", "ai_suggestion",
    "b2b_protocol", "operational_event",
}

ALLOWED_STATUSES = {"open", "in_progress", "done", "cancelled", "superseded"}
ALLOWED_PRIORITIES = {"low", "medium", "high", "urgent"}
ALLOWED_SUPERVISION_LEVELS = {"autonomous", "reminder_only", "supervised", "co_executed"}
ALLOWED_SUPPORT_MODES = {"tap", "voice", "photo", "caregiver_confirm", "passive", None}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _validate_enum(value: str, allowed: set, field_name: str) -> None:
    if value not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field_name}: '{value}'. Allowed: {sorted(a for a in allowed if a is not None)}",
        )


# =============================================================================
# Schemas
# =============================================================================

class UnitFunctionCreate(BaseModel):
    """Crea una UnitFunction nueva."""
    household_id: str
    person_id: str
    category: str
    title: str
    description: Optional[str] = None
    source_type: str = "manual_entry"
    source_document_id: Optional[str] = None
    responsible_person_id: Optional[str] = None
    due_at: Optional[str] = None  # ISO 8601 UTC
    schedule: dict = Field(default_factory=dict)  # cron-like
    recurrence: Optional[str] = None
    priority: str = "medium"
    supervision_level: str = "reminder_only"
    support_mode: Optional[str] = None
    evidence_required: bool = False
    reward_rule_id: Optional[str] = None
    metadata: dict = Field(default_factory=dict)
    # Si True, también crea un task_items para que pantallas viejas lo vean.
    dual_write_task: bool = True


class UnitFunctionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_at: Optional[str] = None
    schedule: Optional[dict] = None
    recurrence: Optional[str] = None
    supervision_level: Optional[str] = None
    support_mode: Optional[str] = None
    evidence_required: Optional[bool] = None
    metadata: Optional[dict] = None


class UnitFunctionResponse(BaseModel):
    id: str
    household_id: Optional[str]
    organization_id: Optional[str]
    person_id: str
    responsible_person_id: Optional[str]
    category: str
    title: str
    description: Optional[str]
    source_type: str
    source_document_id: Optional[str]
    due_at: Optional[str]
    schedule: dict
    recurrence: Optional[str]
    status: str
    priority: str
    supervision_level: str
    support_mode: Optional[str]
    evidence_required: bool
    reward_rule_id: Optional[str]
    legacy_task_id: Optional[str]
    created_by_user_id: str
    created_by_ai: bool
    metadata: dict
    created_at: str
    updated_at: str


# =============================================================================
# Helpers internos
# =============================================================================

def _row_to_response(row) -> UnitFunctionResponse:
    """Convierte una fila de DB a UnitFunctionResponse."""
    return UnitFunctionResponse(
        id=row["id"],
        household_id=row["household_id"],
        organization_id=row["organization_id"],
        person_id=row["person_id"],
        responsible_person_id=row["responsible_person_id"],
        category=row["category"],
        title=row["title"],
        description=row["description"],
        source_type=row["source_type"],
        source_document_id=row["source_document_id"],
        due_at=row["due_at"],
        schedule=_loads(row["schedule"]),
        recurrence=row["recurrence"],
        status=row["status"],
        priority=row["priority"],
        supervision_level=row["supervision_level"],
        support_mode=row["support_mode"],
        evidence_required=bool(row["evidence_required"]),
        reward_rule_id=row["reward_rule_id"],
        legacy_task_id=row["legacy_task_id"],
        created_by_user_id=row["created_by_user_id"],
        created_by_ai=bool(row["created_by_ai"]),
        metadata=_loads(row["metadata"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _loads(value) -> dict:
    if value is None or value == "":
        return {}
    if isinstance(value, dict):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return {}


def _require_person_belongs_to_household(db, person_id: str, household_id: str) -> None:
    row = db.execute(
        "SELECT 1 FROM persons WHERE id=? AND household_id=?",
        (person_id, household_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=400, detail="Person does not belong to the household")


def create_unit_function_internal(
    db,
    *,
    household_id: str,
    organization_id: Optional[str],
    person_id: str,
    category: str,
    title: str,
    source_type: str = "manual_entry",
    created_by_user_id: str,
    created_by_ai: bool = False,
    description: Optional[str] = None,
    source_document_id: Optional[str] = None,
    responsible_person_id: Optional[str] = None,
    due_at: Optional[str] = None,
    schedule: Optional[dict] = None,
    recurrence: Optional[str] = None,
    priority: str = "medium",
    supervision_level: str = "reminder_only",
    support_mode: Optional[str] = None,
    evidence_required: bool = False,
    reward_rule_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    legacy_task_id: Optional[str] = None,
    legacy_adherence_plan_id: Optional[int] = None,
    dual_write_task: bool = False,
) -> str:
    """
    Crea una UnitFunction internamente (sin Depends de FastAPI).

    Esta función la usan otros endpoints (school_planner adapter, demo seed,
    assistant tools) para reusar la misma lógica.

    Si `dual_write_task=True` y no se pasó `legacy_task_id`, inserta también
    en `task_items` para retrocompat con pantallas viejas.

    Devuelve el ID del UnitFunction creado.
    """
    _validate_enum(category, ALLOWED_CATEGORIES, "category")
    _validate_enum(source_type, ALLOWED_SOURCE_TYPES, "source_type")
    _validate_enum(priority, ALLOWED_PRIORITIES, "priority")
    _validate_enum(supervision_level, ALLOWED_SUPERVISION_LEVELS, "supervision_level")
    if support_mode is not None:
        _validate_enum(support_mode, ALLOWED_SUPPORT_MODES, "support_mode")

    uf_id = str(uuid.uuid4())
    ts = _now()
    sched = schedule or {}
    meta = metadata or {}

    # Dual-write opcional a task_items
    task_id = legacy_task_id
    if dual_write_task and task_id is None:
        task_id = str(uuid.uuid4())
        tag = category if category != "operational_protocol" else "operational"
        db.execute(
            "INSERT OR IGNORE INTO task_items "
            "(id, household_id, organization_id, title, status, due_at, assigned_person_id, priority, tags, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (
                task_id, household_id, organization_id, title, "open",
                due_at, person_id, priority, json.dumps([tag]),
                ts, ts,
            ),
        )

    db.execute(
        "INSERT INTO unit_functions ("
        "id, household_id, organization_id, person_id, responsible_person_id, "
        "category, title, description, source_type, source_document_id, "
        "due_at, schedule, recurrence, status, priority, supervision_level, "
        "support_mode, evidence_required, reward_rule_id, legacy_task_id, "
        "legacy_adherence_plan_id, created_by_user_id, created_by_ai, "
        "metadata, audit_trail, created_at, updated_at"
        ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            uf_id, household_id, organization_id, person_id, responsible_person_id,
            category, title, description, source_type, source_document_id,
            due_at, json.dumps(sched, ensure_ascii=False), recurrence,
            "open", priority, supervision_level,
            support_mode, 1 if evidence_required else 0, reward_rule_id, task_id,
            legacy_adherence_plan_id, created_by_user_id, 1 if created_by_ai else 0,
            json.dumps(meta, ensure_ascii=False), "[]", ts, ts,
        ),
    )

    # Registrar evento "scheduled" en function_events
    _insert_function_event(
        db,
        unit_function_id=uf_id,
        household_id=household_id,
        organization_id=organization_id,
        event_type="scheduled",
        scheduled_for=due_at,
        triggered_by="ai" if created_by_ai else "user",
        triggered_by_user_id=created_by_user_id,
    )

    return uf_id


def _insert_function_event(
    db,
    *,
    unit_function_id: str,
    household_id: Optional[str],
    organization_id: Optional[str],
    event_type: str,
    scheduled_for: Optional[str] = None,
    actual_at: Optional[str] = None,
    payload: Optional[dict] = None,
    triggered_by: str = "system",
    triggered_by_user_id: Optional[str] = None,
) -> Optional[str]:
    """
    Inserta un function_event respetando idempotencia via dedupe_key.

    Devuelve el id del evento si se insertó, None si era duplicado.
    """
    now_iso = _now()
    actual = actual_at or now_iso
    dedupe = f"{unit_function_id}|{scheduled_for or actual}|{event_type}"

    # Check duplicado
    existing = db.execute(
        "SELECT id FROM function_events WHERE dedupe_key=?",
        (dedupe,),
    ).fetchone()
    if existing:
        return None

    ev_id = str(uuid.uuid4())
    db.execute(
        "INSERT INTO function_events ("
        "id, unit_function_id, household_id, organization_id, event_type, "
        "scheduled_for, actual_at, payload, triggered_by, triggered_by_user_id, "
        "dedupe_key, created_at"
        ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            ev_id, unit_function_id, household_id, organization_id, event_type,
            scheduled_for, actual, json.dumps(payload or {}, ensure_ascii=False),
            triggered_by, triggered_by_user_id, dedupe, now_iso,
        ),
    )
    return ev_id


# =============================================================================
# Endpoints REST
# =============================================================================

@router.post("", response_model=UnitFunctionResponse)
def create_unit_function(
    body: UnitFunctionCreate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Crea una UnitFunction nueva.

    Requiere rol member+ en el household. Si se pasa source_document_id,
    debe existir en logbook_entries (no validamos FK estricta acá; lo
    chequea el endpoint que lo provea — ej. school adapter).
    """
    require_household_role(db, user["user_id"], body.household_id, "member")
    organization_id = get_household_organization_id(db, body.household_id)
    _require_person_belongs_to_household(db, body.person_id, body.household_id)
    if body.responsible_person_id:
        _require_person_belongs_to_household(db, body.responsible_person_id, body.household_id)

    uf_id = create_unit_function_internal(
        db,
        household_id=body.household_id,
        organization_id=organization_id,
        person_id=body.person_id,
        category=body.category,
        title=body.title,
        source_type=body.source_type,
        created_by_user_id=user["user_id"],
        created_by_ai=False,
        description=body.description,
        source_document_id=body.source_document_id,
        responsible_person_id=body.responsible_person_id,
        due_at=body.due_at,
        schedule=body.schedule,
        recurrence=body.recurrence,
        priority=body.priority,
        supervision_level=body.supervision_level,
        support_mode=body.support_mode,
        evidence_required=body.evidence_required,
        reward_rule_id=body.reward_rule_id,
        metadata=body.metadata,
        dual_write_task=body.dual_write_task,
    )

    write_audit_log(
        db,
        action="unit_function.create",
        resource_type="unit_function",
        resource_id=uf_id,
        household_id=body.household_id,
        user_id=user["user_id"],
        metadata={"category": body.category, "source_type": body.source_type},
    )
    db.commit()

    row = db.execute("SELECT * FROM unit_functions WHERE id=?", (uf_id,)).fetchone()
    return _row_to_response(row)


@router.get("")
def list_unit_functions(
    household_id: str,
    person_id: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Lista UnitFunctions del household con filtros opcionales."""
    require_household_role(db, user["user_id"], household_id, "viewer")
    if limit > 500:
        limit = 500

    sql = "SELECT * FROM unit_functions WHERE household_id=?"
    params: list = [household_id]
    if person_id:
        sql += " AND person_id=?"
        params.append(person_id)
    if category:
        _validate_enum(category, ALLOWED_CATEGORIES, "category")
        sql += " AND category=?"
        params.append(category)
    if status:
        _validate_enum(status, ALLOWED_STATUSES, "status")
        sql += " AND status=?"
        params.append(status)
    sql += " ORDER BY due_at ASC NULLS LAST, created_at DESC LIMIT ?"
    params.append(limit)

    # SQLite no soporta NULLS LAST directamente; fallback:
    sql_sqlite = sql.replace("NULLS LAST", "")

    try:
        rows = db.execute(sql, tuple(params)).fetchall()
    except Exception:
        rows = db.execute(sql_sqlite, tuple(params)).fetchall()

    return {"items": [dict(r) for r in rows]}


@router.get("/{unit_function_id}")
def get_unit_function(
    unit_function_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    row = db.execute(
        "SELECT * FROM unit_functions WHERE id=?",
        (unit_function_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="UnitFunction not found")
    require_household_role(db, user["user_id"], row["household_id"], "viewer")
    return _row_to_response(row)


@router.patch("/{unit_function_id}")
def update_unit_function(
    unit_function_id: str,
    body: UnitFunctionUpdate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    row = db.execute(
        "SELECT * FROM unit_functions WHERE id=?",
        (unit_function_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="UnitFunction not found")
    require_household_role(db, user["user_id"], row["household_id"], "member")

    sets: list[str] = []
    params: list = []

    def _set(col: str, val):
        sets.append(f"{col}=?")
        params.append(val)

    if body.title is not None:
        _set("title", body.title)
    if body.description is not None:
        _set("description", body.description)
    if body.status is not None:
        _validate_enum(body.status, ALLOWED_STATUSES, "status")
        _set("status", body.status)
    if body.priority is not None:
        _validate_enum(body.priority, ALLOWED_PRIORITIES, "priority")
        _set("priority", body.priority)
    if body.due_at is not None:
        _set("due_at", body.due_at)
    if body.schedule is not None:
        _set("schedule", json.dumps(body.schedule, ensure_ascii=False))
    if body.recurrence is not None:
        _set("recurrence", body.recurrence)
    if body.supervision_level is not None:
        _validate_enum(body.supervision_level, ALLOWED_SUPERVISION_LEVELS, "supervision_level")
        _set("supervision_level", body.supervision_level)
    if body.support_mode is not None:
        _validate_enum(body.support_mode, ALLOWED_SUPPORT_MODES, "support_mode")
        _set("support_mode", body.support_mode)
    if body.evidence_required is not None:
        _set("evidence_required", 1 if body.evidence_required else 0)
    if body.metadata is not None:
        _set("metadata", json.dumps(body.metadata, ensure_ascii=False))

    if not sets:
        raise HTTPException(status_code=400, detail="No fields to update")

    sets.append("updated_at=?")
    params.append(_now())
    params.append(unit_function_id)

    db.execute(f"UPDATE unit_functions SET {', '.join(sets)} WHERE id=?", tuple(params))

    # Si transicionamos a done o cancelled, marcar el evento correspondiente
    if body.status == "done":
        _insert_function_event(
            db,
            unit_function_id=unit_function_id,
            household_id=row["household_id"],
            organization_id=row["organization_id"],
            event_type="completed",
            triggered_by="user",
            triggered_by_user_id=user["user_id"],
        )
    elif body.status == "cancelled":
        _insert_function_event(
            db,
            unit_function_id=unit_function_id,
            household_id=row["household_id"],
            organization_id=row["organization_id"],
            event_type="superseded",
            triggered_by="user",
            triggered_by_user_id=user["user_id"],
        )

    db.commit()
    fresh = db.execute("SELECT * FROM unit_functions WHERE id=?", (unit_function_id,)).fetchone()
    return _row_to_response(fresh)


@router.get("/{unit_function_id}/timeline")
def get_function_timeline(
    unit_function_id: str,
    limit: int = 100,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Timeline de eventos de una función (todos los function_events)."""
    row = db.execute(
        "SELECT household_id FROM unit_functions WHERE id=?",
        (unit_function_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="UnitFunction not found")
    require_household_role(db, user["user_id"], row["household_id"], "viewer")

    rows = db.execute(
        "SELECT * FROM function_events WHERE unit_function_id=? "
        "ORDER BY actual_at DESC LIMIT ?",
        (unit_function_id, min(limit, 500)),
    ).fetchall()
    return {"items": [dict(r) for r in rows]}
