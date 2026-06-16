from fastapi import APIRouter, Depends
from ..deps import get_db, get_current_user, require_household_role

router = APIRouter(prefix="/alerts", tags=["Alerts"])

@router.get("")
def list_alerts(household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "viewer")
    rows = db.execute("SELECT id,severity,title,message,status,created_at FROM alerts WHERE household_id=? ORDER BY created_at DESC LIMIT 200", (household_id,)).fetchall()
    return {"items":[{"id":r["id"],"severity":r["severity"],"title":r["title"],"message":r["message"],"status":r["status"],"created_at":r["created_at"]} for r in rows]}
