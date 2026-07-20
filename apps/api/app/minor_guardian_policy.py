"""
CP1d-FAMILY-PILOT-1b.1 — Política central de menores, tutela y consentimiento.

ÚNICA fuente de reglas para las TRES etapas de invitación (crear, alta de
cuenta nueva, aceptación con cuenta preexistente) y para la privacidad de
fichas. Prohibido duplicar estas reglas en auth.py / households.py /
persons.py: esos módulos DEBEN llamar aquí.

Fail-closed por diseño:
- 'unclassified' y 'child' JAMÁS reciben cuenta;
- bandas supervisadas exigen tutela activa + consentimiento vigente;
- el rol de un menor tiene tope duro (viewer/member) y proviene SIEMPRE del
  registro persistido de la invitación, nunca del payload del cliente.
"""

from __future__ import annotations

from fastapi import HTTPException

AGE_BANDS = {"unclassified", "child", "supervised_minor", "supervised_teen", "adult"}
MINOR_BANDS = {"child", "supervised_minor", "supervised_teen"}
SUPERVISED_BANDS = {"supervised_minor", "supervised_teen"}
PRIVACY_PROFILES = {"restricted", "supervised", "standard"}
SCOPES = {"full", "view", "recovery"}
CONSENT_TYPES = {"account_creation", "module_access", "data_entry"}

# Versión de la política vigente: se persiste y audita en cada consentimiento.
POLICY_VERSION = "family-pilot-1b.1-v1"

# Tope duro de rol por banda (menores nunca owner/admin).
MAX_ROLE_BY_BAND = {"supervised_minor": "viewer", "supervised_teen": "member"}

# Scopes que autorizan account_creation (view NO autoriza; recovery NO autoriza).
ACCOUNT_CREATION_SCOPES = ("full",)
# Scopes que autorizan iniciar recuperación (emisión/entrega BLOQUEADAS hasta 1b.3).
RECOVERY_SCOPES = ("full", "recovery")


def validate_age_band(value: str) -> str:
    value = (value or "").strip().lower()
    if value not in AGE_BANDS:
        raise HTTPException(status_code=400, detail="age_band inválida")
    return value


def validate_privacy_profile(value: str) -> str:
    value = (value or "").strip().lower()
    if value not in PRIVACY_PROFILES:
        raise HTTPException(status_code=400, detail="minor_privacy_profile inválido")
    return value


def validate_scope(value: str) -> str:
    value = (value or "").strip().lower()
    if value not in SCOPES:
        raise HTTPException(status_code=400, detail="scope inválido")
    return value


def validate_consent_type(value: str) -> str:
    value = (value or "").strip().lower()
    if value not in CONSENT_TYPES:
        raise HTTPException(status_code=400, detail="consent_type inválido")
    return value


def get_person(db, person_id: str):
    return db.execute(
        """
        SELECT id, household_id, display_name, relation, user_id, age_band,
               minor_privacy_profile, avatar, status_emoji, status_text,
               status_set_at, created_at
        FROM persons WHERE id=?
        """,
        (person_id,),
    ).fetchone()


def person_for_user(db, household_id: str, user_id: str):
    """Ficha del hogar vinculada a esta cuenta (titular), o None."""
    return db.execute(
        "SELECT id, age_band, user_id FROM persons WHERE household_id=? AND user_id=?",
        (household_id, user_id),
    ).fetchone()


def active_guardian_relationships(db, household_id: str, minor_person_id: str, scopes=None):
    rows = db.execute(
        """
        SELECT id, household_id, minor_person_id, guardian_person_id, scope
        FROM guardian_relationships
        WHERE household_id=? AND minor_person_id=? AND revoked_at IS NULL
        """,
        (household_id, minor_person_id),
    ).fetchall()
    if scopes is None:
        return rows
    allowed = set(scopes)
    return [r for r in rows if r["scope"] in allowed]


def guardian_relationship_for_user(db, household_id: str, minor_person_id: str, user_id: str, scopes=None):
    """Relación de tutela ACTIVA cuyo guardian_person está vinculado a este usuario."""
    for rel in active_guardian_relationships(db, household_id, minor_person_id, scopes):
        guardian = db.execute(
            "SELECT user_id FROM persons WHERE id=? AND household_id=?",
            (rel["guardian_person_id"], household_id),
        ).fetchone()
        if guardian and guardian["user_id"] == user_id:
            return rel
    return None


def active_account_creation_consent(db, household_id: str, minor_person_id: str):
    """(relación_full_activa, consentimiento_account_creation_activo) o (None, None)."""
    for rel in active_guardian_relationships(db, household_id, minor_person_id, ACCOUNT_CREATION_SCOPES):
        consent = db.execute(
            """
            SELECT id, relationship_id, policy_version
            FROM guardian_consents
            WHERE relationship_id=? AND household_id=? AND minor_person_id=?
              AND consent_type='account_creation' AND revoked_at IS NULL
            """,
            (rel["id"], household_id, minor_person_id),
        ).fetchone()
        if consent:
            return rel, consent
    return None, None


