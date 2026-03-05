from fastapi import APIRouter, Depends, HTTPException
from ..deps import get_db, get_current_user, require_household_role
from ..planner import generate_recommendations, apply_recommendation

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
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# D) contrato listo para IA conversacional futura (heurístico por ahora)
@router.post("/plan")
def plan(household_id: str, goal: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "member")
    goal_l = (goal or "").strip().lower()
    if not goal_l:
        raise HTTPException(status_code=400, detail="goal required")

    suggestions = []
    if "med" in goal_l or "salud" in goal_l or "medicación" in goal_l:
        suggestions += [
            {"title":"Crear rutina de medicación", "priority":"high", "tags":["health","planning"]},
            {"title":"Checklist semanal de salud", "priority":"medium", "tags":["health"]},
        ]
    if "orden" in goal_l or "casa" in goal_l or "hogar" in goal_l:
        suggestions += [
            {"title":"Plan semanal del hogar (30 min)", "priority":"high", "tags":["home","planning"]},
            {"title":"Rutina diaria 15 min (cocina/baño)", "priority":"medium", "tags":["home"]},
        ]
    if "ahorrar" in goal_l or "presupuesto" in goal_l or "gastos" in goal_l:
        suggestions += [
            {"title":"Revisión de gastos (15 min)", "priority":"high", "tags":["finance","budget"]},
            {"title":"Definir límites por categoría", "priority":"medium", "tags":["finance"]},
        ]

    return {"goal": goal, "suggested_tasks": suggestions, "next_step": "Puedes crear estas tareas desde /tasks o extender apply para auto-crear."}
