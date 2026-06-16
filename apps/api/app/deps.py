import os
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .db import connect
from .security import decode_access_token
from .rbac import require_household_role as _require

bearer = HTTPBearer(auto_error=False)

def get_db():
    db = connect()
    try:
        yield db
    finally:
        db.close()

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db=Depends(get_db)):
    if not creds:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    try:
        p = decode_access_token(creds.credentials)
        jti = p.get("jti")
        if not jti:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        session = db.execute(
            "SELECT revoked_at FROM auth_sessions WHERE user_id=? AND token_jti=?",
            (p["sub"], jti),
        ).fetchone()
        if not session or session["revoked_at"]:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session revoked")
        try:
            db.execute(
                "UPDATE auth_sessions SET last_seen_at=? WHERE user_id=? AND token_jti=?",
                (datetime.now(timezone.utc).isoformat(), p["sub"], jti),
            )
            db.commit()
        except Exception:
            pass
        return {"user_id": p["sub"], "email": p.get("email"), "jti": jti}
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

def require_household_role(db, user_id: str, household_id: str, min_role: str):
    return _require(db, user_id, household_id, min_role)


def _verified_email_required() -> bool:
    env = os.getenv("APP_ENV", "local").strip().lower()
    configured = os.getenv("VANTDOMUS_REQUIRE_VERIFIED_EMAIL_FOR_SENSITIVE_ACTIONS", "").strip().lower()
    if configured in {"1", "true", "yes"}:
        return True
    return env in {"production", "prod", "staging"}


def require_verified_email_for_sensitive_action(db, user_id: str) -> None:
    if not _verified_email_required():
        return
    row = db.execute("SELECT email_verified_at FROM users WHERE id=?", (user_id,)).fetchone()
    if not row or not row["email_verified_at"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required for this sensitive action",
        )


def require_person_in_household(db, person_id: str | None, household_id: str) -> None:
    if not person_id:
        return
    row = db.execute("SELECT id FROM persons WHERE id=? AND household_id=?", (person_id, household_id)).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found in household")


def require_operational_feature_enabled(feature_name: str, env_var: str) -> None:
    env = os.getenv("APP_ENV", "local").strip().lower()
    if env not in {"production", "prod", "staging"}:
        return
    enabled = os.getenv(env_var, "").strip().lower() in {"1", "true", "yes"}
    if not enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{feature_name} is disabled in staging/production",
        )
