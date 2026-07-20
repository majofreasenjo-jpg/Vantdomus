import os
import shutil
import secrets
import hashlib
import uuid, json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query
from ..deps import get_db, get_current_user, require_household_role, require_verified_email_for_sensitive_action
from ..features import compute_and_store
from ..audit import write_audit_log
from ..rbac import ROLE_RANK
from ..security_events import write_security_event
from ..tenancy import backfill_user_households, ensure_user_default_organization, ensure_household_organization

router = APIRouter(prefix="/households", tags=["Households"])

@router.get("")
def list_households(user=Depends(get_current_user), db=Depends(get_db)):
    try:
        backfill_user_households(db, user["user_id"])
        db.commit()
        cur = db.cursor()
        cur.execute(
            """
            SELECT h.id, h.name, h.organization_id
            FROM households h
            JOIN household_memberships m ON m.household_id=h.id
            WHERE m.user_id=?
            ORDER BY h.created_at DESC
            """,
            (user["user_id"],)
        )
        rows = cur.fetchall()
        return {"items": [{"id": r[0], "name": r[1], "organization_id": r[2]} for r in rows]}
    except Exception as e:
        print(f"ERROR list_households: {e}")
        import traceback
        traceback.print_exc()
        raise e

from pydantic import BaseModel
class TaxonomySettingsUpdate(BaseModel):
    industry_preset: str

class AgentSettingsUpdate(BaseModel):
    user_level: str = "basic"
    autonomy_mode: str = "consult"
    imported_context: str = ""
    active_agents: list[str] = []
    approval_required: bool = True
    audio_input_enabled: bool = True
    audio_output_enabled: bool = True

class MemberCreate(BaseModel):
    email: str
    role: str = "viewer"

class MemberRoleUpdate(BaseModel):
    role: str

class InvitationCreate(BaseModel):
    email: str
    role: str = "viewer"
    ttl_hours: int = 168
    # CP1d-FAMILY-PILOT-1a: vínculo opcional a una persona ya creada del hogar;
    # al aceptar, el nuevo usuario queda enlazado a esa ficha (persons.user_id).
    person_id: str | None = None


class HouseholdBackupRequest(BaseModel):
    # Reautenticación obligatoria: el backup toca la base completa del servidor.
    password: str

class HouseholdProfileUpdate(BaseModel):
    family_name: str | None = None
    industry_preset: str | None = None


@router.patch("/{household_id}/profile")
def update_household_profile(household_id: str, payload: HouseholdProfileUpdate, user=Depends(get_current_user), db=Depends(get_db)):
    """Onboarding: setea el nombre del hogar (meta.family_name) y/o preset."""
    require_household_role(db, user["user_id"], household_id, "admin")
    h = db.execute("SELECT meta FROM households WHERE id=?", (household_id,)).fetchone()
    if not h:
        raise HTTPException(status_code=404, detail="Household not found")
    meta = json.loads(h["meta"] or "{}")
    if payload.family_name is not None:
        name = payload.family_name.strip()[:80]
        if name:
            meta["family_name"] = name
    if payload.industry_preset is not None:
        meta["industry_preset"] = payload.industry_preset
    db.execute("UPDATE households SET meta=? WHERE id=?", (json.dumps(meta, ensure_ascii=False), household_id))
    db.commit()
    return {"ok": True, "family_name": meta.get("family_name"), "industry_preset": meta.get("industry_preset")}


class ModuleVisibilityUpdate(BaseModel):
    # rol mínimo por módulo: viewer|member|admin|owner
    finance: str | None = None
    health: str | None = None
    documents: str | None = None


@router.patch("/{household_id}/module-visibility")
def update_module_visibility(household_id: str, payload: ModuleVisibilityUpdate, user=Depends(get_current_user), db=Depends(get_db)):
    """#17 — quién (rol mínimo) puede ver módulos sensibles (salud/finanzas/docs)."""
    require_household_role(db, user["user_id"], household_id, "admin")
    h = db.execute("SELECT meta FROM households WHERE id=?", (household_id,)).fetchone()
    if not h:
        raise HTTPException(status_code=404, detail="Household not found")
    meta = json.loads(h["meta"] or "{}")
    mv = meta.get("module_visibility") or {}
    valid = {"viewer", "member", "admin", "owner"}
    for mod in ("finance", "health", "documents"):
        val = getattr(payload, mod)
        if val is not None and val in valid:
            mv[mod] = val
    meta["module_visibility"] = mv
    db.execute("UPDATE households SET meta=? WHERE id=?", (json.dumps(meta, ensure_ascii=False), household_id))
    db.commit()
    return {"ok": True, "module_visibility": mv}


@router.patch("/{household_id}/settings/taxonomy")
def update_taxonomy(household_id: str, payload: TaxonomySettingsUpdate, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "admin")
    h = db.execute("SELECT meta FROM households WHERE id=?", (household_id,)).fetchone()
    if not h:
        raise HTTPException(status_code=404, detail="Household not found")
        
    meta = json.loads(h["meta"] or "{}")
    meta["industry_preset"] = payload.industry_preset
    
    db.execute("UPDATE households SET meta=? WHERE id=?", (json.dumps(meta), household_id))
    db.commit()
    return {"ok": True, "industry_preset": payload.industry_preset}


def _default_agent_settings(industry: str) -> dict:
    is_family = industry == "family"
    return {
        "user_level": "basic" if is_family else "medium",
        "autonomy_mode": "consult",
        "imported_context": "",
        "approval_required": True,
        "audio_input_enabled": True,
        "audio_output_enabled": True,
        "active_agents": (
            ["family_orchestrator", "school_planner", "budget_guard", "document_guard", "wellbeing_guard"]
            if is_family
            else ["executive_orchestrator", "document_forensic", "finance_controller", "task_planner"]
        ),
    }


