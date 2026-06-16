import os

from fastapi import APIRouter, Depends, HTTPException

from app.assistant.context import build_chat_messages
from app.assistant.schemas import ChatRequest
from app.assistant.service import run_agentic_chat
from app.deps import get_current_user, get_db, require_household_role
from app.planner import apply_recommendation, generate_recommendations

router = APIRouter(prefix="/assistant", tags=["Assistant"])


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
    try:
        require_household_role(db, user["user_id"], payload.household_id, "member")
        messages, _taxonomy, fallback_reply = build_chat_messages(payload, user, db)
        model = payload.model or os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

        try:
            reply = run_agentic_chat(
                messages=messages,
                model=model,
                temperature=payload.temperature,
                db=db,
                household_id=payload.household_id,
                user_id=user["user_id"],
            )
            return {"ok": True, "provider": "openai", "model": model, "reply": reply}
        except Exception as exc:
            return {"ok": True, "provider": "fallback", "model": None, "reply": fallback_reply, "note": f"OpenAI error: {exc}"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Assistant chat failed: {exc}") from exc
