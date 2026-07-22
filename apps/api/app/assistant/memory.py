"""
OPS-2.A + M1 — Memoria persistente por persona para Domi, con PRIVACIDAD real.

Domi recuerda hechos de cada integrante y los usa para personalizar. Con M1, la
recuperación respeta scopes canónicos y filtra por QUIÉN pregunta: Domi solo
recibe memorias que el usuario actual está autorizado a conocer.

Scopes (`visibility_scope`):
  - household_shared    → todo el hogar.
  - document_derived    → derivada de documentos; visible al hogar.
  - owner_operational   → solo owner/admin del hogar.
  - private_self        → solo el sujeto (o quien la creó).
  - guardian_supervised → el menor sujeto y sus guardianes activos.
  - temporary_session   → como private_self, y con vigencia (expires_at).

Privacidad fail-closed adicional:
  - Tipos de SALUD/negativos NUNCA entran al contexto de la IA ni se crean aquí.
  - Sin requester (fallback) solo se exponen scopes de hogar (nunca privadas).
  - El texto de una memoria es DATA, nunca instrucción para el modelo.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

SAFE_MEMORY_TYPES = {
    "preference", "routine_pattern", "study_pattern", "motivation_pattern",
    "calm_strategy", "social_connection", "family_story", "improvement",
    "operational_context",
}
_BLOCKED_FROM_CONTEXT = {
    "health_context", "caregiver_note", "risk_pattern", "negative_learning",
}

ALLOWED_SCOPES = {
    "private_self", "guardian_supervised", "household_shared",
    "owner_operational", "temporary_session", "document_derived",
}
_HOUSEHOLD_WIDE_SCOPES = {"household_shared", "document_derived"}

# OPS-2 M8 — Biblioteca de Domi: 6 capas. Cada memoria cae en UNA según su
# origen (source), scope y tipo. Prioridad: temporal → inferencia → documental →
# operativa → familiar → personal.
LAYER_LABELS = {
    "personal": "Memoria personal",
    "familiar": "Memoria familiar",
    "documental": "Conocimiento documental",
    "operativa": "Historia operativa",
    "inferencia": "Inferencias de Domi",
    "temporal": "Contexto temporal",
}
LAYER_ORDER = ["personal", "familiar", "documental", "operativa", "inferencia", "temporal"]
_ALLOWED_SENSITIVITY = {"low", "normal", "high"}


def layer_of(*, memory_type: str | None, visibility_scope: str | None,
             source: str | None, expires_at: str | None = None) -> str:
    """Clasifica una memoria en una de las 6 capas del canon (clave)."""
    scope = visibility_scope or "household_shared"
    if scope == "temporary_session" or (source == "system" and expires_at):
        return "temporal"
    if source == "inference":
        return "inferencia"
    if source == "document" or scope == "document_derived":
        return "documental"
    if scope == "owner_operational" or memory_type == "operational_context":
        return "operativa"
    if scope == "household_shared":
        return "familiar"
    return "personal"

_MAX_CONTEXT_ITEMS = 14
_MAX_CONTENT_CHARS = 180


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _first_name(name: str | None) -> str:
    return (name or "").strip().split(" ")[0] or "Integrante"


def _active_guarded_person_ids(db, guardian_person_id: str | None) -> set[str]:
    """IDs de menores que este integrante tutela (relaciones activas)."""
    if not guardian_person_id:
        return set()
    try:
        rows = db.execute(
            "SELECT minor_person_id FROM guardian_relationships "
            "WHERE guardian_person_id=? AND revoked_at IS NULL",
            (guardian_person_id,),
        ).fetchall()
        return {r["minor_person_id"] for r in rows}
    except Exception:
        return set()


def _can_see(
    *, scope: str, subject_pid: str | None, created_by: str | None,
    req_uid: str | None, req_pid: str | None, req_role: str | None,
    guarded: set[str],
) -> bool:
    """¿El requester está autorizado a conocer esta memoria?"""
    if scope in _HOUSEHOLD_WIDE_SCOPES:
        return True  # recall ya está acotado al hogar
    if scope == "owner_operational":
        return req_role in ("owner", "admin")
    if scope == "private_self":
        return (req_pid is not None and req_pid == subject_pid) or (
            req_uid is not None and req_uid == created_by)
    if scope == "guardian_supervised":
        return (req_pid is not None and req_pid == subject_pid) or (
            subject_pid is not None and subject_pid in guarded)
    if scope == "temporary_session":
        return (req_pid is not None and req_pid == subject_pid) or (
            req_uid is not None and req_uid == created_by)
    return False


def recall_for_context(
    db, household_id: str, *,
    requester_user_id: str | None = None,
    requester_person_id: str | None = None,
    requester_role: str | None = None,
    limit: int = _MAX_CONTEXT_ITEMS,
) -> list[dict]:
    """
    Memorias que Domi puede USAR al razonar PARA EL USUARIO ACTUAL: tipos no
    sensibles, no expiradas, y cuyo scope autoriza al requester. Sin requester,
    solo scopes de hogar (jamás privadas). Devuelve [{about, note, type}].
    """
    now = _now()
    try:
        rows = db.execute(
            """
            SELECT m.person_id, m.memory_type, m.content, m.visibility_scope,
                   m.created_by_user_id, p.display_name
            FROM memory_items m
            LEFT JOIN persons p ON p.id = m.person_id
            WHERE m.household_id = ?
              AND (m.expires_at IS NULL OR m.expires_at > ?)
              AND m.deleted_at IS NULL
              AND (m.inference_status IS NULL OR m.inference_status = 'confirmed')
            ORDER BY m.importance DESC, m.updated_at DESC
            LIMIT 300
            """,
            (household_id, now),
        ).fetchall()
    except Exception:
        # Compat: si aún no existe deleted_at (migración vieja), reintenta sin él.
        try:
            rows = db.execute(
                """
                SELECT m.person_id, m.memory_type, m.content, m.visibility_scope,
                       m.created_by_user_id, p.display_name
                FROM memory_items m
                LEFT JOIN persons p ON p.id = m.person_id
                WHERE m.household_id = ?
                  AND (m.expires_at IS NULL OR m.expires_at > ?)
                ORDER BY m.importance DESC, m.updated_at DESC
                LIMIT 300
                """,
                (household_id, now),
            ).fetchall()
        except Exception:
            logger.warning("memory: no se pudieron leer memorias del hogar")
            return []

    guarded = _active_guarded_person_ids(db, requester_person_id)
    out: list[dict] = []
    for r in rows:
        mtype = r["memory_type"]
        if mtype in _BLOCKED_FROM_CONTEXT or mtype not in SAFE_MEMORY_TYPES:
            continue
        scope = (r["visibility_scope"] or "household_shared")
        if not _can_see(
            scope=scope, subject_pid=r["person_id"], created_by=r["created_by_user_id"],
            req_uid=requester_user_id, req_pid=requester_person_id, req_role=requester_role,
            guarded=guarded,
        ):
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


def _consent_for_scope(scope: str) -> str:
    visible = ["self", "household"] if scope in (_HOUSEHOLD_WIDE_SCOPES | {"owner_operational"}) else ["self"]
    return json.dumps({"visible_to": visible, "shareable_with_doctor": False})


def add_memory(
    db, *,
    household_id: str,
    organization_id: str | None,
    person_id: str | None,
    memory_type: str,
    content: str,
    importance: float,
    created_by_user_id: str,
    visibility_scope: str = "household_shared",
    visible_to_household: bool | None = None,   # compat OPS-2.A
    # OPS-2 M8 — metadatos de biblioteca:
    source: str = "family",
    sensitivity: str = "normal",
    confidence: float | None = None,
    inference_status: str | None = None,        # None=hecho; 'pending'|'confirmed'
    supersedes: str | None = None,              # id de la memoria que reemplaza
) -> str:
    """Inserta una memoria (solo tipos y scopes seguros). Devuelve el id.

    Si `supersedes` apunta a una memoria del hogar, esa vieja se marca eliminada
    (deja de entrar al contexto) — la nueva la reemplaza con trazabilidad.
    Las inferencias (source='inference', inference_status='pending') NO entran al
    contexto de IA hasta que se confirman.
    """
    if memory_type not in SAFE_MEMORY_TYPES:
        raise ValueError(f"memory_type no permitido: {memory_type}")
    # Compat: si llega el flag viejo, traducir a scope.
    if visible_to_household is not None:
        visibility_scope = "household_shared" if visible_to_household else "private_self"
    if visibility_scope not in ALLOWED_SCOPES:
        raise ValueError(f"visibility_scope no permitido: {visibility_scope}")
    if sensitivity not in _ALLOWED_SENSITIVITY:
        sensitivity = "normal"
    content = (content or "").strip()
    if not content:
        raise ValueError("content vacío")
    try:
        imp = max(0.0, min(1.0, float(importance)))
    except (TypeError, ValueError):
        imp = 0.5
    conf = None
    if confidence is not None:
        try:
            conf = max(0.0, min(1.0, float(confidence)))
        except (TypeError, ValueError):
            conf = None
    verified = _now() if inference_status == "confirmed" else None
    mid = str(uuid.uuid4())
    ts = _now()
    db.execute(
        "INSERT INTO memory_items "
        "(id, person_id, household_id, organization_id, memory_type, content, "
        "importance, consent_scope, visibility_scope, created_by_user_id, created_at, updated_at, "
        "source, sensitivity, confidence, verified_at, supersedes, inference_status) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (mid, person_id, household_id, organization_id, memory_type, content[:2000],
         imp, _consent_for_scope(visibility_scope), visibility_scope,
         created_by_user_id, ts, ts,
         source, sensitivity, conf, verified, supersedes, inference_status),
    )
    # Reemplazo con trazabilidad: la vieja se retira del contexto.
    if supersedes:
        db.execute(
            "UPDATE memory_items SET deleted_at=?, updated_at=? "
            "WHERE id=? AND household_id=? AND deleted_at IS NULL",
            (ts, ts, supersedes, household_id),
        )
    return mid


def add_inference(
    db, *,
    household_id: str,
    organization_id: str | None,
    person_id: str | None,
    memory_type: str,
    content: str,
    created_by_user_id: str,
    confidence: float = 0.5,
    visibility_scope: str = "household_shared",
) -> str:
    """
    Domi propone una HIPÓTESIS (capa 5). Se guarda 'pending' y NO entra al
    contexto hasta que un humano la confirme. Devuelve el id.
    """
    return add_memory(
        db, household_id=household_id, organization_id=organization_id,
        person_id=person_id, memory_type=memory_type, content=content,
        importance=0.4, created_by_user_id=created_by_user_id,
        visibility_scope=visibility_scope,
        source="inference", confidence=confidence, inference_status="pending",
    )


def confirm_inference(db, household_id: str, memory_id: str, *,
                      requester_user_id=None, requester_person_id=None, requester_role=None) -> bool:
    """Promueve una inferencia 'pending' → 'confirmed' (hecho, entra al contexto)."""
    if not _can_manage(db, household_id, memory_id,
                       req_uid=requester_user_id, req_pid=requester_person_id, req_role=requester_role):
        return False
    cur = db.execute(
        "UPDATE memory_items SET inference_status='confirmed', verified_at=?, updated_at=? "
        "WHERE id=? AND household_id=? AND inference_status='pending' AND deleted_at IS NULL",
        (_now(), _now(), memory_id, household_id),
    )
    return (cur.rowcount or 0) > 0


def dismiss_inference(db, household_id: str, memory_id: str, *,
                      requester_user_id=None, requester_person_id=None, requester_role=None) -> bool:
    """Descarta una inferencia 'pending' → 'dismissed' (queda por trazabilidad)."""
    if not _can_manage(db, household_id, memory_id,
                       req_uid=requester_user_id, req_pid=requester_person_id, req_role=requester_role):
        return False
    cur = db.execute(
        "UPDATE memory_items SET inference_status='dismissed', updated_at=? "
        "WHERE id=? AND household_id=? AND inference_status='pending'",
        (_now(), memory_id, household_id),
    )
    return (cur.rowcount or 0) > 0


def correct_memory(db, household_id: str, memory_id: str, new_content: str, *,
                   requester_user_id=None, requester_person_id=None, requester_role=None) -> bool:
    """Corrige el contenido de una memoria (si el requester puede gestionarla)."""
    new_content = (new_content or "").strip()
    if not new_content:
        raise ValueError("El contenido corregido no puede estar vacío")
    if not _can_manage(db, household_id, memory_id,
                       req_uid=requester_user_id, req_pid=requester_person_id, req_role=requester_role):
        return False
    cur = db.execute(
        "UPDATE memory_items SET content=?, updated_at=? WHERE id=? AND household_id=? AND deleted_at IS NULL",
        (new_content[:2000], _now(), memory_id, household_id),
    )
    return (cur.rowcount or 0) > 0


def list_memories(
    db, household_id: str, *,
    requester_user_id: str | None = None,
    requester_person_id: str | None = None,
    requester_role: str | None = None,
) -> list[dict]:
    """Memorias del hogar que el requester está autorizado a ver (para la UI)."""
    rows = db.execute(
        """
        SELECT m.id, m.person_id, m.memory_type, m.content, m.importance,
               m.visibility_scope, m.created_by_user_id, m.created_at, p.display_name
        FROM memory_items m
        LEFT JOIN persons p ON p.id = m.person_id
        WHERE m.household_id = ? AND m.deleted_at IS NULL
        ORDER BY m.importance DESC, m.updated_at DESC
        LIMIT 400
        """,
        (household_id,),
    ).fetchall()
    guarded = _active_guarded_person_ids(db, requester_person_id)
    out = []
    for r in rows:
        scope = r["visibility_scope"] or "household_shared"
        if not _can_see(
            scope=scope, subject_pid=r["person_id"], created_by=r["created_by_user_id"],
            req_uid=requester_user_id, req_pid=requester_person_id, req_role=requester_role,
            guarded=guarded,
        ):
            continue
        out.append({
            "id": r["id"],
            "person_id": r["person_id"],
            "about": _first_name(r["display_name"]) if r["person_id"] else "familia",
            "memory_type": r["memory_type"],
            "content": r["content"],
            "importance": r["importance"],
            "visibility_scope": scope,
            "created_at": r["created_at"],
        })
    return out


def _can_manage(db, household_id: str, memory_id: str, *,
                req_uid: str | None, req_pid: str | None, req_role: str | None) -> bool:
    row = db.execute(
        "SELECT person_id, visibility_scope, created_by_user_id FROM memory_items "
        "WHERE id=? AND household_id=? AND deleted_at IS NULL",
        (memory_id, household_id),
    ).fetchone()
    if not row:
        return False
    guarded = _active_guarded_person_ids(db, req_pid)
    if not _can_see(scope=row["visibility_scope"] or "household_shared",
                    subject_pid=row["person_id"], created_by=row["created_by_user_id"],
                    req_uid=req_uid, req_pid=req_pid, req_role=req_role, guarded=guarded):
        return False
    # Puede gestionar quien la creó, el sujeto, un owner/admin, o un guardián del sujeto.
    return (
        req_uid == row["created_by_user_id"]
        or (req_pid is not None and req_pid == row["person_id"])
        or req_role in ("owner", "admin")
        or (row["person_id"] is not None and row["person_id"] in guarded)
    )


def delete_memory(db, household_id: str, memory_id: str, *,
                  requester_user_id: str | None = None,
                  requester_person_id: str | None = None,
                  requester_role: str | None = None) -> bool:
    """Soft-delete (deleted_at) si el requester está autorizado a gestionarla."""
    if not _can_manage(db, household_id, memory_id,
                       req_uid=requester_user_id, req_pid=requester_person_id, req_role=requester_role):
        return False
    cur = db.execute(
        "UPDATE memory_items SET deleted_at=?, updated_at=? WHERE id=? AND household_id=?",
        (_now(), _now(), memory_id, household_id),
    )
    return (cur.rowcount or 0) > 0


# ---------------------------------------------------------------------------
# OPS-2 M8 — Biblioteca (6 capas), inferencias pendientes y exportación.
# ---------------------------------------------------------------------------
def _visible_full_rows(db, household_id: str, *, req_uid, req_pid, req_role,
                       include_pending_inferences: bool):
    """Filas visibles con metadatos completos (sin eliminadas ni descartadas)."""
    rows = db.execute(
        """
        SELECT m.id, m.person_id, m.memory_type, m.content, m.importance,
               m.visibility_scope, m.created_by_user_id, m.created_at, m.updated_at,
               m.source, m.sensitivity, m.confidence, m.verified_at, m.supersedes,
               m.inference_status, m.expires_at, p.display_name
        FROM memory_items m
        LEFT JOIN persons p ON p.id = m.person_id
        WHERE m.household_id = ? AND m.deleted_at IS NULL
          AND (m.inference_status IS NULL OR m.inference_status IN ('confirmed', 'pending'))
        ORDER BY m.updated_at DESC
        LIMIT 500
        """,
        (household_id,),
    ).fetchall()
    guarded = _active_guarded_person_ids(db, req_pid)
    out = []
    for r in rows:
        if r["inference_status"] == "pending" and not include_pending_inferences:
            continue
        scope = r["visibility_scope"] or "household_shared"
        if not _can_see(scope=scope, subject_pid=r["person_id"], created_by=r["created_by_user_id"],
                        req_uid=req_uid, req_pid=req_pid, req_role=req_role, guarded=guarded):
            continue
        out.append(r)
    return out


def _row_to_item(r) -> dict:
    layer = layer_of(memory_type=r["memory_type"], visibility_scope=r["visibility_scope"],
                     source=r["source"], expires_at=r["expires_at"])
    return {
        "id": r["id"],
        "about": _first_name(r["display_name"]) if r["person_id"] else "familia",
        "person_id": r["person_id"],
        "memory_type": r["memory_type"],
        "content": r["content"],
        "layer": layer,
        "layer_label": LAYER_LABELS[layer],
        "source": r["source"],
        "sensitivity": r["sensitivity"],
        "confidence": r["confidence"],
        "visibility_scope": r["visibility_scope"],
        "inference_status": r["inference_status"],
        "verified_at": r["verified_at"],
        "supersedes": r["supersedes"],
        "created_at": r["created_at"],
        "updated_at": r["updated_at"],
    }


def library_view(db, household_id: str, *,
                 requester_user_id=None, requester_person_id=None, requester_role=None) -> dict:
    """Biblioteca agrupada por las 6 capas (solo hechos + inferencias confirmadas)."""
    rows = _visible_full_rows(db, household_id, req_uid=requester_user_id,
                              req_pid=requester_person_id, req_role=requester_role,
                              include_pending_inferences=False)
    groups = {k: [] for k in LAYER_ORDER}
    for r in rows:
        item = _row_to_item(r)
        groups[item["layer"]].append(item)
    layers = [{"key": k, "label": LAYER_LABELS[k], "items": groups[k]} for k in LAYER_ORDER]
    return {"layers": layers, "total": len(rows)}


def list_inferences(db, household_id: str, *,
                    requester_user_id=None, requester_person_id=None, requester_role=None) -> list[dict]:
    """Inferencias 'pending' que el requester puede ver y confirmar/descartar."""
    rows = _visible_full_rows(db, household_id, req_uid=requester_user_id,
                              req_pid=requester_person_id, req_role=requester_role,
                              include_pending_inferences=True)
    return [_row_to_item(r) for r in rows if r["inference_status"] == "pending"]


def export_for_user(db, household_id: str, *,
                    requester_user_id=None, requester_person_id=None, requester_role=None) -> dict:
    """Exporta las memorias que el requester puede conocer (derecho a portabilidad)."""
    rows = _visible_full_rows(db, household_id, req_uid=requester_user_id,
                              req_pid=requester_person_id, req_role=requester_role,
                              include_pending_inferences=False)
    return {"household_id": household_id, "exported_at": _now(),
            "items": [_row_to_item(r) for r in rows]}
