"""
VantGuide — Múltiples responsables por UnitFunction (VG+1.5).

Decisión 8 de Codex: `unit_functions.responsible_person_id` se mantiene
como **responsable primario** (backward compat con migración 260). Esta
tabla agrega:

  * Orden de escalation (escalation_order)
  * Permisos granulares (can_confirm, can_edit)
  * Rol explícito (primary_caregiver, secondary_caregiver, parent,
    guardian, doctor_viewer, supervisor, reviewer, escalation_contact)
  * Flag de notificación (notify)

Casos de uso:

  Familia:
    Camila → primary_caregiver, escalation_order=1, can_confirm=true
    Pedro  → secondary_caregiver, escalation_order=2, can_confirm=true
    Dra. González → doctor_viewer, can_confirm=false (read-only)

  B2B:
    Supervisor → reviewer, can_confirm=true
    Jefe turno → escalation_contact, escalation_order=2, notify=true
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..audit import write_audit_log
from ..deps import get_current_user, get_db, require_household_role


router = APIRouter(prefix="/unit_functions", tags=["VantGuide"])

ALLOWED_RESPONSIBILITY_ROLES = {
    "primary_caregiver",
    "secondary_caregiver",
    "parent",
    "guardian",
    "doctor_viewer",
    "supervisor",
    "reviewer",
    "escalation_contact",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class AddResponsibleBody(BaseModel):
    person_id: str
    responsibility_role: str
    escalation_order: int = 1
    notify: bool = True
    can_confirm: bool = False
    can_edit: bool = False
    # Override opcional del tiempo de espera antes de pasar al siguiente
    # escalation_order. Si es None, el dispatcher usa
    # household.meta.default_escalation_step_minutes (o 15 por default).
    escalation_delay_minutes: Optional[int] = None


def _validate_role(role: str) -> None:
    if role not in ALLOWED_RESPONSIBILITY_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid responsibility_role: '{role}'. Allowed: {sorted(ALLOWED_RESPONSIBILITY_ROLES)}",
        )


def _get_function_household(db, unit_function_id: str) -> str:
    row = db.execute(
        "SELECT household_id FROM unit_functions WHERE id=?",
        (unit_function_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="UnitFunction not found")
    return row["household_id"]


def add_responsible_internal(
    db,
    *,
    unit_function_id: str,
    person_id: str,
    responsibility_role: str,
    escalation_order: int = 1,
    notify: bool = True,
    can_confirm: bool = False,
    can_edit: bool = False,
    escalation_delay_minutes: Optional[int] = None,
) -> str:
    """Inserta un responsable. Idempotente vía UNIQUE compuesto en la tabla."""
    _validate_role(responsibility_role)
    rid = str(uuid.uuid4())
    db.execute(
        "INSERT OR IGNORE INTO unit_function_responsibles ("
        "id, unit_function_id, person_id, responsibility_role, "
        "escalation_order, notify, can_confirm, can_edit, "
        "escalation_delay_minutes, created_at"
        ") VALUES (?,?,?,?,?,?,?,?,?,?)",
        (
            rid, unit_function_id, person_id, responsibility_role,
            escalation_order, 1 if notify else 0,
            1 if can_confirm else 0, 1 if can_edit else 0,
            escalation_delay_minutes,
            _now(),
        ),
    )
    return rid


@router.post("/{unit_function_id}/responsibles")
def add_responsible(
    unit_function_id: str,
    body: AddResponsibleBody,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Agrega un responsable a una UnitFunction."""
    household_id = _get_function_household(db, unit_function_id)
    require_household_role(db, user["user_id"], household_id, "member")

    # Verificar que la persona pertenece al household
    p_row = db.execute(
        "SELECT 1 FROM persons WHERE id=? AND household_id=?",
        (body.person_id, household_id),
    ).fetchone()
    if not p_row:
        raise HTTPException(
            status_code=400,
            detail="Person does not belong to the household",
        )

    rid = add_responsible_internal(
        db,
        unit_function_id=unit_function_id,
        person_id=body.person_id,
        responsibility_role=body.responsibility_role,
        escalation_order=body.escalation_order,
        notify=body.notify,
        can_confirm=body.can_confirm,
        can_edit=body.can_edit,
        escalation_delay_minutes=body.escalation_delay_minutes,
    )
    write_audit_log(
        db,
        action="unit_function.add_responsible",
        resource_type="unit_function_responsible",
        resource_id=rid,
        household_id=household_id,
        user_id=user["user_id"],
        metadata={
            "unit_function_id": unit_function_id,
            "person_id": body.person_id,
            "responsibility_role": body.responsibility_role,
        },
    )
    db.commit()
    return {"id": rid, "ok": True}


@router.get("/{unit_function_id}/responsibles")
def list_responsibles(
    unit_function_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Lista los responsables de una función, ordenados por escalation_order."""
    household_id = _get_function_household(db, unit_function_id)
    require_household_role(db, user["user_id"], household_id, "viewer")

    rows = db.execute(
        "SELECT * FROM unit_function_responsibles "
        "WHERE unit_function_id=? "
        "ORDER BY escalation_order ASC, created_at ASC",
        (unit_function_id,),
    ).fetchall()
    return {"items": [dict(r) for r in rows]}


@router.delete("/{unit_function_id}/responsibles/{responsible_id}")
def remove_responsible(
    unit_function_id: str,
    responsible_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Elimina un responsable."""
    household_id = _get_function_household(db, unit_function_id)
    require_household_role(db, user["user_id"], household_id, "member")

    db.execute(
        "DELETE FROM unit_function_responsibles "
        "WHERE id=? AND unit_function_id=?",
        (responsible_id, unit_function_id),
    )
    write_audit_log(
        db,
        action="unit_function.remove_responsible",
        resource_type="unit_function_responsible",
        resource_id=responsible_id,
        household_id=household_id,
        user_id=user["user_id"],
    )
    db.commit()
    return {"ok": True}