def validate_invitation_person_policy(
    db,
    *,
    household_id: str,
    person_id: str | None,
    role: str,
    require_person: bool,
    generic_error: str | None = None,
):
    """
    Validador COMPARTIDO de las tres etapas de invitación. Se ejecuta al crear
    la invitación y SE RE-EJECUTA dentro de la transacción de cada aceptación
    (las condiciones pueden haber cambiado: banda, tutela o consentimiento).

    Devuelve dict con la evidencia validada (para auditoría sin PII) o lanza
    HTTPException. Si `generic_error` viene dado (vía pública), TODOS los
    rechazos de política usan ese mensaje único anti-enumeración.
    """

    def deny(status_code: int, detail: str):
        if generic_error is not None:
            raise HTTPException(status_code=400, detail=generic_error)
        raise HTTPException(status_code=status_code, detail=detail)

    if person_id is None or not str(person_id).strip():
        if require_person:
            deny(400, "person_id es obligatorio en el piloto familiar")
        # Invitación sin ficha (entornos locales): rol según reglas de adulto.
        return {"person_id": None, "age_band": None, "relationship_id": None, "consent_id": None}

    person = get_person(db, person_id)
    if not person or person["household_id"] != household_id:
        deny(404, "Person not found in this household")
    if person["user_id"]:
        deny(409, "La ficha ya está vinculada a una cuenta")

    band = person["age_band"]
    if band == "unclassified":
        deny(403, "La ficha debe ser clasificada por el propietario antes del alta")
    if band == "child":
        deny(403, "Una ficha en banda child no puede recibir cuenta")

    if band in SUPERVISED_BANDS:
        max_role = MAX_ROLE_BY_BAND[band]
        if role != max_role:
            deny(403, f"Banda {band}: el único rol permitido es {max_role}")
        rel, consent = active_account_creation_consent(db, household_id, person_id)
        if not rel:
            deny(403, "Se requiere una relación de tutela activa (scope full)")
        if not consent:
            deny(403, "Se requiere consentimiento account_creation vigente")
        return {
            "person_id": person["id"],
            "age_band": band,
            "relationship_id": rel["id"],
            "consent_id": consent["id"],
            "policy_version": consent["policy_version"],
        }

    # adult: sin tutela ni consentimiento; el rol lo rigen las reglas existentes
    # (owner-para-owner etc.), siempre desde el registro persistido.
    return {"person_id": person["id"], "age_band": band, "relationship_id": None, "consent_id": None}


# ---------------------------------------------------------------------------
# Privacidad de fichas
# ---------------------------------------------------------------------------

def person_view_level(db, *, viewer_user_id: str, viewer_role: str, person) -> str:
    """'full' | 'minimal' para un miembro del hogar (403 se decide antes)."""
    if viewer_role in ("owner", "admin"):
        return "full"
    if person["user_id"] == viewer_user_id:
        return "full"  # titular
    if person["age_band"] in MINOR_BANDS or person["age_band"] == "unclassified":
        rel = guardian_relationship_for_user(
            db, person["household_id"], person["id"], viewer_user_id, scopes=("full", "view")
        )
        if rel:
            return "full"
        return "minimal"
    # Adulto visto por member/viewer no relacionado: vista mínima también
    # (privacidad por defecto del piloto).
    return "minimal"


def can_edit_person_basic(db, *, editor_user_id: str, editor_role: str, person) -> bool:
    """Campos básicos (display_name/relation/avatar/status)."""
    if editor_role in ("owner", "admin"):
        return True
    if person["user_id"] == editor_user_id:
        return True  # titular sobre su propia ficha
    if person["age_band"] in MINOR_BANDS:
        rel = guardian_relationship_for_user(
            db, person["household_id"], person["id"], editor_user_id, scopes=("full",)
        )
        return rel is not None
    return False


def can_initiate_recovery(db, *, guardian_user_id: str, household_id: str, minor_person_id: str) -> bool:
    """
    SOLO autorización (1b.1). La emisión y entrega del token de recuperación
    permanecen BLOQUEADAS hasta decidir el canal seguro en 1b.3.
    """
    person = get_person(db, minor_person_id)
    if not person or person["household_id"] != household_id:
        return False
    if person["age_band"] not in SUPERVISED_BANDS:
        return False
    rel = guardian_relationship_for_user(
        db, household_id, minor_person_id, guardian_user_id, scopes=RECOVERY_SCOPES
    )
    return rel is not None
