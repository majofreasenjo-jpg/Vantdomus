from fastapi import APIRouter, Depends
from ..deps import get_db, get_current_user, require_household_role
from ..features import compute_and_store

router = APIRouter(prefix="/scores", tags=["Scores"])

@router.get("/latest")
def latest(household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "viewer")
    f = compute_and_store(db, household_id)
    return {"exists": True, **f}
