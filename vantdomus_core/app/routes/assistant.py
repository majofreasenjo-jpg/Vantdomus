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
    # lightweight, deterministic summary
    cur = db.cursor()
    cur.execute("SELECT snapshot_json FROM state_snapshots WHERE household_id=? ORDER BY created_at DESC LIMIT 1", (household_id,))
    row = cur.fetchone()
    if row and row[0]:
        try:
            snap = row[0] if isinstance(row[0], dict) else json.loads(row[0])
            f = snap.get("features", {}) or {}
            alerts = (snap.get("alerts") or [])
            recos = (snap.get("assistant") or {}).get("items") or []
            parts = []
            parts.append(f"Estado: HSI={f.get('hsi', 0)} (Health {f.get('health_score',0)} · Tasks {f.get('task_score',0)} · Finance {f.get('finance_score',0)})")
            if alerts:
                parts.append(f"Alertas activas: {len(alerts)}. Ej: {alerts[0].get('title','')}")
            if recos:
                parts.append(f"Recomendaciones: {len(recos)}. Top: {recos[0].get('title','')}")
            parts.append("Siguiente paso sugerido: aplicar la recomendación con mayor impacto y revisar los check-ins de salud.")
            return "\n".join(parts)
        except Exception:
            pass
    return "No encontré un snapshot reciente. Usa Dashboard/Refresh y vuelve a intentar."

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
    require_household_role(db, user["user_id"], payload.household_id, "member")

    # Build context from latest snapshot (if exists)
    system = "You are VantDomus, an AI operator that helps manage a household/unit with focus on clarity, safety, and actionable next steps."
    context = _fallback_reply(payload.household_id, db)
    msgs = [{"role": "system", "content": system + "\n\nHousehold context (latest snapshot):\n" + context}]
    msgs += [{"role": m.role, "content": m.content} for m in payload.messages]

    # If OpenAI configured, use it. Otherwise return deterministic fallback.
    model = payload.model or os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    try:
        reply = _openai_chat(msgs, model=model, temperature=payload.temperature)
        return {"ok": True, "provider": "openai", "model": model, "reply": reply}
    except Exception as e:
        return {"ok": True, "provider": "fallback", "model": None, "reply": context, "note": f"OpenAI not configured or failed: {str(e)}"}
