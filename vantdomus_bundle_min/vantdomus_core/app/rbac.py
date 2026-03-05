from fastapi import HTTPException, status
from app.db import fetch_one

ROLE_RANK = {"viewer": 0, "member": 1, "admin": 2, "owner": 3}

def require_role(conn, user_id: str, household_id: str, min_role: str):
    row = fetch_one(conn, "SELECT role FROM household_memberships WHERE household_id=%s AND user_id=%s", (household_id, user_id))
    if not row:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a household member")
    role = row[0]
    if ROLE_RANK.get(role, -1) < ROLE_RANK[min_role]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Requires role {min_role}")
    return role
