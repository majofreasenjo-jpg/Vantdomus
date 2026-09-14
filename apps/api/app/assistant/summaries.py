"""
OPS-2 M6 — Resúmenes de Domi (a demanda).

"Mi día": un resumen personal, breve y cálido, para el integrante que lo pide.
Se apoya en los datos del hogar (tareas, compras, avisos) y en la memoria que ESE
usuario está autorizado a conocer (respeta M1: no revela memoria privada de otro).

Con IA real lo redacta el modelo (a partir de los datos, sin inventar); sin IA,
cae a un resumen por reglas. La versión PROGRAMADA (diaria automática) + entrega
por canal viene en M6-scheduled/M7 (necesita cron/push).
"""

from __future__ import annotations

import json
import logging

logger = logging.getLogger(__name__)

# post_type sensibles que NO entran a un resumen general.
_SENSITIVE_POSTS = ("health", "finance", "document")


def _gather(db, household_id: str, person_id: str | None) -> dict:
    data: dict = {"tasks": [], "shopping_pending": 0, "avisos": []}
    try:
        rows = db.execute(
            "SELECT title FROM task_items WHERE household_id=? AND status='open' "
            "ORDER BY (due_at IS NULL), due_at LIMIT 6",
            (household_id,),
        ).fetchall()
        data["tasks"] = [r["title"] for r in rows if r["title"]]
    except Exception:
        pass
    try:
        row = db.execute(
            "SELECT COUNT(*) c FROM household_shopping_items "
            "WHERE household_id=? AND status NOT IN ('purchased','excluded','bought','done')",
            (household_id,),
        ).fetchone()
        data["shopping_pending"] = int(row["c"]) if row else 0
    except Exception:
        pass
    try:
        qmarks = ",".join("?" for _ in _SENSITIVE_POSTS)
        rows = db.execute(
            f"SELECT title FROM family_board_posts WHERE household_id=? "
            f"AND post_type NOT IN ({qmarks}) ORDER BY created_at DESC LIMIT 3",
            (household_id, *_SENSITIVE_POSTS),
        ).fetchall()
        data["avisos"] = [r["title"] for r in rows if r["title"]]
    except Exception:
        pass
    return data


def _rules_summary(name: str, data: dict, memories: list[dict]) -> str:
    parts: list[str] = [f"Hola {name}."]
    bits: list[str] = []
    if data["tasks"]:
        n = len(data["tasks"])
        bits.append(f"{n} tarea{'s' if n != 1 else ''} pendiente{'s' if n != 1 else ''}"
                    f" (p. ej. {data['tasks'][0]})")
    if data["shopping_pending"]:
        bits.append(f"{data['shopping_pending']} producto{'s' if data['shopping_pending'] != 1 else ''} en la lista")
    if data["avisos"]:
        bits.append(f"{len(data['avisos'])} aviso{'s' if len(data['avisos']) != 1 else ''} en el mural")
    if bits:
        parts.append("Hoy tienes: " + ", ".join(bits) + ".")
    else:
        parts.append("Todo tranquilo por ahora; no hay pendientes.")
    if memories:
        parts.append("Recuerdo que " + memories[0]["note"].rstrip(".").lower() + ".")
    return " ".join(parts)


_AI_SYSTEM = (
    "Eres Domi, asistente del hogar. Redacta un RESUMEN DEL DÍA breve (2-4 frases), "
    "cálido y útil, para la persona indicada, USANDO SOLO los datos entregados "
    "(tareas, compras, avisos) y lo que recuerdas de ella. NO inventes nada que no "
    "esté en los datos. Si no hay pendientes, dilo con calidez. Responde "
    'EXCLUSIVAMENTE un objeto JSON: {"summary": "<texto>"}.'
)


def build_personal_summary(
    db, household_id: str, *,
    requester_user_id: str | None,
    requester_person_id: str | None,
    requester_role: str | None,
    person_name: str = "",
) -> dict:
    """Devuelve {summary, mode}. mode ∈ {"ai","rules"}."""
    from .memory import recall_for_context
    name = (person_name or "").split(" ")[0] or "hola"
    data = _gather(db, household_id, requester_person_id)
    memories = recall_for_context(
        db, household_id,
        requester_user_id=requester_user_id,
        requester_person_id=requester_person_id,
        requester_role=requester_role,
        limit=6,
    )
    # Intento con IA real; si no, reglas.
    try:
        from .gateway import real_provider_permitted
        if real_provider_permitted():
            from .providers.openai_provider import OpenAIProvider
            provider = OpenAIProvider()
            if provider.is_available():
                user = json.dumps({
                    "nombre": name,
                    "tareas_pendientes": data["tasks"],
                    "compras_pendientes": data["shopping_pending"],
                    "avisos_recientes": data["avisos"],
                    "memorias": [m["note"] for m in memories],
                }, ensure_ascii=False)
                out = provider.complete_json(system=_AI_SYSTEM, user=user, max_tokens=300)
                summary = (out.get("summary") or "").strip() if isinstance(out, dict) else ""
                if summary:
                    return {"summary": summary[:1200], "mode": "ai"}
    except Exception as exc:
        logger.warning("summaries: IA no utilizable, uso reglas (%s)", str(exc)[:120])
    return {"summary": _rules_summary(name, data, memories), "mode": "rules"}