@router.get("/{household_id}/settings/agents")
def get_agent_settings(household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "viewer")
    h = db.execute("SELECT meta FROM households WHERE id=?", (household_id,)).fetchone()
    if not h:
        raise HTTPException(status_code=404, detail="Household not found")
    meta = json.loads(h["meta"] or "{}")
    industry = meta.get("industry_preset", "default")
    settings = _default_agent_settings(industry)
    settings.update(meta.get("agent_settings") or {})
    return {"agent_settings": settings, "industry_preset": industry}


@router.patch("/{household_id}/settings/agents")
def update_agent_settings(household_id: str, payload: AgentSettingsUpdate, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "admin")
    h = db.execute("SELECT meta, organization_id FROM households WHERE id=?", (household_id,)).fetchone()
    if not h:
        raise HTTPException(status_code=404, detail="Household not found")

    user_level = (payload.user_level or "basic").strip().lower()
    autonomy_mode = (payload.autonomy_mode or "consult").strip().lower()
    if user_level not in {"basic", "medium", "advanced"}:
        raise HTTPException(status_code=400, detail="Invalid user level")
    if autonomy_mode not in {"consult", "analyze", "execute", "forensic", "automatic"}:
        raise HTTPException(status_code=400, detail="Invalid autonomy mode")
    if user_level != "advanced" and autonomy_mode == "automatic":
        raise HTTPException(status_code=400, detail="Automatic mode requires advanced level")

    meta = json.loads(h["meta"] or "{}")
    settings = _default_agent_settings(meta.get("industry_preset", "default"))
    settings.update({
        "user_level": user_level,
        "autonomy_mode": autonomy_mode,
        "imported_context": (payload.imported_context or "")[:6000],
        "active_agents": payload.active_agents or settings["active_agents"],
        "approval_required": bool(payload.approval_required),
        "audio_input_enabled": bool(payload.audio_input_enabled),
        "audio_output_enabled": bool(payload.audio_output_enabled),
    })
    meta["agent_settings"] = settings
    db.execute("UPDATE households SET meta=? WHERE id=?", (json.dumps(meta, ensure_ascii=False), household_id))
    write_audit_log(
        db,
        action="update_agent_settings",
        resource_type="household_agent_settings",
        household_id=household_id,
        organization_id=h["organization_id"],
        user_id=user["user_id"],
        resource_id=household_id,
        metadata={
            "user_level": user_level,
            "autonomy_mode": autonomy_mode,
            "active_agents": settings["active_agents"],
            "approval_required": settings["approval_required"],
            "audio_input_enabled": settings["audio_input_enabled"],
            "audio_output_enabled": settings["audio_output_enabled"],
        },
    )
    db.commit()
    return {"ok": True, "agent_settings": settings}


def now():
    return datetime.now(timezone.utc).isoformat()


def _household_organization_id(db, household_id: str) -> str | None:
    row = db.execute("SELECT organization_id FROM households WHERE id=?", (household_id,)).fetchone()
    return row["organization_id"] if row else None


def _email_fingerprint(email: str) -> str:
    return hashlib.sha256((email or "").strip().lower().encode("utf-8")).hexdigest()


SENSITIVE_EXPORT_FIELDS = {"auth_token", "token", "token_hash", "file_path", "attachment_path"}

HOUSEHOLD_EXPORT_QUERIES = {
    "households": ("SELECT * FROM households WHERE id=?", ()),
    "household_memberships": ("SELECT household_id, user_id, role, created_at FROM household_memberships WHERE household_id=?", ()),
    "household_invitations": ("SELECT * FROM household_invitations WHERE household_id=? ORDER BY created_at", ()),
    "persons": ("SELECT * FROM persons WHERE household_id=? ORDER BY created_at", ()),
    "adherence_plans": ("SELECT * FROM adherence_plans WHERE household_id=? ORDER BY updated_at", ()),
    "medication_state": ("SELECT * FROM medication_state WHERE household_id=? ORDER BY last_checkin_at", ()),
    "events": ("SELECT * FROM events WHERE household_id=? ORDER BY occurred_at", ()),
    "event_actors": (
        """
        SELECT ea.*
        FROM event_actors ea
        JOIN events e ON e.id=ea.event_id
        WHERE e.household_id=?
        ORDER BY ea.event_id
        """,
        (),
    ),
    "alerts": ("SELECT * FROM alerts WHERE household_id=? ORDER BY created_at", ()),
    "task_items": ("SELECT * FROM task_items WHERE household_id=? ORDER BY created_at", ()),
    "expenses": ("SELECT * FROM expenses WHERE household_id=? ORDER BY created_at", ()),
    "features_daily": ("SELECT * FROM features_daily WHERE household_id=? ORDER BY feature_date", ()),
    "state_snapshot": ("SELECT * FROM state_snapshot WHERE household_id=? ORDER BY computed_at", ()),
    "assistant_recommendations": ("SELECT * FROM assistant_recommendations WHERE household_id=? ORDER BY created_at", ()),
    "device_tokens": ("SELECT * FROM device_tokens WHERE household_id=? ORDER BY created_at", ()),
    "notification_targets": ("SELECT * FROM notification_targets WHERE household_id=? ORDER BY created_at", ()),
    "notification_outbox": ("SELECT * FROM notification_outbox WHERE household_id=? ORDER BY created_at", ()),
    "logbook_entries": ("SELECT * FROM logbook_entries WHERE household_id=? ORDER BY created_at", ()),
    "coupling_gateways": ("SELECT * FROM coupling_gateways WHERE household_id=? ORDER BY created_at", ()),
    "webhook_ingest_log": ("SELECT * FROM webhook_ingest_log WHERE household_id=? ORDER BY created_at", ()),
    "signed_file_tokens": ("SELECT * FROM signed_file_tokens WHERE household_id=? ORDER BY created_at", ()),
    "security_events": ("SELECT * FROM security_events WHERE household_id=? ORDER BY created_at", ()),
    "audit_log": ("SELECT * FROM audit_log WHERE household_id=? ORDER BY created_at", ()),
    "assistant_action_log": ("SELECT * FROM assistant_action_log WHERE household_id=? ORDER BY created_at", ()),
}

