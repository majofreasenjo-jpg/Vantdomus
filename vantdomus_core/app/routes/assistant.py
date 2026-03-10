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


from pydantic import BaseModel
from typing import List, Optional
import os
import json
import urllib.request

class ChatMessage(BaseModel):
    role: str  # system|user|assistant
    content: str

class ChatRequest(BaseModel):
    household_id: str
    messages: List[ChatMessage]
    model: Optional[str] = None  # e.g. gpt-4.1-mini
    temperature: float = 0.2

def _fallback_reply(household_id: str, db) -> str:
    try:
        from app.features import compute_features_sqlite
        f = compute_features_sqlite(db, household_id)
        
        parts = []
        parts.append(f"Estado de Unidad Operacional Alpha: OSI={f.get('hsi', 0)} (Fatiga {f.get('health_score',0)} · Ops {f.get('task_score',0)} · Insumos {f.get('finance_score',0)})")
        
        if f.get('missed_7d', 0) > 0:
            parts.append(f"Alerta de Seguridad: {f['missed_7d']} controles de fatiga fallidos en los últimos 7 días.")
            
        if f.get('tasks_overdue', 0) > 0:
            parts.append(f"Alerta Operativa: {f['tasks_overdue']} protocolos de mantenimiento vencidos.")
            
        parts.append("Como VantUnit AI, sugiero ejecutar los protocolos de mitigación del Dashboard para estabilizar el OSI.")
        return "\n".join(parts)
    except Exception as e:
        print(f"Fallback Context Error: {e}")
        return "Hola. Soy VantUnit. Listo para asistir en el control operativo del turno."

def _openai_chat(messages, model: str, temperature: float) -> str:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY missing")
    base = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    url = base.rstrip("/") + "/chat/completions"
    payload = {
        "model": model,
        "temperature": temperature,
        "messages": [{"role": m["role"], "content": m["content"]} for m in messages]
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        out = json.loads(resp.read().decode("utf-8"))
    return out["choices"][0]["message"]["content"]

@router.post("/chat")
def chat(payload: ChatRequest, user=Depends(get_current_user), db=Depends(get_db)):
    try:
        require_household_role(db, user["user_id"], payload.household_id, "member")

        # Build context from latest snapshot (if exists)
        system = "You are VantUnit, an AI operational analyst managing a high-risk shift with focus on safety protocols, resource management, and risk mitigation."
        context = _fallback_reply(payload.household_id, db)
        msgs = [{"role": "system", "content": system + "\n\nOperational context (latest snapshot):\n" + context}]
        msgs += [{"role": m.role, "content": m.content} for m in payload.messages]

        # If OpenAI configured, use it. Otherwise return deterministic fallback.
        model = payload.model or os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
        try:
            reply = _openai_chat(msgs, model=model, temperature=payload.temperature)
            return {"ok": True, "provider": "openai", "model": model, "reply": reply}
        except Exception as inner_e:
            return {"ok": True, "provider": "fallback", "model": None, "reply": context, "note": f"OpenAI error: {str(inner_e)}"}
    except Exception as e:
        import traceback
        return {"ok": True, "provider": "error", "reply": f"CRASH TOTAL EN RENDER: {str(e)}\n\nTRACE: {traceback.format_exc()}"}
