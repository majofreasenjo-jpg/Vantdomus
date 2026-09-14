"""
OPS-1 — Bootstrap / reset de un usuario ADMIN (owner) del piloto cerrado.

En un sistema con registro CERRADO (family-pilot / family-live) el primer admin
no puede auto-registrarse por la web: se crea desde un canal de confianza (este
script, en el Render Shell). Es la vía correcta y auditable para tener un
"usuario master" con el que entrar a revisar.

Idempotente:
  - si el email NO existe → crea el usuario (activo + email verificado) y, si no
    tiene hogar propio, le crea uno como OWNER;
  - si el email YA existe → actualiza la contraseña, lo deja activo/verificado y
    se asegura de que tenga un hogar propio como owner.

Uso (desde apps/api):
    python scripts/bootstrap_admin.py <email> <password> ["Nombre del hogar"]

La contraseña se pasa como argumento y NUNCA se imprime.
"""

import json
import os
import sys
import uuid
from datetime import datetime, timezone

# Permite ejecutar el script tanto desde apps/api como desde apps/api/scripts.
_API_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

from app.db import connect  # noqa: E402
from app.security import hash_password  # noqa: E402
from app.tenancy import ensure_user_default_organization  # noqa: E402


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def bootstrap_admin(email: str, password: str, home_name: str = "Mi Hogar") -> dict:
    email = (email or "").strip().lower()
    if "@" not in email or len(password or "") < 8:
        raise SystemExit("ERROR: email inválido o contraseña de menos de 8 caracteres.")

    db = connect()
    ts = _now()

    row = db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
    if row:
        uid = row["id"]
        db.execute(
            "UPDATE users SET password_hash=?, is_active=1, "
            "email_verified_at=COALESCE(email_verified_at, ?) WHERE id=?",
            (hash_password(password), ts, uid),
        )
        user_action = "actualizado"
    else:
        uid = str(uuid.uuid4())
        db.execute(
            "INSERT INTO users (id,email,password_hash,is_active,created_at,email_verified_at) "
            "VALUES (?,?,?,?,?,?)",
            (uid, email, hash_password(password), 1, ts, ts),
        )
        user_action = "creado"

    org_id = ensure_user_default_organization(db, uid, name=f"{home_name} Organization")

    owns = db.execute(
        "SELECT household_id FROM household_memberships WHERE user_id=? AND role='owner' LIMIT 1",
        (uid,),
    ).fetchone()
    if owns:
        hid = owns["household_id"]
        home_status = "ya tenía hogar propio"
    else:
        hid = str(uuid.uuid4())
        db.execute(
            "INSERT INTO households (id,name,meta,created_at,organization_id) VALUES (?,?,?,?,?)",
            (hid, home_name, json.dumps({"mode": "home", "monthly_budget": 0}), ts, org_id),
        )
        db.execute(
            "INSERT INTO household_memberships (household_id,user_id,role,created_at) VALUES (?,?,?,?)",
            (hid, uid, "owner", ts),
        )
        home_status = "hogar creado"

    # Ficha (persona) del owner vinculada a su cuenta. Sin al menos una ficha, la
    # home la interpreta como "sin datos reales" y muestra el modo demo. El owner
    # es adulto (age_band='adult'), perfil de privacidad estándar.
    display_name = (email.split("@", 1)[0].replace(".", " ").replace("_", " ").strip().title()
                    or "Titular")
    persona = db.execute(
        "SELECT id FROM persons WHERE household_id=? AND user_id=?", (hid, uid)
    ).fetchone()
    if persona:
        persona_status = "ya tenía ficha"
    else:
        pid = str(uuid.uuid4())
        db.execute(
            "INSERT INTO persons "
            "(id, household_id, organization_id, display_name, relation, user_id, "
            "age_band, minor_privacy_profile, created_at) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (pid, hid, org_id, display_name, "Titular", uid, "adult", "standard", ts),
        )
        persona_status = "ficha creada"

    db.commit()
    return {
        "user_action": user_action,
        "email": email,
        "user_id": uid,
        "household_id": hid,
        "home_status": home_status,
        "persona_status": persona_status,
        "display_name": display_name,
        "organization_id": org_id,
    }


def main() -> None:
    if len(sys.argv) < 3:
        print('Uso: python scripts/bootstrap_admin.py <email> <password> ["Nombre del hogar"]')
        raise SystemExit(2)
    email = sys.argv[1]
    password = sys.argv[2]
    home_name = sys.argv[3] if len(sys.argv) > 3 else "Mi Hogar"

    result = bootstrap_admin(email, password, home_name)

    print("OK — usuario admin", result["user_action"])
    print("  email:          ", result["email"])
    print("  user_id:        ", result["user_id"])
    print("  household_id:   ", result["household_id"], f"({result['home_status']})")
    print("  organization_id:", result["organization_id"])
    print("Entra en /login con ese correo y la contraseña que elegiste (no se imprime aquí).")


if __name__ == "__main__":
    main()