HOUSEHOLD_DELETE_QUERIES = [
    ("signed_file_tokens", "DELETE FROM signed_file_tokens WHERE household_id=?"),
    ("webhook_ingest_log", "DELETE FROM webhook_ingest_log WHERE household_id=?"),
    ("notification_outbox", "DELETE FROM notification_outbox WHERE household_id=?"),
    ("notification_targets", "DELETE FROM notification_targets WHERE household_id=?"),
    ("device_tokens", "DELETE FROM device_tokens WHERE household_id=?"),
    ("assistant_action_log", "DELETE FROM assistant_action_log WHERE household_id=?"),
    ("security_events", "DELETE FROM security_events WHERE household_id=?"),
    ("audit_log", "DELETE FROM audit_log WHERE household_id=?"),
    ("assistant_recommendations", "DELETE FROM assistant_recommendations WHERE household_id=?"),
    ("state_snapshot", "DELETE FROM state_snapshot WHERE household_id=?"),
    ("features_daily", "DELETE FROM features_daily WHERE household_id=?"),
    ("expenses", "DELETE FROM expenses WHERE household_id=?"),
    ("task_items", "DELETE FROM task_items WHERE household_id=?"),
    ("alerts", "DELETE FROM alerts WHERE household_id=?"),
    ("event_actors", "DELETE FROM event_actors WHERE event_id IN (SELECT id FROM events WHERE household_id=?)"),
    ("events", "DELETE FROM events WHERE household_id=?"),
    ("adherence_plans", "DELETE FROM adherence_plans WHERE household_id=?"),
    ("medication_state", "DELETE FROM medication_state WHERE household_id=?"),
    ("persons", "DELETE FROM persons WHERE household_id=?"),
    ("logbook_entries", "DELETE FROM logbook_entries WHERE household_id=?"),
    ("coupling_gateways", "DELETE FROM coupling_gateways WHERE household_id=?"),
    ("household_invitations", "DELETE FROM household_invitations WHERE household_id=?"),
    ("household_memberships", "DELETE FROM household_memberships WHERE household_id=?"),
    ("households", "DELETE FROM households WHERE id=?"),
]


def _private_upload_root() -> Path:
    return Path(os.getenv("VANTDOMUS_PRIVATE_UPLOAD_DIR", "private_uploads")).resolve()


def _row_to_export(row):
    item = dict(row)
    for key in SENSITIVE_EXPORT_FIELDS:
        if key in item and item[key]:
            item[key] = "[redacted]"
    return item


def _fetch_export_rows(db, household_id: str, table: str, sql: str):
    try:
        return [_row_to_export(row) for row in db.execute(sql, (household_id,)).fetchall()]
    except Exception as exc:
        return [{"export_error": f"{table}: {exc.__class__.__name__}"}]


def _collect_private_paths(db, household_id: str) -> list[Path]:
    paths: list[Path] = []
    for row in db.execute(
        """
        SELECT attachment_path AS path FROM logbook_entries WHERE household_id=? AND attachment_path IS NOT NULL
        UNION
        SELECT file_path AS path FROM signed_file_tokens WHERE household_id=? AND file_path IS NOT NULL
        """,
        (household_id, household_id),
    ).fetchall():
        if row["path"]:
            paths.append(Path(row["path"]))
    return paths


def _purge_private_files(organization_id: str | None, household_id: str, explicit_paths: list[Path]) -> dict:
    root = _private_upload_root()
    deleted_files = 0
    deleted_dirs = 0

    for candidate in explicit_paths:
        try:
            resolved = candidate.resolve()
            if root in resolved.parents and resolved.is_file():
                resolved.unlink()
                deleted_files += 1
        except OSError:
            continue

    household_dirs = []
    if organization_id:
        household_dirs.append(root / organization_id / household_id)
        household_dirs.append(root / "vision" / organization_id / household_id)

    for directory in household_dirs:
        try:
            resolved_dir = directory.resolve()
            if root in resolved_dir.parents and resolved_dir.exists():
                shutil.rmtree(resolved_dir)
                deleted_dirs += 1
        except OSError:
            continue

    return {"deleted_files": deleted_files, "deleted_directories": deleted_dirs}


def _validate_member_role(role: str) -> str:
    normalized = (role or "").strip().lower()
    if normalized not in ROLE_RANK:
        raise HTTPException(status_code=400, detail="Invalid role")
    return normalized


def _require_owner_for_owner_role(db, actor_user_id: str, household_id: str, target_role: str) -> None:
    if target_role == "owner":
        require_household_role(db, actor_user_id, household_id, "owner")


def _require_owner_to_change_owner(db, actor_user_id: str, household_id: str, target_user_id: str) -> None:
    target = db.execute(
        "SELECT role FROM household_memberships WHERE household_id=? AND user_id=?",
        (household_id, target_user_id),
    ).fetchone()
    if target and target["role"] == "owner":
        require_household_role(db, actor_user_id, household_id, "owner")


def _owner_count(db, household_id: str) -> int:
    row = db.execute(
        "SELECT COUNT(*) AS c FROM household_memberships WHERE household_id=? AND role='owner'",
        (household_id,),
    ).fetchone()
    return int(row["c"] if row else 0)


def _prevent_last_owner_change(db, household_id: str, target_user_id: str, next_role: str | None = None) -> None:
    target = db.execute(
        "SELECT role FROM household_memberships WHERE household_id=? AND user_id=?",
        (household_id, target_user_id),
    ).fetchone()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")
    if target["role"] == "owner" and next_role != "owner" and _owner_count(db, household_id) <= 1:
        raise HTTPException(status_code=400, detail="Cannot remove or demote the last owner")


