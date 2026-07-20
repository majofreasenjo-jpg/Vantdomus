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


# CP1d-FAMILY-PILOT-1b.1 / OPS-1: módulos DENIED para TODOS los roles (adultos
# incluidos), ANTES de evaluar module_visibility. La capacidad técnica previa no
# equivale a autorización. Se separan en dos clases:
#   - ALWAYS (health/finance): cerrados en family-pilot Y family-live (sensible;
#     no fue pedido para el piloto operativo).
#   - PILOT_ONLY (documents): cerrado en family-pilot; ABIERTO en family-live
#     (función de valor solicitada por el Owner en OPS-1).
FAMILY_ALWAYS_DENIED_MODULES = {"health", "finance"}
FAMILY_PILOT_ONLY_DENIED_MODULES = {"documents"}
# Compat: la unión conserva el nombre histórico para quien lo importe.
FAMILY_PILOT_DENIED_MODULES = FAMILY_ALWAYS_DENIED_MODULES | FAMILY_PILOT_ONLY_DENIED_MODULES

# CP1d-1b.1-R1/R2 / OPS-1: post_type del muro. health/finance cerrados en ambos
# perfiles; document/school ABIERTOS en family-live (estudio y documentos son
# funciones de valor de OPS-1) y cerrados solo en el piloto sellado.
FAMILY_ALWAYS_DENIED_BOARD_TYPES = {"health", "finance"}
FAMILY_PILOT_ONLY_DENIED_BOARD_TYPES = {"document", "school"}
FAMILY_PILOT_DENIED_BOARD_TYPES = FAMILY_ALWAYS_DENIED_BOARD_TYPES | FAMILY_PILOT_ONLY_DENIED_BOARD_TYPES


def denied_modules_for_profile() -> set:
    """Módulos cerrados según el perfil activo (pilot vs live)."""
    from .config import is_family_profile, is_family_pilot
    denied = set(FAMILY_ALWAYS_DENIED_MODULES) if is_family_profile() else set()
    if is_family_pilot():
        denied |= FAMILY_PILOT_ONLY_DENIED_MODULES
    return denied


def denied_board_types_for_profile() -> set:
    """post_type del muro cerrados según el perfil activo (pilot vs live)."""
    from .config import is_family_profile, is_family_pilot
    denied = set(FAMILY_ALWAYS_DENIED_BOARD_TYPES) if is_family_profile() else set()
    if is_family_pilot():
        denied |= FAMILY_PILOT_ONLY_DENIED_BOARD_TYPES
    return denied


def family_pilot_deny(module_or_reason: str):
    """CP1d-1b.1-R1: corta con 403 cuando la vía está prohibida en cualquier
    perfil familiar cerrado (pilot o live). Usar en rutas transversales sin gate
    de módulo (alerts). Para post_type usar denied_board_types_for_profile."""
    from .config import is_family_profile
    if is_family_profile():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"'{module_or_reason}' no disponible en el perfil familiar",
        )


def require_module_visible(db, user_id: str, household_id: str, module: str):
    """Exige que el usuario tenga rol suficiente para ver el módulo sensible."""
    role = require_household_role(db, user_id, household_id, "viewer")  # al menos miembro/viewer del hogar
    # Fail-closed del perfil familiar: evaluado PRIMERO, sin excepciones por rol.
    if module in denied_modules_for_profile():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Módulo '{module}' no disponible en el perfil familiar actual",
        )
    if module in SENSITIVE_MODULES:
        need = module_min_role(db, household_id, module)
        if ROLE_RANK.get(role, -1) < ROLE_RANK[need]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail=f"Módulo '{module}' restringido para tu rol en el hogar")
    return role
