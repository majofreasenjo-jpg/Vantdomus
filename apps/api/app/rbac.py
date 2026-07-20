import json
from fastapi import HTTPException, status

ROLE_RANK = {"viewer": 0, "member": 1, "admin": 2, "owner": 3}

# Módulos sensibles con visibilidad configurable por el hogar (#17).
SENSITIVE_MODULES = {"finance", "health", "documents"}


def require_household_role(db, user_id: str, household_id: str, min_role: str):
    row = db.execute("SELECT role FROM household_memberships WHERE household_id=? AND user_id=?", (household_id, user_id)).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a household member")
    role = row["role"]
    if ROLE_RANK.get(role, -1) < ROLE_RANK[min_role]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Requires role {min_role}")
    return role


def household_role(db, user_id: str, household_id: str):
    """Rol del usuario en el hogar, o None si no es miembro."""
    row = db.execute("SELECT role FROM household_memberships WHERE household_id=? AND user_id=?", (household_id, user_id)).fetchone()
    return row["role"] if row else None


def module_min_role(db, household_id: str, module: str) -> str:
    """Rol mínimo configurado para ver un módulo (default 'viewer' = todos)."""
    try:
        row = db.execute("SELECT meta FROM households WHERE id=?", (household_id,)).fetchone()
        meta = json.loads(row["meta"] or "{}") if row else {}
        mv = meta.get("module_visibility") or {}
        mr = mv.get(module)
        return mr if mr in ROLE_RANK else "viewer"
    except Exception:
        return "viewer"


# CP1d-FAMILY-PILOT-1b.1: durante el piloto familiar estos módulos quedan
# DENIED para TODOS los roles (adultos incluidos), ANTES de evaluar
# module_visibility. La capacidad técnica previa no equivale a autorización.
FAMILY_PILOT_DENIED_MODULES = {"health", "finance", "documents"}


def require_module_visible(db, user_id: str, household_id: str, module: str):
    """Exige que el usuario tenga rol suficiente para ver el módulo sensible."""
    role = require_household_role(db, user_id, household_id, "viewer")  # al menos miembro/viewer del hogar
    # Fail-closed del piloto: evaluado PRIMERO, sin excepciones por rol.
    from .config import is_family_pilot
    if is_family_pilot() and module in FAMILY_PILOT_DENIED_MODULES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Módulo '{module}' no disponible durante el piloto familiar",
        )
    if module in SENSITIVE_MODULES:
        need = module_min_role(db, household_id, module)
        if ROLE_RANK.get(role, -1) < ROLE_RANK[need]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail=f"Módulo '{module}' restringido para tu rol en el hogar")
    return role