def _hash_invitation_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _parse_iso(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _presence_status(last_seen_at: str | None) -> str:
    if not last_seen_at:
        return "offline"
    try:
        seen = _parse_iso(last_seen_at)
    except ValueError:
        return "offline"
    minutes = (datetime.now(timezone.utc) - seen).total_seconds() / 60
    if minutes <= 5:
        return "online"
    if minutes <= 30:
        return "recent"
    return "offline"


@router.get("/{household_id}/members")
def list_members(household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "viewer")
    rows = db.execute(
        """
        SELECT
          m.user_id,
          u.email,
          m.role,
          m.created_at,
          MAX(s.last_seen_at) AS last_seen_at,
          SUM(CASE WHEN s.revoked_at IS NULL AND s.expires_at > ? THEN 1 ELSE 0 END) AS active_sessions
        FROM household_memberships m
        JOIN users u ON u.id=m.user_id
        LEFT JOIN auth_sessions s ON s.user_id=m.user_id
        WHERE m.household_id=?
        GROUP BY m.user_id, u.email, m.role, m.created_at
        ORDER BY ROLE_RANK(m.role), u.email
        """.replace("ROLE_RANK(m.role)", "CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'member' THEN 2 ELSE 3 END"),
        (now(), household_id),
    ).fetchall()
    return {
        "items": [
            {
                "user_id": row["user_id"],
                "email": row["email"],
                "role": row["role"],
                "created_at": row["created_at"],
                "last_seen_at": row["last_seen_at"],
                "active_sessions": int(row["active_sessions"] or 0),
                "presence": _presence_status(row["last_seen_at"]),
            }
            for row in rows
        ]
    }


@router.post("/{household_id}/members")
def add_member(household_id: str, payload: MemberCreate, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "admin")
    require_verified_email_for_sensitive_action(db, user["user_id"])
    role = _validate_member_role(payload.role)
    _require_owner_for_owner_role(db, user["user_id"], household_id, role)
    email = payload.email.strip().lower()
    target = db.execute("SELECT id, email FROM users WHERE email=?", (email,)).fetchone()
    if not target:
        raise HTTPException(status_code=404, detail="Target user must register before being added")
    existing = db.execute(
        "SELECT role FROM household_memberships WHERE household_id=? AND user_id=?",
        (household_id, target["id"]),
    ).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="User is already a household member")

    db.execute(
        "INSERT INTO household_memberships (household_id, user_id, role, created_at) VALUES (?, ?, ?, ?)",
        (household_id, target["id"], role, now()),
    )
    write_audit_log(
        db,
        action="add_member",
        resource_type="household_member",
        household_id=household_id,
        user_id=user["user_id"],
        resource_id=target["id"],
        metadata={"email": target["email"], "role": role},
    )
    write_security_event(
        db,
        event_type="household_member_added",
        severity="high" if role == "owner" else "medium",
        source="household_membership",
        household_id=household_id,
        organization_id=_household_organization_id(db, household_id),
        user_id=user["user_id"],
        metadata={"target_user_id": target["id"], "email_fingerprint": _email_fingerprint(target["email"]), "role": role},
    )
    db.commit()
    return {"ok": True, "user_id": target["id"], "email": target["email"], "role": role}


@router.get("/{household_id}/invitations")
def list_invitations(household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "admin")
    rows = db.execute(
        """
        SELECT id, email, role, invited_by_user_id, accepted_by_user_id, created_at, expires_at, accepted_at, revoked_at
        FROM household_invitations
        WHERE household_id=?
        ORDER BY created_at DESC
        """,
        (household_id,),
    ).fetchall()
    return {
        "items": [
            {
                "id": row["id"],
                "email": row["email"],
                "role": row["role"],
                "invited_by_user_id": row["invited_by_user_id"],
                "accepted_by_user_id": row["accepted_by_user_id"],
                "created_at": row["created_at"],
                "expires_at": row["expires_at"],
                "accepted_at": row["accepted_at"],
                "revoked_at": row["revoked_at"],
            }
            for row in rows
        ]
    }


@router.post("/{household_id}/invitations")
def create_invitation(household_id: str, payload: InvitationCreate, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "admin")
    require_verified_email_for_sensitive_action(db, user["user_id"])
    role = _validate_member_role(payload.role)
    _require_owner_for_owner_role(db, user["user_id"], household_id, role)
    h = db.execute("SELECT organization_id FROM households WHERE id=?", (household_id,)).fetchone()
    if not h:
        raise HTTPException(status_code=404, detail="Household not found")
    email = payload.email.strip().lower()
    from app.rate_limit import enforce_action_limit
    enforce_action_limit("invitation_create", user["user_id"])
    person_id = (payload.person_id or "").strip() or None
    # CP1d-1b.1 — validador COMPARTIDO (etapa de creación): banda, tutela y
    # consentimiento se validan aquí y SE RE-VALIDAN en cada aceptación.
    # En family-pilot la ficha es obligatoria.
    from app.config import is_family_pilot
    from app.minor_guardian_policy import validate_invitation_person_policy
    policy = validate_invitation_person_policy(
        db,
        household_id=household_id,
        person_id=person_id,
        role=role,
        require_person=is_family_pilot(),
    )
    ttl_hours = max(1, min(int(payload.ttl_hours or 168), 24 * 30))
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=ttl_hours)).isoformat()
    raw_token = secrets.token_urlsafe(32)
    invitation_id = str(uuid.uuid4())
    db.execute(
        """
        INSERT INTO household_invitations (
          id, household_id, organization_id, email, role, token_hash, invited_by_user_id,
          created_at, expires_at, accepted_at, revoked_at, person_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
        """,
        (
            invitation_id,
            household_id,
            h["organization_id"],
            email,
            role,
            _hash_invitation_token(raw_token),
            user["user_id"],
            now(),
            expires_at,
            person_id,
        ),
    )
    # CP1d-1b.1 — auditoría SIN PII: fingerprint en lugar de email en claro.
    write_audit_log(
        db,
        action="create_invitation",
        resource_type="household_invitation",
        household_id=household_id,
        user_id=user["user_id"],
        resource_id=invitation_id,
        metadata={
            "email_fingerprint": _email_fingerprint(email),
            "role": role,
            "expires_at": expires_at,
            "person_id": person_id,
            "age_band": policy.get("age_band"),
            "relationship_id": policy.get("relationship_id"),
            "consent_id": policy.get("consent_id"),
        },
    )
    write_security_event(
        db,
        event_type="household_invitation_created",
        severity="high" if role == "owner" else "medium",
        source="household_invitation",
        household_id=household_id,
        organization_id=h["organization_id"],
        user_id=user["user_id"],
        metadata={
            "invitation_id": invitation_id,
            "email_fingerprint": _email_fingerprint(email),
            "role": role,
            "expires_at": expires_at,
            "ttl_hours": ttl_hours,
        },
    )
    db.commit()
    return {
        "id": invitation_id,
        "email": email,
        "role": role,
        "token": raw_token,
        "expires_at": expires_at,
    }


