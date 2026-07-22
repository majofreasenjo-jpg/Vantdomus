import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.assistant.schemas import ChatRequest
from app.assistant import orchestrator
from app.assistant import proposals as proposal_store
from app.assistant import memory as memory_store
from app.deps import get_current_user, get_db, require_household_role
from app.planner import apply_recommendation, generate_recommendations
from app.tenancy import get_household_organization_id

router = APIRouter(prefix="/assistant", tags=["Assistant"])


def _current_person_id(db, user_id: str, household_id: str) -> str | None:
    row = db.execute(
        "SELECT id FROM persons WHERE household_id=? AND user_id=? LIMIT 1",
        (household_id, user_id),
    ).fetchone()
    return row["id"] if row else None


@router.get("/recommendations")
def recommendations(household_id: str, refresh: bool = False, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "viewer")
    items, features = generate_recommendations(db, household_id, force_refresh=refresh)
    return {"items": items, "features": features}


@router.post("/apply")
def apply(household_id: str, reco_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "member")
    try:
        return apply_recommendation(db, household_id, reco_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/plan")
def plan(household_id: str, goal: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "member")
    goal_text = (goal or "").strip()
    goal_l = goal_text.lower()
    if not goal_l:
        raise HTTPException(status_code=400, detail="goal required")

    suggestions = []
    if "med" in goal_l or "salud" in goal_l or "medicacion" in goal_l:
        suggestions += [
            {"title": "Crear rutina de medicacion", "priority": "high", "tags": ["health", "planning"]},
            {"title": "Checklist semanal de salud", "priority": "medium", "tags": ["health"]},
        ]
    if "orden" in goal_l or "casa" in goal_l or "hogar" in goal_l:
        suggestions += [
            {"title": "Plan semanal del hogar", "priority": "high", "tags": ["home", "planning"]},
            {"title": "Rutina diaria de 15 minutos", "priority": "medium", "tags": ["home"]},
        ]
    if "ahorrar" in goal_l or "presupuesto" in goal_l or "gastos" in goal_l:
        suggestions += [
            {"title": "Revision de gastos por categoria", "priority": "high", "tags": ["finance", "budget"]},
            {"title": "Definir limites semanales", "priority": "medium", "tags": ["finance"]},
        ]

    return {
        "goal": goal_text,
        "suggested_tasks": suggestions,
        "next_step": "Puedes crear estas tareas desde /tasks o aplicar una recomendacion existente.",
    }


@router.post("/chat")
def chat(payload: ChatRequest, user=Depends(get_current_user), db=Depends(get_db)):
    """
    CP1c-FUNC-MIN-3.1 — Entrada propose-first. Domi entiende, consulta contexto
    permitido y PROPONE. Las acciones de escritura vuelven como propuestas
    'pending' que requieren confirmación humana (endpoints /proposals/*). NADA se
    ejecuta aquí. Proveedor = mock por defecto; el externo queda apagado.
    """
    try:
        role = require_household_role(db, user["user_id"], payload.household_id, "member")
        out = orchestrator.handle_chat(
            db,
            household_id=payload.household_id,
            user_id=user["user_id"],
            role=role,
            messages=payload.messages,
        )
        return {"ok": True, **out}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Assistant chat failed: {exc}") from exc


# =============================================================================
# CP1c-FUNC-MIN-3.1 — Propuestas: listar / confirmar / rechazar
# =============================================================================
class DecisionBody(BaseModel):
    overrides: dict = {}


@router.get("/proposals")
def list_proposals(household_id: str, status: str = "pending", user=Depends(get_current_user), db=Depends(get_db)):
    role = require_household_role(db, user["user_id"], household_id, "viewer")
    my_pid = _current_person_id(db, user["user_id"], household_id)
    items = proposal_store.list_proposals(db, household_id, status, role, my_pid)
    return {"items": items}


@router.post("/proposals/{proposal_id}/confirm")
def confirm_proposal(proposal_id: str, body: DecisionBody = DecisionBody(), user=Depends(get_current_user), db=Depends(get_db)):
    """
    Ejecuta una propuesta SOLO tras confirmación humana. Requiere rol member
    (revalidado aquí, no se confía en el cliente).

    MIN-3.2 — lifecycle endurecido:
    - executed → respuesta IDEMPOTENTE (no re-ejecuta, no duplica; devuelve el
      resultado ya existente).
    - expired → 409 con copy claro (get_proposal ya la marcó lazy).
    - rejected → 409.
    - failed → reintento controlado permitido (una ejecución nueva, auditada).
    - overrides → validados contra el contrato (whitelist + tipos) en el store.
    """
    prop = proposal_store.get_proposal(db, proposal_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")
    require_household_role(db, user["user_id"], prop["household_id"], "member")

    if prop["status"] == "executed":
        return {"ok": True, "proposal": prop, "already_executed": True,
                "response_type": "accion_ejecutada",
                "detail": "Esta propuesta ya se ejecutó; no se duplicó nada."}
    if prop["status"] == "rejected":
        raise HTTPException(status_code=409, detail="La propuesta fue rechazada; pídele a Domi una nueva.")
    if prop["status"] == "expired":
        raise HTTPException(status_code=409, detail="La propuesta expiró. Pídele a Domi que la proponga de nuevo.")
    if prop["status"] == "confirmed":
        # Estado transitorio (ejecución en curso): no relanzar.
        raise HTTPException(status_code=409, detail="La propuesta se está ejecutando.")

    try:
        result = proposal_store.execute_proposal(db, prop, user["user_id"], overrides=body.overrides or {})
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        # La tool falló: el store ya la dejó 'failed' + audit. Sin éxito falso.
        raise HTTPException(status_code=500, detail="La acción no pudo completarse. Puedes reintentar la confirmación.") from exc
    return {"ok": True, "proposal": result, "response_type": "accion_ejecutada"}


@router.post("/proposals/{proposal_id}/reject")
def reject_proposal(proposal_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    prop = proposal_store.get_proposal(db, proposal_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")
    require_household_role(db, user["user_id"], prop["household_id"], "member")
    if prop["status"] == "rejected":
        # Idempotente: rechazar dos veces es seguro.
        return {"ok": True, "proposal": prop, "already_rejected": True}
    if prop["status"] not in ("pending", "failed"):
        raise HTTPException(status_code=409, detail=f"La propuesta ya está {prop['status']}")
    result = proposal_store.reject_proposal(db, prop, user["user_id"])
    return {"ok": True, "proposal": result}


# ---------------------------------------------------------------------------
# OPS-2.A — Memoria por persona: la familia le enseña a Domi hechos de cada
# integrante y Domi los usa para personalizar. Solo tipos NO sensibles (salud
# queda fuera); consentimiento por-item.
# ---------------------------------------------------------------------------
class MemoryCreateBody(BaseModel):
    household_id: str
    memory_type: str
    content: str
    person_id: str | None = None          # None = memoria de toda la familia
    importance: float | None = 0.5
    visibility_scope: str = "household_shared"


@router.get("/memory")
def list_memory(household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    role = require_household_role(db, user["user_id"], household_id, "viewer")
    pid = _current_person_id(db, user["user_id"], household_id)
    return {
        "items": memory_store.list_memories(
            db, household_id,
            requester_user_id=user["user_id"], requester_person_id=pid, requester_role=role,
        ),
        "allowed_types": sorted(memory_store.SAFE_MEMORY_TYPES),
        "allowed_scopes": sorted(memory_store.ALLOWED_SCOPES),
    }


@router.post("/memory")
def create_memory(body: MemoryCreateBody, user=Depends(get_current_user), db=Depends(get_db)):
    role = require_household_role(db, user["user_id"], body.household_id, "member")
    if body.memory_type not in memory_store.SAFE_MEMORY_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de memoria no permitido")
    if body.visibility_scope not in memory_store.ALLOWED_SCOPES:
        raise HTTPException(status_code=400, detail="Ámbito de visibilidad no permitido")
    # owner_operational solo lo puede crear un administrador del hogar.
    if body.visibility_scope == "owner_operational" and role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Solo un administrador puede crear memoria operativa del hogar")
    if not (body.content or "").strip():
        raise HTTPException(status_code=400, detail="El contenido no puede estar vacío")
    # La persona (si se indica) DEBE pertenecer al hogar (evita fuga entre hogares).
    if body.person_id:
        row = db.execute(
            "SELECT id FROM persons WHERE id=? AND household_id=?",
            (body.person_id, body.household_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Persona no encontrada en este hogar")
    organization_id = get_household_organization_id(db, body.household_id)
    try:
        mid = memory_store.add_memory(
            db,
            household_id=body.household_id,
            organization_id=organization_id,
            person_id=body.person_id,
            memory_type=body.memory_type,
            content=body.content,
            importance=body.importance if body.importance is not None else 0.5,
            created_by_user_id=user["user_id"],
            visibility_scope=body.visibility_scope,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    db.commit()
    return {"ok": True, "id": mid}


@router.delete("/memory/{memory_id}")
def remove_memory(memory_id: str, household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    role = require_household_role(db, user["user_id"], household_id, "member")
    pid = _current_person_id(db, user["user_id"], household_id)
    ok = memory_store.delete_memory(
        db, household_id, memory_id,
        requester_user_id=user["user_id"], requester_person_id=pid, requester_role=role,
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Memoria no encontrada o sin permiso")
    db.commit()
    return {"ok": True}
