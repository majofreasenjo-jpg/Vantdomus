import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.assistant.schemas import ChatRequest
from app.assistant import orchestrator
from app.assistant import proposals as proposal_store
from app.deps import get_current_user, get_db, require_household_role
from app.planner import apply_recommendation, generate_recommendations

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
    """Ejecuta una propuesta SOLO tras confirmación humana. Requiere rol member."""
    prop = proposal_store.get_proposal(db, proposal_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")
    require_household_role(db, user["user_id"], prop["household_id"], "member")
    if prop["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"La propuesta ya está {prop['status']}")
    try:
        result = proposal_store.execute_proposal(db, prop, user["user_id"], overrides=body.overrides or {})
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "proposal": result}


@router.post("/proposals/{proposal_id}/reject")
def reject_proposal(proposal_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    prop = proposal_store.get_proposal(db, proposal_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")
    require_household_role(db, user["user_id"], prop["household_id"], "member")
    if prop["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"La propuesta ya está {prop['status']}")
    result = proposal_store.reject_proposal(db, prop, user["user_id"])
    return {"ok": True, "proposal": result}
