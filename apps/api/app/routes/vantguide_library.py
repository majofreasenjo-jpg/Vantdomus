"""
VantGuide — Biblioteca de Evidencia + Memoria + Perfil de Apoyo.

Endpoints REST mínimos para las entidades secundarias del modelo (ver
`docs/VANTGUIDE_ARCHITECTURE.md`):

- evidence_items: registrar prueba concreta (foto, voz, confirmación, doc,
  resumen IA, evidencia positiva o NEGATIVA).
- memory_items: memoria estructurada de largo plazo. Vive en VantDomus,
  NUNCA en el modelo de IA. El backend filtra qué memoria llega al prompt.
- person_support_profile: cómo acompañar a la persona — preferencias,
  estilo de comunicación, herramientas de calma. NO es diagnóstico clínico.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..audit import write_audit_log
from ..deps import get_current_user, get_db, require_household_role


# =============================================================================
# Constantes (sync con docs y migración 260_vantguide_core.sql)
# =============================================================================

ALLOWED_EVIDENCE_TYPES = {
    "checkin_confirmed", "checkin_missed", "voice_confirmation",
    "photo_evidence", "caregiver_confirmation", "document_uploaded",
    "assignment_completed", "quiz_completed", "medication_taken",
    "medication_missed", "appointment_attended", "appointment_missed",
    "calm_session_completed", "study_session_completed", "reward_granted",
    "alert_triggered", "ai_summary", "manual_note", "negative_outcome",
    "improvement_detected",
}

ALLOWED_MEMORY_TYPES = {
    "preference", "family_story", "routine_pattern", "health_context",
    "study_pattern", "motivation_pattern", "calm_strategy", "risk_pattern",
    "social_connection", "negative_learning", "improvement", "caregiver_note",
    "operational_context",
}

ALLOWED_ROLES = {"self", "responsible", "household", "doctor_link", "caregiver", "organization"}

ALLOWED_AGE_GROUPS = {"child", "teen", "adult", "senior"}
ALLOWED_COMM_STYLES = {"short", "step_by_step", "warm", "direct", "playful", "formal"}
ALLOWED_SUPERVISION = {"autonomous", "light_reminder", "guided", "accompanied"}
ALLOWED_MOTIVATION = {"rewards", "praise", "progress_bar", "quiet_completion", "competitive", "shared_goal"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _validate_enum(value, allowed: set, field_name: str) -> None:
    if value not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field_name}: '{value}'. Allowed: {sorted(allowed)}",
        )


def _loads(value) -> dict:
    if value is None or value == "":
        return {}
    if isinstance(value, dict):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return {}


def _current_person_id(db, user_id: str, household_id: str):
    """Persona vinculada al usuario logueado en este hogar (o None).

    Habilita la visibilidad por persona: 'self' = lo del propio integrante.
    """
    try:
        row = db.execute(
            "SELECT id FROM persons WHERE household_id=? AND user_id=?",
            (household_id, user_id),
        ).fetchone()
        return row["id"] if row else None
    except Exception:
        # La columna persons.user_id puede no existir en bases muy viejas.
        return None


def _is_visible_to_user(user_role: str, my_person_id, item_person_id, roles_visible) -> bool:
    """Decide si un item (evidencia/memoria) es visible para el usuario actual.

    - owner/admin: ven todo.
    - household: compartido con todo el hogar.
    - self: solo si el item es de la persona del usuario.
    (responsible se trata como no-visible salvo que sea household; la
    resolución fina de responsables se hace a nivel de función.)
    """
    if user_role in ("owner", "admin"):
        return True
    if not roles_visible:
        roles_visible = ["household"]
    if "household" in roles_visible:
        return True
    if "self" in roles_visible and my_person_id and item_person_id == my_person_id:
        return True
    return False


# =============================================================================
# Evidence Library
# =============================================================================

evidence_router = APIRouter(prefix="/library/evidence", tags=["VantGuide:Library"])


class EvidenceCreate(BaseModel):
    household_id: str
    unit_function_id: Optional[str] = None
    function_event_id: Optional[str] = None
    person_id: Optional[str] = None
    evidence_type: str
    text_content: Optional[str] = None
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_mime: Optional[str] = None
    metadata: dict = Field(default_factory=dict)
    confidence: Optional[float] = None
    visible_to_roles: list[str] = Field(default_factory=lambda: ["self", "responsible", "household"])


def log_evidence_internal(
    db,
    *,
    household_id: str,
    organization_id: Optional[str],
    evidence_type: str,
    created_by_user_id: str,
    unit_function_id: Optional[str] = None,
    function_event_id: Optional[str] = None,
    person_id: Optional[str] = None,
    text_content: Optional[str] = None,
    attachment_url: Optional[str] = None,
    attachment_name: Optional[str] = None,
    attachment_mime: Optional[str] = None,
    metadata: Optional[dict] = None,
    confidence: Optional[float] = None,
    visible_to_roles: Optional[list[str]] = None,
) -> str:
    """
    Crea un evidence_item internamente. La usa el asistente, el demo seed
    y los adapters de ingesta (school, prescription, voice).
    """
    _validate_enum(evidence_type, ALLOWED_EVIDENCE_TYPES, "evidence_type")
    roles = visible_to_roles or ["self", "responsible", "household"]
    for r in roles:
        _validate_enum(r, ALLOWED_ROLES, "visible_to_roles")

    ev_id = str(uuid.uuid4())
    ts = _now()
    db.execute(
        "INSERT INTO evidence_items ("
        "id, unit_function_id, function_event_id, person_id, household_id, organization_id, "
        "evidence_type, text_content, attachment_url, attachment_name, attachment_mime, "
        "metadata, confidence, visible_to_roles, created_by_user_id, created_at"
        ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            ev_id, unit_function_id, function_event_id, person_id, household_id, organization_id,
            evidence_type, text_content, attachment_url, attachment_name, attachment_mime,
            json.dumps(metadata or {}, ensure_ascii=False), confidence,
            json.dumps(roles, ensure_ascii=False), created_by_user_id, ts,
        ),
    )
    return ev_id


@evidence_router.post("")
def create_evidence(
    body: EvidenceCreate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Registra un evidence_item. La evidencia NEGATIVA (negative_outcome,
    medication_missed, appointment_missed) es ciudadana de primera clase.
    """
    require_household_role(db, user["user_id"], body.household_id, "member")

    # Resolver organization_id desde el household
    row = db.execute(
        "SELECT organization_id FROM households WHERE id=?",
        (body.household_id,),
    ).fetchone()
    organization_id = row["organization_id"] if row else None

    ev_id = log_evidence_internal(
        db,
        household_id=body.household_id,
        organization_id=organization_id,
        evidence_type=body.evidence_type,
        created_by_user_id=user["user_id"],
        unit_function_id=body.unit_function_id,
        function_event_id=body.function_event_id,
        person_id=body.person_id,
        text_content=body.text_content,
        attachment_url=body.attachment_url,
        attachment_name=body.attachment_name,
        attachment_mime=body.attachment_mime,
        metadata=body.metadata,
        confidence=body.confidence,
        visible_to_roles=body.visible_to_roles,
    )

    write_audit_log(
        db,
        action="evidence.create",
        resource_type="evidence_item",
        resource_id=ev_id,
        household_id=body.household_id,
        user_id=user["user_id"],
        metadata={"evidence_type": body.evidence_type, "person_id": body.person_id},
    )
    db.commit()
    return {"id": ev_id}


