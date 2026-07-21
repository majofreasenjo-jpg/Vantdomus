"""
OPS-2.A — Memoria persistente por persona para Domi.

Domi ahora RECUERDA hechos de cada integrante (preferencias, rutinas, cómo
estudia cada hijo, estrategias de calma, historias de familia…) y los usa para
personalizar sus respuestas. La bodega es la tabla `memory_items` (SQLite en el
disco persistente): sobrevive redeploys.

Privacidad (fail-closed):
  - Solo se inyectan al contexto de la IA las memorias visibles para el hogar
    (consent_scope.visible_to contiene "household") y de tipos NO sensibles.
  - Los tipos de SALUD (health_context, caregiver_note) y negativos
    (risk_pattern, negative_learning) NUNCA entran al contexto de la IA ni se
    pueden crear por esta vía (salud sigue cerrada en el perfil familiar).
  - Nada de RUT, montos, tokens: es texto libre corto que la familia decide.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Tipos de memoria SEGUROS para el contexto de la IA y para crear vía API.
SAFE_MEMORY_TYPES = {
    "preference",
    "routine_pattern",
    "study_pattern",
    "motivation_pattern",
    "calm_strategy",
    "social_connection",
    "family_story",
    "improvement",
    "operational_context",
}
# Nunca entran al contexto de la IA (salud-adyacentes / negativos).
_BLOCKED_FROM_CONTEXT = {
    "health_context", "caregiver_note", "risk_pattern", "negative_learning",
}

_MAX_CONTEXT_ITEMS = 14
_MAX_CONTENT_CHARS = 180
DEFAULT_CONSENT = '{"visible_to":["self","household"],"shareable_with_doctor":false}'


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _first_name(name: str | None) -> str:
    return (name or "").strip().split(" ")[0] or "Integrante"


def _visible_to_household(consent_scope: str | None) -> bool:
    try:
        data = json.loads(consent_scope or "{}")
        vt = data.get("visible_to") or []
        return "household" in vt
    except Exception:
        return False


def recall_for_context(db, household_id: str, limit: int = _MAX_CONTEXT_ITEMS) -> list[dict]:
    """
    Memorias que Domi puede USAR al razonar: visibles para el hogar, de tipos NO
    sensibles, no expiradas, ordenadas por importancia. Devuelve una lista
    compacta [{about, note, type}] (about = nombre de pila o "familia").
    """
    now = _now()
    try:
        rows = db.execute(
            """
            SELECT m.person_id, m.memory_type, m.content, m.consent_scope,
                   p.display_name
            FROM memory_items m
            LEFT JOIN persons p ON p.id = m.person_id
            WHERE m.household_id = ?
              AND (m.expires_at IS NULL OR m.expires_at > ?)
            ORDER BY m.importance DESC, m.updated_at DESC
            LIMIT 200
            """,
            (household_id, now),
        ).fetchall()
    except Exception:
        logger.warning("memory: no se pudieron leer memorias del hogar")
        return []

    out: list[dict] = []
    for r in rows:
        mtype = r["memory_type"]
        if mtype in _BLOCKED_FROM_CONTEXT or mtype not in SAFE_MEMORY_TYPES:
            continue
        if not _visible_to_household(r["consent_scope"]):
            continue
        content = (r["content"] or "").strip()
        if not content:
            continue
        out.append({
            "about": _first_name(r["display_name"]) if r["person_id"] else "familia",
            "note": content[:_MAX_CONTENT_CHARS],
            "type": mtype,
        })
        if len(out) >= limit:
            break
    return out


def add_memory(
    db,
    *,
    household_id: str,
    organization_id: str | None,
    person_id: str | None,
    memory_type: str,
    content: str,
    importance: float,
    created_by_user_id: str,
    visible_to_household: bool = True,
) -> str:
    """Inserta una memoria (solo tipos seguros). Devuelve el id."""
    if memory_type not in SAFE_MEMORY_TYPES:
        raise ValueError(f"memory_type no permitido: {memory_type}")
    content = (content or "").strip()
    if not content:
        raise ValueError("content vacío")
    try:
        imp = float(importance)
    except (TypeError, ValueError):
        imp = 0.5
    imp = max(0.0, min(1.0, imp))
    visible = ["self", "household"] if visible_to_household else ["self"]
    consent = json.dumps({"visible_to": visible, "shareable_with_doctor": False})
    mid = str(uuid.uuid4())
    ts = _now()
    db.execute(
        "INSERT INTO memory_items "
        "(id, person_id, household_id, organization_id, memory_type, content, "
        "importance, consent_scope, created_by_user_id, created_at, updated_at) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (mid, person_id, household_id, organization_id, memory_type,
         content[:2000], imp, consent, created_by_user_id, ts, ts),
    )
    return mid


def list_memories(db, household_id: str) -> list[dict]:
    """Lista de memorias del hogar (para administrarlas en la UI)."""
    rows = db.execute(
        """
        SELECT m.id, m.person_id, m.memory_type, m.content, m.importance,
               m.consent_scope, m.created_at, p.display_name
        FROM memory_items m
        LEFT JOIN persons p ON p.id = m.person_id
        WHERE m.household_id = ?
        ORDER BY m.importance DESC, m.updated_at DESC
        LIMIT 300
        """,
        (household_id,),
    ).fetchall()
    return [{
        "id": r["id"],
        "person_id": r["person_id"],
        "about": _first_name(r["display_name"]) if r["person_id"] else "familia",
        "memory_type": r["memory_type"],
        "content": r["content"],
        "importance": r["importance"],
        "visible_to_household": _visible_to_household(r["consent_scope"]),
        "created_at": r["created_at"],
    } for r in rows]


def delete_memory(db, household_id: str, memory_id: str) -> bool:
    cur = db.execute(
        "DELETE FROM memory_items WHERE id=? AND household_id=?",
        (memory_id, household_id),
    )
    return (cur.rowcount or 0) > 0
