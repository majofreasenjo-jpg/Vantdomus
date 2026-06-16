from fastapi import APIRouter, Depends

from ..deps import get_current_user, get_db
from ..tenancy import backfill_user_households

router = APIRouter(prefix="/organizations", tags=["Organizations"])


@router.get("")
def list_organizations(user=Depends(get_current_user), db=Depends(get_db)):
    backfill_user_households(db, user["user_id"])
    db.commit()
    rows = db.execute(
        """
        SELECT o.id, o.name, m.role, o.created_at
        FROM organizations o
        JOIN organization_memberships m ON m.organization_id=o.id
        WHERE m.user_id=?
        ORDER BY o.created_at ASC
        """,
        (user["user_id"],),
    ).fetchall()
    return {
        "items": [
            {"id": row["id"], "name": row["name"], "role": row["role"], "created_at": row["created_at"]}
            for row in rows
        ]
    }
