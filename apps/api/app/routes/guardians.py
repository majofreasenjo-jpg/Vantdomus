"""
CP1d-FAMILY-PILOT-1b.1 — Relaciones de tutela y consentimientos.

Reglas (gate autorizado):
- Solo OWNER crea/revoca relaciones de tutela durante 1b.1.
- Guardián y menor deben ser fichas del MISMO hogar; guardián age_band=adult
  vinculado a un usuario activo miembro del hogar; menor en banda child/
  supervised_minor/supervised_teen.
- El consentimiento lo otorga EXCLUSIVAMENTE el usuario vinculado a
  guardian_person_id; scope=view no autoriza account_creation.
- Relación/consentimiento revocados dejan de autorizar de inmediato.
- Auditoría y security_events SOLO con IDs internos + policy_version: cero
  emails, tokens o contraseñas.
- Recuperación de menores: aquí solo se AUTORIZA y AUDITA el chequeo; la
  emisión/entrega del token queda BLOQUEADA hasta 1b.3.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..audit import write_audit_log
from ..deps import get_current_user, get_db, require_household_role
from ..minor_guardian_policy import (
    MINOR_BANDS,
    POLICY_VERSION,
    can_initiate_recovery,
    get_person,
    validate_consent_type,
    validate_scope,
)
from ..security_events import write_security_event

router = APIRouter(prefix="/households", tags=["Guardians"])


def now():
    return datetime.now(timezone.utc).isoformat()


class RelationshipCreate(BaseModel):
    minor_person_id: str
    guardian_person_id: str
    scope: str = "full"


class ConsentCreate(BaseModel):
    relationship_id: str
    consent_type: str = "account_creation"


class RecoveryCheck(BaseModel):
    minor_person_id: str


@router.get("/{household_id}/guardians/relationships")
def list_relationships(household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "owner")
    rows = db.execute(
        """
        SELECT id, minor_person_id, guardian_person_id, scope, created_at, revoked_at
        FROM guardian_relationships WHERE household_id=? ORDER BY created_at
        """,
        (household_id,),
    ).fetchall()
    return {"items": [dict(r) for r in rows]}


@router.post("/{household_id}/guardians/relationships")
def create_relationship(
    household_id: str,
    payload: RelationshipCreate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    # Regla 1: solo owner durante 1b.1.
    require_household_role(db, user["user_id"], household_id, "owner")
    scope = validate_scope(payload.scope)

    minor = get_person(db, payload.minor_person_id)
    guardian = get_person(db, payload.guardian_person_id)
    # Regla 2: mismo hogar.
    if not minor or minor["household_id"] != household_id:
        raise HTTPException(status_code=404, detail="Minor person not found in this household")
    if not guardian or guardian["household_id"] != household_id:
        raise HTTPException(status_code=404, detail="Guardian person not found in this household")
    if minor["id"] == guardian["id"]:
        raise HTTPException(status_code=400, detail="El guardián no puede ser la misma persona que el menor")
    # Regla 3: guardián adulto.
    if guardian["age_band"] != "adult":
        raise HTTPException(status_code=403, detail="La ficha guardiana debe tener age_band=adult")
    # Regla 4: menor en banda de menor.
    if minor["age_band"] not in MINOR_BANDS:
        raise HTTPException(status_code=403, detail="La ficha del menor debe estar en banda child/supervised_minor/supervised_teen")
    # Regla 5: guardián vinculado a usuario activo miembro del hogar.
    if not guardian["user_id"]:
        raise HTTPException(status_code=403, detail="La ficha guardiana debe estar vinculada a una cuenta")
    guardian_user = db.execute(
        "SELECT id, is_active FROM users WHERE id=?", (guardian["user_id"],)
    ).fetchone()
    if not guardian_user or not guardian_user["is_active"]:
        raise HTTPException(status_code=403, detail="La cuenta del guardián debe estar activa")
    membership = db.execute(
        "SELECT role FROM household_memberships WHERE household_id=? AND user_id=?",
        (household_id, guardian["user_id"]),
    ).fetchone()
    if not membership:
        raise HTTPException(status_code=403, detail="La cuenta del guardián debe ser miembro del hogar")
    # Duplicado activo idéntico (además del índice UNIQUE parcial).
    duplicate = db.execute(
        """
        SELECT 1 FROM guardian_relationships
        WHERE household_id=? AND minor_person_id=? AND guardian_person_id=? AND scope=? AND revoked_at IS NULL
        """,
        (household_id, minor["id"], guardian["id"], scope),
    ).fetchone()
    if duplicate:
        raise HTTPException(status_code=409, detail="Ya existe una relación activa idéntica")

    rid = str(uuid.uuid4())
    db.execute(
        """
        INSERT INTO guardian_relationships
          (id, household_id, minor_person_id, guardian_person_id, scope, created_by_user_id, created_at, revoked_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
        """,
        (rid, household_id, minor["id"], guardian["id"], scope, user["user_id"], now()),
    )
    write_audit_log(
        db,
        action="guardian_relationship_created",
        resource_type="guardian_relationship",
        household_id=household_id,
        user_id=user["user_id"],
        resource_id=rid,
        metadata={
            "minor_person_id": minor["id"],
            "guardian_person_id": guardian["id"],
            "scope": scope,
            "policy_version": POLICY_VERSION,
        },
    )
    write_security_event(
        db,
        event_type="guardian_relationship_created",
        severity="medium",
        source="guardians",
        household_id=household_id,
        user_id=user["user_id"],
        metadata={"relationship_id": rid, "scope": scope, "policy_version": POLICY_VERSION},
    )
    db.commit()
    return {"id": rid, "scope": scope}


@router.post("/{household_id}/guardians/relationships/{relationship_id}/revoke")
def revoke_relationship(
    household_id: str,
    relationship_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_household_role(db, user["user_id"], household_id, "owner")
    rel = db.execute(
        "SELECT id, revoked_at FROM guardian_relationships WHERE id=? AND household_id=?",
        (relationship_id, household_id),
    ).fetchone()
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")
    if rel["revoked_at"]:
        return {"ok": True, "already_revoked": True}
    db.execute(
        "UPDATE guardian_relationships SET revoked_at=? WHERE id=?",
        (now(), relationship_id),
    )
    write_audit_log(
        db,
        action="guardian_relationship_revoked",
        resource_type="guardian_relationship",
        household_id=household_id,
        user_id=user["user_id"],
        resource_id=relationship_id,
        metadata={"policy_version": POLICY_VERSION},
    )
    write_security_event(
        db,
        event_type="guardian_relationship_revoked",
        severity="medium",
        source="guardians",
        household_id=household_id,
        user_id=user["user_id"],
        metadata={"relationship_id": relationship_id, "policy_version": POLICY_VERSION},
    )
    db.commit()
    return {"ok": True}


@router.get("/{household_id}/guardians/consents")
def list_consents(household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "owner")
    rows = db.execute(
        """
        SELECT id, relationship_id, minor_person_id, guardian_person_id, consent_type,
               policy_version, granted_at, revoked_at
        FROM guardian_consents WHERE household_id=? ORDER BY granted_at
        """,
        (household_id,),
    ).fetchall()
    return {"items": [dict(r) for r in rows]}


@router.post("/{household_id}/guardians/consents")
def grant_consent(
    household_id: str,
    payload: ConsentCreate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    # Miembro del hogar como mínimo; la regla dura es "usuario vinculado a la
    # ficha guardiana de ESTA relación" (regla 6).
    require_household_role(db, user["user_id"], household_id, "viewer")
    consent_type = validate_consent_type(payload.consent_type)
    rel = db.execute(
        """
        SELECT id, household_id, minor_person_id, guardian_person_id, scope, revoked_at
        FROM guardian_relationships WHERE id=? AND household_id=?
        """,
        (payload.relationship_id, household_id),
    ).fetchone()
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")
    # Regla 7: relación revocada no sirve para consentir.
    if rel["revoked_at"]:
        raise HTTPException(status_code=403, detail="La relación de tutela está revocada")
    # CP1d-1b.1-R1 — matriz de scopes explícita y fail-closed:
    #   full     => account_creation, module_access, data_entry;
    #   view     => solo module_access;
    #   recovery => NINGÚN consentimiento (solo habilita el chequeo de recuperación).
    scope = rel["scope"]
    allowed_by_scope = {
        "full": {"account_creation", "module_access", "data_entry"},
        "view": {"module_access"},
        "recovery": set(),
    }
    if consent_type not in allowed_by_scope.get(scope, set()):
        raise HTTPException(
            status_code=403,
            detail=f"La relación scope={scope} no puede consentir {consent_type}",
        )
    # Regla 6: quien otorga debe ser el usuario vinculado a guardian_person_id.
    guardian = get_person(db, rel["guardian_person_id"])
    if not guardian or guardian["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Solo el guardián de esta relación puede otorgar el consentimiento")

    duplicate = db.execute(
        """
        SELECT 1 FROM guardian_consents
        WHERE relationship_id=? AND consent_type=? AND policy_version=? AND revoked_at IS NULL
        """,
        (rel["id"], consent_type, POLICY_VERSION),
    ).fetchone()
    if duplicate:
        raise HTTPException(status_code=409, detail="Ya existe un consentimiento activo de este tipo")

    cid = str(uuid.uuid4())
    db.execute(
        """
        INSERT INTO guardian_consents
          (id, relationship_id, household_id, minor_person_id, guardian_person_id,
           consent_type, policy_version, granted_by_user_id, granted_at, revoked_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        """,
        (cid, rel["id"], household_id, rel["minor_person_id"], rel["guardian_person_id"],
         consent_type, POLICY_VERSION, user["user_id"], now()),
    )
    write_audit_log(
        db,
        action="guardian_consent_granted",
        resource_type="guardian_consent",
        household_id=household_id,
        user_id=user["user_id"],
        resource_id=cid,
        metadata={
            "relationship_id": rel["id"],
            "consent_type": consent_type,
            "policy_version": POLICY_VERSION,
        },
    )
    write_security_event(
        db,
        event_type="guardian_consent_granted",
        severity="medium",
        source="guardians",
        household_id=household_id,
        user_id=user["user_id"],
        metadata={"consent_id": cid, "consent_type": consent_type, "policy_version": POLICY_VERSION},
    )
    db.commit()
    return {"id": cid, "consent_type": consent_type, "policy_version": POLICY_VERSION}


@router.post("/{household_id}/guardians/consents/{consent_id}/revoke")
def revoke_consent(
    household_id: str,
    consent_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    role = require_household_role(db, user["user_id"], household_id, "viewer")
    consent = db.execute(
        """
        SELECT id, guardian_person_id, granted_by_user_id, revoked_at
        FROM guardian_consents WHERE id=? AND household_id=?
        """,
        (consent_id, household_id),
    ).fetchone()
    if not consent:
        raise HTTPException(status_code=404, detail="Consent not found")
    # Puede revocar: el owner, o el guardián que lo otorgó.
    if role != "owner" and consent["granted_by_user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Solo el owner o el guardián otorgante pueden revocar")
    if consent["revoked_at"]:
        return {"ok": True, "already_revoked": True}
    db.execute("UPDATE guardian_consents SET revoked_at=? WHERE id=?", (now(), consent_id))
    write_audit_log(
        db,
        action="guardian_consent_revoked",
        resource_type="guardian_consent",
        household_id=household_id,
        user_id=user["user_id"],
        resource_id=consent_id,
        metadata={"policy_version": POLICY_VERSION},
    )
    write_security_event(
        db,
        event_type="guardian_consent_revoked",
        severity="medium",
        source="guardians",
        household_id=household_id,
        user_id=user["user_id"],
        metadata={"consent_id": consent_id, "policy_version": POLICY_VERSION},
    )
    db.commit()
    return {"ok": True}


@router.post("/{household_id}/guardians/recovery-authorization-check")
def recovery_authorization_check(
    household_id: str,
    payload: RecoveryCheck,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    1b.1: SOLO comprueba y AUDITA si este usuario está autorizado a INICIAR la
    recuperación del menor. NO crea, materializa, devuelve ni envía token
    alguno (canal de entrega: decisión de 1b.3).
    """
    require_household_role(db, user["user_id"], household_id, "viewer")
    authorized = can_initiate_recovery(
        db,
        guardian_user_id=user["user_id"],
        household_id=household_id,
        minor_person_id=payload.minor_person_id,
    )
    write_security_event(
        db,
        event_type="guardian_recovery_check",
        severity="low" if authorized else "medium",
        source="guardians",
        household_id=household_id,
        user_id=user["user_id"],
        metadata={
            "minor_person_id": payload.minor_person_id,
            "authorized": authorized,
            "policy_version": POLICY_VERSION,
        },
        commit=True,
    )
    return {"authorized": authorized, "token_issued": False}