@router.post("/invitations/{token}/accept")
def accept_invitation(token: str, user=Depends(get_current_user), db=Depends(get_db)):
    from app.rate_limit import enforce_action_limit
    enforce_action_limit("invitation_accept", user["user_id"])
    token_hash = _hash_invitation_token(token)
    invitation = db.execute(
        """
        SELECT id, household_id, organization_id, email, role, expires_at, accepted_at, revoked_at, person_id
        FROM household_invitations
        WHERE token_hash=?
        """,
        (token_hash,),
    ).fetchone()
    if not invitation or invitation["revoked_at"]:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if invitation["accepted_at"]:
        raise HTTPException(status_code=400, detail="Invitation already accepted")
    if _parse_iso(invitation["expires_at"]) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Invitation expired")
    if (user.get("email") or "").strip().lower() != invitation["email"]:
        raise HTTPException(status_code=403, detail="Invitation email does not match current user")

    existing = db.execute(
        "SELECT role FROM household_memberships WHERE household_id=? AND user_id=?",
        (invitation["household_id"], user["user_id"]),
    ).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="User is already a household member")

    # CP1d-1b.1 — MISMA política que register_with_invitation (una cuenta
    # preexistente NO puede evadir banda/tutela/consentimiento/rol/aislamiento).
    # Se RE-VALIDA TODO dentro de la transacción: las condiciones pueden haber
    # cambiado desde que se creó la invitación. El rol usado es SIEMPRE el
    # persistido en la invitación.
    from app.config import is_family_pilot
    from app.minor_guardian_policy import validate_invitation_person_policy
    linked_person_id = None
    try:
        policy = validate_invitation_person_policy(
            db,
            household_id=invitation["household_id"],
            person_id=invitation["person_id"],
            role=invitation["role"],
            require_person=is_family_pilot(),
        )
        # Guardia de concurrencia: solo UNA transacción consuma la invitación.
        accepted_at = now()
        cur = db.execute(
            """
            UPDATE household_invitations SET accepted_by_user_id=?, accepted_at=?
            WHERE id=? AND accepted_at IS NULL AND revoked_at IS NULL
            """,
            (user["user_id"], accepted_at, invitation["id"]),
        )
        if cur.rowcount != 1:
            raise HTTPException(status_code=400, detail="Invitation already accepted")
        db.execute(
            "INSERT INTO household_memberships (household_id, user_id, role, created_at) VALUES (?, ?, ?, ?)",
            (invitation["household_id"], user["user_id"], invitation["role"], now()),
        )
        # Ficha ligada: DEBE poder enlazarse; si está ocupada, FALLO ATÓMICO
        # (jamás se enlaza en silencio ni se consume la invitación a medias).
        if invitation["person_id"]:
            cur = db.execute(
                "UPDATE persons SET user_id=? WHERE id=? AND household_id=? AND user_id IS NULL",
                (user["user_id"], invitation["person_id"], invitation["household_id"]),
            )
            if cur.rowcount != 1:
                raise HTTPException(
                    status_code=409,
                    detail="La invitación no pudo completarse. Pide una nueva al administrador del hogar.",
                )
            linked_person_id = invitation["person_id"]
        write_audit_log(
            db,
            action="accept_invitation",
            resource_type="household_invitation",
            household_id=invitation["household_id"],
            user_id=user["user_id"],
            resource_id=invitation["id"],
            metadata={
                "email_fingerprint": _email_fingerprint(invitation["email"]),
                "role": invitation["role"],
                "linked_person_id": linked_person_id,
                "age_band": policy.get("age_band"),
                "relationship_id": policy.get("relationship_id"),
                "consent_id": policy.get("consent_id"),
            },
        )
    except Exception:
        db.rollback()
        raise
    write_security_event(
        db,
        event_type="household_invitation_accepted",
        severity="high" if invitation["role"] == "owner" else "medium",
        source="household_invitation",
        household_id=invitation["household_id"],
        organization_id=invitation["organization_id"],
        user_id=user["user_id"],
        metadata={
            "invitation_id": invitation["id"],
            "email_fingerprint": _email_fingerprint(invitation["email"]),
            "role": invitation["role"],
            "accepted_by_user_id": user["user_id"],
        },
    )
    db.commit()
    return {
        "ok": True,
        "household_id": invitation["household_id"],
        "role": invitation["role"],
        "linked_person_id": linked_person_id,
    }


