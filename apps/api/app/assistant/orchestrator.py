"""
CP1c-FUNC-MIN-3.1 — AI Orchestrator seguro de Domi (propose-first).

Punto de entrada único del chat. NADIE ejecuta acciones aquí: el proveedor
(mock por defecto) SOLO propone; las acciones de escritura se guardan como
propuestas 'pending' y requieren confirmación humana (endpoints confirm/reject).

Responsabilidades:
1. Construir un contexto MÍNIMO y scoped (sin P&L/CEO, PII reducida a nombres de pila).
2. Pasar el mensaje al proveedor y obtener respuesta + propuestas.
3. Aplicar el gate de permisos (rol + visibilidad de módulo) antes de guardar.
4. Persistir cada propuesta de escritura como 'pending' (auditada).
5. Devolver reply + propuestas pendientes para que la UI muestre Confirmar/Rechazar.
"""

import json
import logging

from app.rbac import ROLE_RANK
from .domi_rules import answer_domi
from .gateway import GatewayRequest, gateway
from .registry import get_contract
from .proposals import create_proposal

logger = logging.getLogger(__name__)


def _first_name(name: str) -> str:
    return (name or "").strip().split()[0] if name else ""


def build_minimal_context(
    db, household_id: str, user_message: str, *,
    requester_user_id: str | None = None,
    requester_person_id: str | None = None,
    requester_role: str | None = None,
) -> dict:
    """
    Contexto MÍNIMO para el proveedor. Minimización de PII: solo nombres de pila
    e IDs internos (no relaciones, no RUT, no montos exactos). Nada de P&L/CEO ni
    datos fuera del hogar. Las memorias se filtran por QUIÉN pregunta (M1).
    """
    persons = []
    try:
        rows = db.execute(
            "SELECT id, display_name FROM persons WHERE household_id=? ORDER BY display_name",
            (household_id,),
        ).fetchall()
        persons = [{"id": r["id"], "name": _first_name(r["display_name"])} for r in rows]
    except Exception:
        logger.warning("orchestrator: no se pudieron leer personas del hogar")

    # Respuesta de lectura honesta (reglas Domi) — se usa como fallback de lectura.
    try:
        summary_text = answer_domi(user_message, db, household_id)
    except Exception:
        summary_text = ""

    # OPS-2.A — Memoria por persona: hechos que la familia le enseñó a Domi
    # (preferencias, rutinas, cómo estudia cada hijo…). Solo memorias visibles
    # para el hogar y de tipos NO sensibles (salud queda fuera).
    try:
        from .memory import recall_for_context
        memories = recall_for_context(
            db, household_id,
            requester_user_id=requester_user_id,
            requester_person_id=requester_person_id,
            requester_role=requester_role,
        )
    except Exception:
        memories = []

    return {"persons": persons, "summary_text": summary_text, "memories": memories}


def _module_visible(db, household_id: str, module: str, role: str) -> bool:
    """Respeta meta.module_visibility (default visible para todos)."""
    if not module:
        return True
    try:
        row = db.execute("SELECT meta FROM households WHERE id=?", (household_id,)).fetchone()
        meta = json.loads(row["meta"]) if row and row["meta"] else {}
        mv = meta.get("module_visibility") or {}
        need = mv.get(module)
        if not need or need not in ROLE_RANK:
            return True
        return ROLE_RANK.get(role, -1) >= ROLE_RANK[need]
    except Exception:
        return True


def _passes_permission_gate(db, household_id: str, role: str, contract) -> bool:
    """El rol alcanza y los módulos requeridos están visibles."""
    if ROLE_RANK.get(role, -1) < ROLE_RANK.get(contract.required_role, 0):
        return False
    for module in contract.required_modules:
        if not _module_visible(db, household_id, module, role):
            return False
    return True


def handle_chat(db, *, household_id: str, user_id: str, role: str, messages: list) -> dict:
    """
    Procesa el último mensaje del usuario. Devuelve:
      { reply, provider, proposals: [...pending...], blocked }
    """
    last_user = ""
    for m in reversed(messages):
        r = getattr(m, "role", None) or (m.get("role") if isinstance(m, dict) else None)
        if r == "user":
            last_user = getattr(m, "content", None) or (m.get("content") if isinstance(m, dict) else "") or ""
            break

    # MIN-3.3a — pipeline explícito vía ProviderGateway:
    # 1 contexto solicitado → 2 scope household/person → 3 minimización →
    # 4 redacción (solo nombres de pila + resumen) → 5 payload segmentado →
    # 6 respuesta estructurada → 7 validación estricta → 8 proposal store.
    # M1 — identidad del que pregunta, para filtrar memorias por privacidad.
    try:
        prow = db.execute(
            "SELECT id FROM persons WHERE household_id=? AND user_id=? LIMIT 1",
            (household_id, user_id),
        ).fetchone()
        requester_person_id = prow["id"] if prow else None
    except Exception:
        requester_person_id = None
    context = build_minimal_context(                               # pasos 1-4
        db, household_id, last_user,
        requester_user_id=user_id,
        requester_person_id=requester_person_id,
        requester_role=role,
    )
    result = gateway.propose(                                       # pasos 5-7
        GatewayRequest(
            household_id=household_id,
            user_id=user_id,
            user_message=last_user,
            home_context=context,
        ),
        db=db,
    )

    stored: list[dict] = []                                         # paso 8
    skipped_notes: list[str] = []
    for action in result.proposals:
        contract = get_contract(action.tool_name)
        if not contract:
            continue
        # El proveedor solo propone; el gate de permisos decide si se ofrece.
        if not _passes_permission_gate(db, household_id, role, contract):
            skipped_notes.append(f"(No tienes permiso para «{contract.category}» en este hogar.)")
            continue
        stored.append(create_proposal(
            db, household_id=household_id, user_id=user_id, action=action, provider_name=result.provider,
        ))

    reply = result.reply
    if skipped_notes:
        reply = (reply + "\n" + " ".join(skipped_notes)).strip()

    return {
        "reply": reply,
        "provider": result.provider,
        "proposals": stored,
        "blocked": result.blocked,
        # MIN-3.3a: telemetría del gateway (sin contenido de prompts)
        "gateway": {
            "latency_ms": result.latency_ms,
            "fallback_used": result.fallback_used,
            "valid": result.valid,
        },
    }
