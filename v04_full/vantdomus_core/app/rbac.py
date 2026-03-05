from fastapi import HTTPException, status

ROLE_RANK = {"viewer": 0, "member": 1, "admin": 2, "owner": 3}

def require_household_role(db, user_id: str, household_id: str, min_role: str):
    row = db.execute("SELECT role FROM household_memberships WHERE household_id=? AND user_id=?", (household_id, user_id)).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a household member")
    role = row["role"]
    if ROLE_RANK.get(role, -1) < ROLE_RANK[min_role]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Requires role {min_role}")
    return role
