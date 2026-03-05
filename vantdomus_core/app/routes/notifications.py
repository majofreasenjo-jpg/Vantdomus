from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..deps import get_db, get_current_user, require_household_role
from ..notify import notifier
import uuid
from datetime import datetime

router = APIRouter(prefix="/notifications", tags=["Notifications"])

class RegisterDeviceToken(BaseModel):
    household_id: str
    platform: str  # ios/android/web
    token: str
    device_name: Optional[str] = None

class TestEmail(BaseModel):
    to_email: str
    subject: str = "VantDomus Notification Test"
    body: str = "Hello from VantDomus."

class TestWhatsApp(BaseModel):
    to_number_e164: str  # +569...
    body: str = "⚠️ VantDomus test message"

class TestExpoPush(BaseModel):
    expo_token: str
    title: str = "VantDomus"
    body: str = "Push test"
    data: Optional[dict] = None

@router.post("/push/register")
def register_push(payload: RegisterDeviceToken, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], payload.household_id, "member")
    if payload.platform not in ("ios", "android", "web"):
        raise HTTPException(status_code=400, detail="platform must be ios|android|web")

    now = datetime.utcnow().isoformat() + "Z"
    # upsert by (platform, token)
    cur = db.cursor()
    cur.execute("SELECT id FROM device_tokens WHERE platform=? AND token=?", (payload.platform, payload.token))
    row = cur.fetchone()
    if row:
        # update household/user/device_name
        cur.execute(
            "UPDATE device_tokens SET user_id=?, household_id=?, device_name=? WHERE id=?",
            (user["user_id"], payload.household_id, payload.device_name, row[0])
        )
        db.commit()
        return {"ok": True, "id": row[0], "updated": True}

    did = str(uuid.uuid4())
    cur.execute(
        "INSERT INTO device_tokens (id, user_id, household_id, platform, token, device_name, created_at) VALUES (?,?,?,?,?,?,?)",
        (did, user["user_id"], payload.household_id, payload.platform, payload.token, payload.device_name, now)
    )
    db.commit()
    return {"ok": True, "id": did, "updated": False}

@router.post("/test/email")
def test_email(payload: TestEmail, user=Depends(get_current_user)):
    return notifier.send_email(payload.to_email, payload.subject, payload.body)

@router.post("/test/whatsapp")
def test_whatsapp(payload: TestWhatsApp, user=Depends(get_current_user)):
    return notifier.send_whatsapp(payload.to_number_e164, payload.body)

@router.post("/test/push")
def test_push(payload: TestExpoPush, user=Depends(get_current_user)):
    return notifier.send_expo_push(payload.expo_token, payload.title, payload.body, payload.data)


from typing import List
from pydantic import BaseModel

class TargetCreate(BaseModel):
    household_id: str
    kind: str  # email|whatsapp
    destination: str
    enabled: bool = True

class TargetItem(BaseModel):
    id: str
    household_id: str
    kind: str
    destination: str
    enabled: bool
    created_at: str

@router.get("/targets")
def list_targets(household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "member")
    cur = db.cursor()
    cur.execute("SELECT id, household_id, kind, destination, enabled, created_at FROM notification_targets WHERE household_id=? ORDER BY created_at DESC", (household_id,))
    rows = cur.fetchall()
    items = []
    for r in rows:
        items.append({
            "id": r[0],
            "household_id": r[1],
            "kind": r[2],
            "destination": r[3],
            "enabled": bool(r[4]),
            "created_at": r[5],
        })
    return {"items": items}

@router.post("/targets")
def add_target(payload: TargetCreate, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], payload.household_id, "admin")
    if payload.kind not in ("email", "whatsapp"):
        raise HTTPException(status_code=400, detail="kind must be email|whatsapp")
    now = datetime.utcnow().isoformat() + "Z"
    tid = str(uuid.uuid4())
    cur = db.cursor()
    cur.execute(
        "INSERT INTO notification_targets (id, household_id, kind, destination, enabled, created_at) VALUES (?,?,?,?,?,?)",
        (tid, payload.household_id, payload.kind, payload.destination, 1 if payload.enabled else 0, now)
    )
    db.commit()
    return {"ok": True, "id": tid}

@router.post("/targets/{target_id}/toggle")
def toggle_target(target_id: str, household_id: str, enabled: bool, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "admin")
    cur = db.cursor()
    cur.execute("UPDATE notification_targets SET enabled=? WHERE id=? AND household_id=?", (1 if enabled else 0, target_id, household_id))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="target not found")
    db.commit()
    return {"ok": True}

@router.get("/outbox")
def list_outbox(household_id: str, limit: int = 50, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "member")
    cur = db.cursor()
    cur.execute(
        "SELECT id, alert_id, channel, destination, title, body, status, error, created_at FROM notification_outbox WHERE household_id=? ORDER BY created_at DESC LIMIT ?",
        (household_id, limit)
    )
    rows = cur.fetchall()
    items = []
    for r in rows:
        items.append({
            "id": r[0],
            "alert_id": r[1],
            "channel": r[2],
            "destination": r[3],
            "title": r[4],
            "body": r[5],
            "status": r[6],
            "error": r[7],
            "created_at": r[8],
        })
    return {"items": items}