@router.post("/{household_id}/invitations/{invitation_id}/revoke")
def revoke_invitation(household_id: str, invitation_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "admin")
    invitation = db.execute(
        "SELECT id, email, role, accepted_at, revoked_at FROM household_invitations WHERE id=? AND household_id=?",
        (invitation_id, household_id),
    ).fetchone()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if invitation["accepted_at"]:
        raise HTTPException(status_code=400, detail="Accepted invitations cannot be revoked")
    revoked_at = invitation["revoked_at"] or now()
    db.execute("UPDATE household_invitations SET revoked_at=? WHERE id=?", (revoked_at, invitation_id))
    write_audit_log(
        db,
        action="revoke_invitation",
        resource_type="household_invitation",
        household_id=household_id,
        user_id=user["user_id"],
        resource_id=invitation_id,
        metadata={"email_fingerprint": _email_fingerprint(invitation["email"]), "role": invitation["role"], "revoked_at": revoked_at},
    )
    write_security_event(
        db,
        event_type="household_invitation_revoked",
        severity="high" if invitation["role"] == "owner" else "medium",
        source="household_invitation",
        household_id=household_id,
        organization_id=_household_organization_id(db, household_id),
        user_id=user["user_id"],
        metadata={
            "invitation_id": invitation_id,
            "email_fingerprint": _email_fingerprint(invitation["email"]),
            "role": invitation["role"],
            "revoked_at": revoked_at,
        },
    )
    db.commit()
    return {"ok": True, "revoked_at": revoked_at}


