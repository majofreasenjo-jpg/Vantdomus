import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional

from .notify import notifier

def _log(db, household_id: str, alert_id: Optional[str], channel: str, destination: str, title: str, body: str, status: str, error: str = ""):
    now = datetime.utcnow().isoformat() + "Z"
    oid = str(uuid.uuid4())
    cur = db.cursor()
    cur.execute(
        "INSERT INTO notification_outbox (id, household_id, alert_id, channel, destination, title, body, status, error, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (oid, household_id, alert_id, channel, destination, title, body, status, error, now)
    )
    db.commit()

def dispatch_alert_notifications(db, household_id: str, alert: Dict[str, Any]) -> Dict[str, Any]:
    """Send notifications for a newly created alert to configured targets and registered push devices.
    Best-effort: failures are logged to outbox but do not break API."""
    alert_id = alert.get("id")
    title = alert.get("title", "VantDomus Alert")
    body = alert.get("message", title)

    results: List[Dict[str, Any]] = []

    # 1) Email/WhatsApp targets
    cur = db.cursor()
    cur.execute("SELECT kind, destination FROM notification_targets WHERE household_id=? AND enabled=1", (household_id,))
    targets = cur.fetchall()
    for kind, dest in targets:
        if kind == "email":
            r = notifier.send_email(dest, f"⚠️ {title}", body)
            results.append({"channel": "email", "destination": dest, **r})
            _log(db, household_id, alert_id, "email", dest, f"⚠️ {title}", body, "sent" if r.get("ok") else "failed", r.get("error",""))
        elif kind == "whatsapp":
            r = notifier.send_whatsapp(dest, f"⚠️ {title}\n{body}")
            results.append({"channel": "whatsapp", "destination": dest, **r})
            _log(db, household_id, alert_id, "whatsapp", dest, title, body, "sent" if r.get("ok") else "failed", r.get("error",""))

    # 2) Push devices (Expo)
    cur.execute("SELECT token, platform FROM device_tokens WHERE household_id=?", (household_id,))
    devices = cur.fetchall()
    for token, platform in devices:
        r = notifier.send_expo_push(token, "VantDomus", title, {"alert_id": alert_id, "household_id": household_id})
        results.append({"channel": "push", "destination": token, "platform": platform, **r})
        _log(db, household_id, alert_id, "push", token, title, body, "sent" if r.get("ok") else "failed", r.get("error",""))

    return {"ok": True, "sent": len([x for x in results if x.get("ok")]), "attempts": len(results), "results": results}
