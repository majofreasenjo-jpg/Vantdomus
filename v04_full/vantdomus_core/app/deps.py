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

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    if not creds:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    try:
        p = decode_access_token(creds.credentials)
        return {"user_id": p["sub"], "email": p.get("email")}
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

def require_household_role(db, user_id: str, household_id: str, min_role: str):
    return _require(db, user_id, household_id, min_role)
