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
) -> str:
    """Inserta una memoria (solo tipos y scopes seguros). Devuelve el id."""
    if memory_type not in SAFE_MEMORY_TYPES:
        raise ValueError(f"memory_type no permitido: {memory_type}")
    # Compat: si llega el flag viejo, traducir a scope.
    if visible_to_household is not None:
        visibility_scope = "household_shared" if visible_to_household else "private_self"
    if visibility_scope not in ALLOWED_SCOPES:
        raise ValueError(f"visibility_scope no permitido: {visibility_scope}")
    content = (content or "").strip()
    if not content:
        raise ValueError("content vacío")
    try:
        imp = max(0.0, min(1.0, float(importance)))
    except (TypeError, ValueError):
        imp = 0.5
    mid = str(uuid.uuid4())
    ts = _now()
    db.execute(
        "INSERT INTO memory_items "
        "(id, person_id, household_id, organization_id, memory_type, content, "
        "importance, consent_scope, visibility_scope, created_by_user_id, created_at, updated_at) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        (mid, person_id, household_id, organization_id, memory_type, content[:2000],
         imp, _consent_for_scope(visibility_scope), visibility_scope,
         created_by_user_id, ts, ts),
    )
    return mid


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