@evidence_router.get("")
def list_evidence(
    household_id: str,
    person_id: Optional[str] = None,
    unit_function_id: Optional[str] = None,
    evidence_type: Optional[str] = None,
    limit: int = 100,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Lista evidencia visible para el rol del usuario actual.
    Filtra por `visible_to_roles` según el rol del solicitante.
    """
    user_role = require_household_role(db, user["user_id"], household_id, "viewer")

    sql = "SELECT * FROM evidence_items WHERE household_id=?"
    params: list = [household_id]
    if person_id:
        sql += " AND person_id=?"
        params.append(person_id)
    if unit_function_id:
        sql += " AND unit_function_id=?"
        params.append(unit_function_id)
    if evidence_type:
        _validate_enum(evidence_type, ALLOWED_EVIDENCE_TYPES, "evidence_type")
        sql += " AND evidence_type=?"
        params.append(evidence_type)
    sql += " ORDER BY created_at DESC LIMIT ?"
    params.append(min(limit, 500))

    rows = db.execute(sql, tuple(params)).fetchall()

    # Visibilidad por persona: owner/admin ven todo; un integrante ve lo
    # compartido (household) + lo suyo (self). Resolvemos su persona del hogar.
    my_person_id = _current_person_id(db, user["user_id"], household_id)
    visible_items = []
    for row in rows:
        roles_visible = _loads(row["visible_to_roles"])
        if isinstance(roles_visible, dict):
            roles_visible = ["household"]
        if not roles_visible:
            roles_visible = ["household"]
        if _is_visible_to_user(user_role, my_person_id, row["person_id"], roles_visible):
            d = dict(row)
            # Hidratar JSON a objetos: el cliente espera metadata como objeto
            # (ej. ev.metadata.improvement_pct).
            d["metadata"] = _loads(d.get("metadata"))
            d["visible_to_roles"] = roles_visible
            visible_items.append(d)

    return {"items": visible_items}


@evidence_router.get("/library/{person_id}")
def get_person_library(
    person_id: str,
    household_id: str,
    limit: int = 200,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Biblioteca completa de una persona: timeline de evidencia + memoria
    relevante. Útil para mostrar "todo lo que sabemos de Diego" o
    para generar el Resumen de Cuidado futuro.
    """
    user_role = require_household_role(db, user["user_id"], household_id, "viewer")

    evidence_rows = db.execute(
        "SELECT * FROM evidence_items WHERE person_id=? AND household_id=? "
        "ORDER BY created_at DESC LIMIT ?",
        (person_id, household_id, min(limit, 500)),
    ).fetchall()
    memory_rows = db.execute(
        "SELECT * FROM memory_items WHERE person_id=? AND household_id=? "
        "ORDER BY importance DESC, updated_at DESC LIMIT ?",
        (person_id, household_id, 50),
    ).fetchall()

    # Visibilidad por persona (igual criterio que list_evidence).
    my_person_id = _current_person_id(db, user["user_id"], household_id)

    # Filtrar evidencia por visibilidad
    visible_evidence = []
    for row in evidence_rows:
        roles_visible = _loads(row["visible_to_roles"]) or ["household"]
        if _is_visible_to_user(user_role, my_person_id, row["person_id"], roles_visible):
            d = dict(row)
            d["metadata"] = _loads(d.get("metadata"))
            d["visible_to_roles"] = roles_visible
            visible_evidence.append(d)

    # Filtrar memoria por consent_scope
    visible_memory = []
    for row in memory_rows:
        scope = _loads(row["consent_scope"])
        visible_to = scope.get("visible_to", ["household"]) if isinstance(scope, dict) else ["household"]
        if _is_visible_to_user(user_role, my_person_id, row["person_id"], visible_to):
            d = dict(row)
            if "metadata" in d:
                d["metadata"] = _loads(d.get("metadata"))
            visible_memory.append(d)

    return {
        "person_id": person_id,
        "evidence_items": visible_evidence,
        "memory_items": visible_memory,
        "user_role": user_role,
    }


# =============================================================================
# Memory
# =============================================================================

memory_router = APIRouter(prefix="/library/memory", tags=["VantGuide:Library"])


class MemoryCreate(BaseModel):
    household_id: str
    person_id: Optional[str] = None
    memory_type: str
    content: str
    importance: float = 0.5
    source_event_id: Optional[str] = None
    source_evidence_id: Optional[str] = None
    consent_scope: dict = Field(default_factory=lambda: {"visible_to": ["self", "household"], "shareable_with_doctor": False})
    expires_at: Optional[str] = None


def upsert_memory_internal(
    db,
    *,
    household_id: str,
    organization_id: Optional[str],
    memory_type: str,
    content: str,
    created_by_user_id: str,
    person_id: Optional[str] = None,
    importance: float = 0.5,
    source_event_id: Optional[str] = None,
    source_evidence_id: Optional[str] = None,
    consent_scope: Optional[dict] = None,
    expires_at: Optional[str] = None,
) -> str:
    """Inserta una memoria. La usa el asistente, demo, adapters."""
    _validate_enum(memory_type, ALLOWED_MEMORY_TYPES, "memory_type")
    if not 0.0 <= importance <= 1.0:
        raise HTTPException(status_code=400, detail="importance must be between 0.0 and 1.0")

    mem_id = str(uuid.uuid4())
    ts = _now()
    scope = consent_scope or {"visible_to": ["self", "household"], "shareable_with_doctor": False}

    db.execute(
        "INSERT INTO memory_items ("
        "id, person_id, household_id, organization_id, memory_type, content, importance, "
        "source_event_id, source_evidence_id, consent_scope, expires_at, "
        "created_by_user_id, created_at, updated_at"
        ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            mem_id, person_id, household_id, organization_id, memory_type, content, importance,
            source_event_id, source_evidence_id,
            json.dumps(scope, ensure_ascii=False), expires_at,
            created_by_user_id, ts, ts,
        ),
    )
    return mem_id