@router.patch("/{household_id}/members/{target_user_id}")
def update_member_role(
    household_id: str,
    target_user_id: str,
    payload: MemberRoleUpdate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_household_role(db, user["user_id"], household_id, "admin")
    role = _validate_member_role(payload.role)
    _require_owner_for_owner_role(db, user["user_id"], household_id, role)
    _require_owner_to_change_owner(db, user["user_id"], household_id, target_user_id)
    _prevent_last_owner_change(db, household_id, target_user_id, next_role=role)
    current = db.execute(
        "SELECT role FROM household_memberships WHERE household_id=? AND user_id=?",
        (household_id, target_user_id),
    ).fetchone()
    db.execute(
        "UPDATE household_memberships SET role=? WHERE household_id=? AND user_id=?",
        (role, household_id, target_user_id),
    )
    write_audit_log(
        db,
        action="update_member_role",
        resource_type="household_member",
        household_id=household_id,
        user_id=user["user_id"],
        resource_id=target_user_id,
        metadata={"from_role": current["role"], "to_role": role},
    )
    write_security_event(
        db,
        event_type="household_member_role_changed",
        severity="high" if current["role"] == "owner" or role == "owner" else "medium",
        source="household_membership",
        household_id=household_id,
        organization_id=_household_organization_id(db, household_id),
        user_id=user["user_id"],
        metadata={"target_user_id": target_user_id, "from_role": current["role"], "to_role": role},
    )
    db.commit()
    return {"ok": True, "user_id": target_user_id, "role": role}


@router.delete("/{household_id}/members/{target_user_id}")
def remove_member(household_id: str, target_user_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "admin")
    _require_owner_to_change_owner(db, user["user_id"], household_id, target_user_id)
    _prevent_last_owner_change(db, household_id, target_user_id)
    target = db.execute(
        """
        SELECT m.role, u.email
        FROM household_memberships m
        JOIN users u ON u.id=m.user_id
        WHERE m.household_id=? AND m.user_id=?
        """,
        (household_id, target_user_id),
    ).fetchone()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")
    db.execute(
        "DELETE FROM household_memberships WHERE household_id=? AND user_id=?",
        (household_id, target_user_id),
    )
    write_audit_log(
        db,
        action="remove_member",
        resource_type="household_member",
        household_id=household_id,
        user_id=user["user_id"],
        resource_id=target_user_id,
        metadata={"email": target["email"], "role": target["role"]},
    )
    write_security_event(
        db,
        event_type="household_member_removed",
        severity="high" if target["role"] == "owner" else "medium",
        source="household_membership",
        household_id=household_id,
        organization_id=_household_organization_id(db, household_id),
        user_id=user["user_id"],
        metadata={"target_user_id": target_user_id, "email_fingerprint": _email_fingerprint(target["email"]), "role": target["role"]},
    )
    db.commit()
    return {"ok": True, "user_id": target_user_id}

@router.post("")
def create_household(name: str, user=Depends(get_current_user), db=Depends(get_db)):
    hid = str(uuid.uuid4())
    organization_id = ensure_user_default_organization(db, user["user_id"], name=f"{name} Organization")
    db.execute("INSERT INTO households (id,name,meta,created_at,organization_id) VALUES (?,?,?,?,?)",
               (hid, name, json.dumps({"mode":"home","monthly_budget":0}), now(), organization_id))
    db.execute("INSERT INTO household_memberships (household_id,user_id,role,created_at) VALUES (?,?,?,?)",
               (hid, user["user_id"], "owner", now()))
    write_audit_log(
        db,
        action="create",
        resource_type="household",
        household_id=hid,
        user_id=user["user_id"],
        resource_id=hid,
        metadata={"organization_id": organization_id, "name": name},
    )
    db.commit()
    return {"id": hid, "organization_id": organization_id}


@router.get("/{household_id}/export")
def export_household_data(household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "admin")
    require_verified_email_for_sensitive_action(db, user["user_id"])
    h = db.execute("SELECT id, name, organization_id FROM households WHERE id=?", (household_id,)).fetchone()
    if not h:
        raise HTTPException(status_code=404, detail="Household not found")

    export = {
        "metadata": {
            "household_id": household_id,
            "household_name": h["name"],
            "organization_id": h["organization_id"],
            "exported_at": now(),
            "exported_by_user_id": user["user_id"],
            "sensitive_fields": "auth tokens, push tokens, signed token hashes and private file paths are redacted",
        },
        "tables": {},
    }
    counts = {}
    for table, (sql, _) in HOUSEHOLD_EXPORT_QUERIES.items():
        rows = _fetch_export_rows(db, household_id, table, sql)
        export["tables"][table] = rows
        counts[table] = len(rows)

    write_audit_log(
        db,
        action="export_household_data",
        resource_type="household",
        household_id=household_id,
        user_id=user["user_id"],
        resource_id=household_id,
        organization_id=h["organization_id"],
        metadata={"table_counts": counts},
    )
    write_security_event(
        db,
        event_type="household_data_exported",
        severity="high",
        source="household_export",
        household_id=household_id,
        organization_id=h["organization_id"],
        user_id=user["user_id"],
        metadata={"table_counts": counts},
    )
    db.commit()
    return export


@router.delete("/{household_id}")
def delete_household_data(
    household_id: str,
    confirm: str = Query(""),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_household_role(db, user["user_id"], household_id, "owner")
    require_verified_email_for_sensitive_action(db, user["user_id"])
    if confirm != "DELETE":
        raise HTTPException(status_code=400, detail="Deletion requires confirm=DELETE")

    h = db.execute("SELECT id, name, organization_id FROM households WHERE id=?", (household_id,)).fetchone()
    if not h:
        raise HTTPException(status_code=404, detail="Household not found")

    organization_id = h["organization_id"]
    private_paths = _collect_private_paths(db, household_id)
    file_cleanup = _purge_private_files(organization_id, household_id, private_paths)
    deleted_counts = {}
    member_user_ids = [
        row["user_id"]
        for row in db.execute(
            "SELECT user_id FROM household_memberships WHERE household_id=?",
            (household_id,),
        ).fetchall()
    ]
    revoked_at = now()
    revoked_sessions = 0
    for member_user_id in member_user_ids:
        cur = db.execute(
            "UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL",
            (revoked_at, member_user_id),
        )
        revoked_sessions += max(cur.rowcount, 0)
    deleted_counts["auth_sessions_revoked"] = revoked_sessions

    for table, sql in HOUSEHOLD_DELETE_QUERIES:
        cur = db.execute(sql, (household_id,))
        deleted_counts[table] = max(cur.rowcount, 0)

    write_audit_log(
        db,
        action="delete_household_data",
        resource_type="household",
        household_id=household_id,
        user_id=user["user_id"],
        resource_id=household_id,
        organization_id=organization_id,
        metadata={
            "household_name": h["name"],
            "deleted_counts": deleted_counts,
            "file_cleanup": file_cleanup,
        },
    )
    write_security_event(
        db,
        event_type="household_data_deleted",
        severity="critical",
        source="contractual_delete",
        household_id=household_id,
        organization_id=organization_id,
        user_id=user["user_id"],
        metadata={
            "household_name": h["name"],
            "deleted_counts": deleted_counts,
            "file_cleanup": file_cleanup,
        },
    )
    db.commit()
    return {"ok": True, "household_id": household_id, "deleted_counts": deleted_counts, "file_cleanup": file_cleanup}


@router.get("/{household_id}/dashboard")
def dashboard(household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "viewer")
    ensure_household_organization(db, household_id, user["user_id"])
    db.commit()
    h = db.execute("SELECT id,name,meta,created_at,organization_id FROM households WHERE id=?", (household_id,)).fetchone()
    if not h:
        raise HTTPException(status_code=404, detail="Household not found")

    persons = db.execute("SELECT id, display_name, relation, avatar, status_emoji, status_text, status_set_at FROM persons WHERE household_id=? ORDER BY display_name", (household_id,)).fetchall()
    alerts = db.execute("SELECT id,severity,title,message,status,created_at FROM alerts WHERE household_id=? ORDER BY created_at DESC LIMIT 50", (household_id,)).fetchall()
    events = db.execute("SELECT id,domain,event_type,summary,occurred_at FROM events WHERE household_id=? ORDER BY occurred_at DESC LIMIT 50", (household_id,)).fetchall()

    # compute scores/features (persist)
    features = compute_and_store(db, household_id)

    # assistant open recos
    recos = db.execute("""
      SELECT id, kind, title, rationale, impact, payload, created_at
      FROM assistant_recommendations
      WHERE household_id=? AND status='open'
      ORDER BY created_at DESC
      LIMIT 10
    """, (household_id,)).fetchall()
    assistant = []
    for r in recos:
        assistant.append({
            "id": r["id"], "kind": r["kind"], "title": r["title"], "rationale": r["rationale"],
            "impact": int(r["impact"]), "payload": json.loads(r["payload"] or "{}"),
            "created_at": r["created_at"],
        })

    me_role = None
    try:
        mr = db.execute("SELECT role FROM household_memberships WHERE household_id=? AND user_id=?", (household_id, user["user_id"])).fetchone()
        me_role = mr["role"] if mr else None
    except Exception:
        me_role = None

    return {
        "household": {"id": h["id"], "name": h["name"], "meta": json.loads(h["meta"] or "{}"), "created_at": h["created_at"], "organization_id": h["organization_id"]},
        "me": {"role": me_role},
        "features": features,
        "assistant": assistant,
        "persons": [{"id": p["id"], "display_name": p["display_name"], "relation": p["relation"], "avatar": p["avatar"], "status_emoji": p["status_emoji"], "status_text": p["status_text"], "status_set_at": p["status_set_at"]} for p in persons],
        "alerts": [{"id": a["id"], "severity": a["severity"], "title": a["title"], "message": a["message"], "status": a["status"], "created_at": a["created_at"]} for a in alerts],
        "events": [{"id": e["id"], "domain": e["domain"], "event_type": e["event_type"], "summary": e["summary"], "occurred_at": e["occurred_at"]} for e in events],
    }


# ---------------------------------------------------------------------------
# CP1d-FAMILY-PILOT-1a — Backup consistente del servidor (SQLite VACUUM INTO)
# Reglas: owner + reautenticación con contraseña; snapshot server-side en
# DB_PATH.parent/backups; verificación por restauración aislada (integrity_check
# + conteos); retención de los 10 más recientes; SIN endpoint de descarga y
# SIN rutas físicas en la respuesta.
# ---------------------------------------------------------------------------

_BACKUP_VERIFY_TABLES = [
    "users",
    "households",
    "household_memberships",
    "persons",
    "household_invitations",
]
_BACKUP_KEEP = 10


def _backups_dir() -> Path:
    from ..config import settings
    return Path(settings.DB_PATH).resolve().parent / "backups"


def _require_backup_admin(db, user, household_id: str, password: str) -> None:
    require_household_role(db, user["user_id"], household_id, "owner")
    require_verified_email_for_sensitive_action(db, user["user_id"])
    from ..security import verify_password
    row = db.execute("SELECT password_hash FROM users WHERE id=?", (user["user_id"],)).fetchone()
    if not row or not verify_password(password or "", row["password_hash"]):
        write_security_event(
            db,
            event_type="household_backup_reauth_failed",
            severity="high",
            source="household_backup",
            household_id=household_id,
            user_id=user["user_id"],
            metadata={},
            commit=True,
        )
        raise HTTPException(status_code=403, detail="Reautenticación fallida: contraseña incorrecta")


@router.post("/{household_id}/admin/backup")
def create_household_backup(
    household_id: str,
    payload: HouseholdBackupRequest,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    _require_backup_admin(db, user, household_id, payload.password)
    from ..rate_limit import enforce_action_limit
    enforce_action_limit("backup", user["user_id"])
    from ..config import settings
    if settings.DATABASE_URL:
        raise HTTPException(
            status_code=501,
            detail="El backup VACUUM INTO aplica solo a SQLite; con Postgres se usa el backup gestionado del proveedor",
        )
    import sqlite3
    db_path = Path(settings.DB_PATH).resolve()
    if not db_path.exists():
        raise HTTPException(status_code=500, detail="Base de datos no encontrada en el servidor")
    backups = _backups_dir()
    backups.mkdir(parents=True, exist_ok=True)
    created_at = datetime.now(timezone.utc)
    backup_id = f"vantdomus_{created_at.strftime('%Y%m%dT%H%M%SZ')}_{secrets.token_hex(4)}"
    snapshot_path = backups / f"{backup_id}.db"

    source_counts = {
        table: int(db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])
        for table in _BACKUP_VERIFY_TABLES
    }

    # VACUUM INTO exige una conexión sin transacción abierta: usar una propia.
    src = sqlite3.connect(str(db_path))
    try:
        src.execute("VACUUM INTO ?", (str(snapshot_path),))
    finally:
        src.close()

    # Restauración aislada: abrir el snapshot como base independiente y verificar.
    snap = sqlite3.connect(str(snapshot_path))
    try:
        integrity = str(snap.execute("PRAGMA integrity_check").fetchone()[0])
        snapshot_counts = {
            table: int(snap.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])
            for table in _BACKUP_VERIFY_TABLES
        }
    finally:
        snap.close()

    if integrity.lower() != "ok":
        snapshot_path.unlink(missing_ok=True)
        write_security_event(
            db,
            event_type="household_backup_integrity_failed",
            severity="high",
            source="household_backup",
            household_id=household_id,
            user_id=user["user_id"],
            metadata={"backup_id": backup_id, "integrity": integrity[:200]},
            commit=True,
        )
        raise HTTPException(status_code=500, detail="El snapshot no pasó integrity_check y fue descartado")

    counts_match = snapshot_counts == source_counts
    sha256 = hashlib.sha256(snapshot_path.read_bytes()).hexdigest()
    size_bytes = snapshot_path.stat().st_size

    metadata = {
        "backup_id": backup_id,
        "created_at": created_at.isoformat(),
        "size_bytes": size_bytes,
        "sha256": sha256,
        "integrity": "ok",
        "verified": counts_match,
        "tables": snapshot_counts,
        "source_tables": source_counts,
    }
    (backups / f"{backup_id}.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # Retención: conservar los N snapshots más recientes (nombre = timestamp UTC).
    existing = sorted(backups.glob("vantdomus_*.db"))
    for old in existing[:-_BACKUP_KEEP] if len(existing) > _BACKUP_KEEP else []:
        old.unlink(missing_ok=True)
        old.with_suffix(".json").unlink(missing_ok=True)

    write_audit_log(
        db,
        action="household_backup_created",
        resource_type="household_backup",
        household_id=household_id,
        user_id=user["user_id"],
        resource_id=backup_id,
        metadata={"sha256": sha256, "size_bytes": size_bytes, "verified": counts_match},
    )
    write_security_event(
        db,
        event_type="household_backup_created",
        severity="medium",
        source="household_backup",
        household_id=household_id,
        user_id=user["user_id"],
        metadata={"backup_id": backup_id, "sha256": sha256, "verified": counts_match},
    )
    db.commit()
    # Sin ruta física: el snapshot vive solo en el disco del servidor.
    return metadata


@router.get("/{household_id}/admin/backup")
def list_household_backups(household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "owner")
    backups = _backups_dir()
    items = []
    if backups.exists():
        for meta_file in sorted(backups.glob("vantdomus_*.json"), reverse=True):
            try:
                data = json.loads(meta_file.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            items.append(
                {
                    "backup_id": data.get("backup_id"),
                    "created_at": data.get("created_at"),
                    "size_bytes": data.get("size_bytes"),
                    "sha256": data.get("sha256"),
                    "integrity": data.get("integrity"),
                    "verified": data.get("verified"),
                    "tables": data.get("tables"),
                }
            )
    return {"items": items, "keep": _BACKUP_KEEP}