@memory_router.post("")
def create_memory(
    body: MemoryCreate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Crea un memory_item. Toda memoria vive en VantDomus, nunca en el modelo
    de IA. El backend controla qué se adjunta al prompt según rol.
    """
    require_household_role(db, user["user_id"], body.household_id, "member")
    row = db.execute("SELECT organization_id FROM households WHERE id=?", (body.household_id,)).fetchone()
    organization_id = row["organization_id"] if row else None

    mem_id = upsert_memory_internal(
        db,
        household_id=body.household_id,
        organization_id=organization_id,
        memory_type=body.memory_type,
        content=body.content,
        created_by_user_id=user["user_id"],
        person_id=body.person_id,
        importance=body.importance,
        source_event_id=body.source_event_id,
        source_evidence_id=body.source_evidence_id,
        consent_scope=body.consent_scope,
        expires_at=body.expires_at,
    )
    write_audit_log(
        db,
        action="memory.create",
        resource_type="memory_item",
        resource_id=mem_id,
        household_id=body.household_id,
        user_id=user["user_id"],
        metadata={"memory_type": body.memory_type, "person_id": body.person_id},
    )
    db.commit()
    return {"id": mem_id}


# =============================================================================
# Person Support Profile
# =============================================================================

profile_router = APIRouter(prefix="/persons", tags=["VantGuide:Library"])


class PersonProfileUpsert(BaseModel):
    household_id: str
    age_group: Optional[str] = None
    role_in_unit: Optional[str] = None
    communication_style: Optional[str] = None
    supervision_level: Optional[str] = None
    motivation_style: Optional[str] = None
    reward_preferences: Optional[list] = None
    sensory_preferences: Optional[dict] = None
    calm_tools: Optional[list] = None
    study_style: Optional[str] = None
    health_notes: Optional[str] = None
    caregiver_notes: Optional[str] = None
    accessibility_needs: Optional[dict] = None
    memory_support_level: Optional[str] = None
    attention_profile: Optional[str] = None
    anxiety_support: Optional[str] = None
    neurodiversity_support: Optional[str] = None
    loneliness_risk: Optional[str] = None
    preferred_voice_profile: Optional[str] = None
    preferred_devices: Optional[list] = None
    consent_version: Optional[str] = None


def upsert_profile_internal(db, person_id: str, household_id: str, organization_id: Optional[str], **kwargs) -> None:
    """Crea o actualiza el perfil. Si no existe, lo crea con defaults."""
    if "age_group" in kwargs and kwargs["age_group"]:
        _validate_enum(kwargs["age_group"], ALLOWED_AGE_GROUPS, "age_group")
    if "communication_style" in kwargs and kwargs["communication_style"]:
        _validate_enum(kwargs["communication_style"], ALLOWED_COMM_STYLES, "communication_style")
    if "supervision_level" in kwargs and kwargs["supervision_level"]:
        _validate_enum(kwargs["supervision_level"], ALLOWED_SUPERVISION, "supervision_level")
    if "motivation_style" in kwargs and kwargs["motivation_style"]:
        _validate_enum(kwargs["motivation_style"], ALLOWED_MOTIVATION, "motivation_style")

    ts = _now()
    existing = db.execute(
        "SELECT person_id FROM person_support_profile WHERE person_id=?",
        (person_id,),
    ).fetchone()

    if not existing:
        db.execute(
            "INSERT INTO person_support_profile ("
            "person_id, household_id, organization_id, age_group, role_in_unit, "
            "communication_style, supervision_level, motivation_style, "
            "reward_preferences, sensory_preferences, calm_tools, study_style, "
            "health_notes, caregiver_notes, accessibility_needs, "
            "memory_support_level, attention_profile, anxiety_support, "
            "neurodiversity_support, loneliness_risk, preferred_voice_profile, "
            "preferred_devices, consent_version, updated_at"
            ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                person_id, household_id, organization_id,
                kwargs.get("age_group"),
                kwargs.get("role_in_unit"),
                kwargs.get("communication_style", "warm"),
                kwargs.get("supervision_level", "light_reminder"),
                kwargs.get("motivation_style", "progress_bar"),
                json.dumps(kwargs.get("reward_preferences", []), ensure_ascii=False),
                json.dumps(kwargs.get("sensory_preferences", {}), ensure_ascii=False),
                json.dumps(kwargs.get("calm_tools", []), ensure_ascii=False),
                kwargs.get("study_style"),
                kwargs.get("health_notes"),
                kwargs.get("caregiver_notes"),
                json.dumps(kwargs.get("accessibility_needs", {}), ensure_ascii=False),
                kwargs.get("memory_support_level"),
                kwargs.get("attention_profile"),
                kwargs.get("anxiety_support"),
                kwargs.get("neurodiversity_support", "not_declared"),
                kwargs.get("loneliness_risk", "low"),
                kwargs.get("preferred_voice_profile"),
                json.dumps(kwargs.get("preferred_devices", []), ensure_ascii=False),
                kwargs.get("consent_version"),
                ts,
            ),
        )
        return

    # UPDATE solo los campos provistos
    sets: list[str] = []
    params: list = []
    JSON_FIELDS = {"reward_preferences", "sensory_preferences", "calm_tools",
                   "accessibility_needs", "preferred_devices"}
    for key, value in kwargs.items():
        if value is None:
            continue
        if key in JSON_FIELDS:
            sets.append(f"{key}=?")
            params.append(json.dumps(value, ensure_ascii=False))
        else:
            sets.append(f"{key}=?")
            params.append(value)
    if not sets:
        return
    sets.append("updated_at=?")
    params.append(ts)
    params.append(person_id)
    db.execute(f"UPDATE person_support_profile SET {', '.join(sets)} WHERE person_id=?", tuple(params))


@profile_router.put("/{person_id}/support_profile")
def upsert_support_profile(
    person_id: str,
    body: PersonProfileUpsert,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Crea o actualiza el perfil de apoyo de una persona."""
    # CP1d-1b.1-R2 (hallazgo 3A) / OPS-1: perfil sensible (health_notes,
    # caregiver_notes, neurodiversidad, ansiedad, accesibilidad) es salud-adyacente
    # → DENIED para todos en AMBOS perfiles familiares (no fue pedido para OPS-1).
    from ..config import is_family_profile
    if is_family_profile():
        raise HTTPException(status_code=403, detail="Perfil de apoyo no disponible en el perfil familiar")
    require_household_role(db, user["user_id"], body.household_id, "member")
    # CP1d-1b.1-R2 (hallazgo 3B): la persona DEBE pertenecer al hogar recibido.
    person = db.execute(
        "SELECT id FROM persons WHERE id=? AND household_id=?",
        (person_id, body.household_id),
    ).fetchone()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found in this household")
    row = db.execute(
        "SELECT organization_id FROM households WHERE id=?",
        (body.household_id,),
    ).fetchone()
    organization_id = row["organization_id"] if row else None

    upsert_profile_internal(
        db,
        person_id=person_id,
        household_id=body.household_id,
        organization_id=organization_id,
        **body.model_dump(exclude={"household_id"}, exclude_unset=True),
    )
    write_audit_log(
        db,
        action="profile.upsert",
        resource_type="person_support_profile",
        resource_id=person_id,
        household_id=body.household_id,
        user_id=user["user_id"],
    )
    db.commit()
    return {"ok": True, "person_id": person_id}


@profile_router.get("/{person_id}/support_profile")
def get_support_profile(
    person_id: str,
    household_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Devuelve el perfil de apoyo. Campos sensibles (`health_notes`,
    `caregiver_notes`) solo se exponen a roles owner/admin o al `self`.
    """
    # CP1d-1b.1-R2 (hallazgo 3A) / OPS-1: DENIED en AMBOS perfiles familiares
    # (salud-adyacente).
    from ..config import is_family_profile
    if is_family_profile():
        raise HTTPException(status_code=403, detail="Perfil de apoyo no disponible en el perfil familiar")
    user_role = require_household_role(db, user["user_id"], household_id, "viewer")
    # CP1d-1b.1-R2 (hallazgo 3B): acotar por hogar; la persona debe pertenecer
    # a household_id (evita fuga entre hogares por person_id suelto).
    person = db.execute(
        "SELECT id FROM persons WHERE id=? AND household_id=?",
        (person_id, household_id),
    ).fetchone()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found in this household")
    row = db.execute(
        "SELECT * FROM person_support_profile WHERE person_id=? AND household_id=?",
        (person_id, household_id),
    ).fetchone()
    if not row:
        return {"person_id": person_id, "exists": False}

    out = dict(row)
    for f in ("reward_preferences", "sensory_preferences", "calm_tools",
              "accessibility_needs", "preferred_devices"):
        out[f] = _loads(out.get(f))

    # Censurar campos sensibles para roles que no son owner/admin/self.
    # CP1d-1b.1-R2 (hallazgo 3B): el vínculo titular es persons.user_id, NO
    # 'linked_user_id' (columna inexistente que causaba 500 a no-admins).
    if user_role not in ("owner", "admin"):
        is_self = db.execute(
            "SELECT 1 FROM persons WHERE id=? AND household_id=? AND user_id=?",
            (person_id, household_id, user["user_id"]),
        ).fetchone() is not None
        if not is_self:
            out["health_notes"] = None
            out["caregiver_notes"] = None

    out["exists"] = True
    return out
