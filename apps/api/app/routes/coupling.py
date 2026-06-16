import hmac
import json
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from app.audit import write_audit_log
from app.audit import write_assistant_action_log
from app.deps import get_current_user, get_db, require_household_role, require_verified_email_for_sensitive_action
from app.tenancy import get_household_organization_id

router = APIRouter()


def now():
    return datetime.now(timezone.utc).isoformat()


def _utcnow():
    return datetime.now(timezone.utc)


def _gateway_token_ttl_days() -> int:
    return int(os.getenv("VANTDOMUS_GATEWAY_TOKEN_TTL_DAYS", "90"))


def _new_gateway_token() -> str:
    return "lxn_" + str(uuid.uuid4()).replace("-", "")


def _token_expiry_from_now() -> str:
    return (_utcnow() + timedelta(days=_gateway_token_ttl_days())).isoformat()


def _webhook_rate_limit() -> tuple[int, int]:
    max_events = int(os.getenv("VANTDOMUS_WEBHOOK_RATE_LIMIT_EVENTS", "60"))
    window_seconds = int(os.getenv("VANTDOMUS_WEBHOOK_RATE_LIMIT_WINDOW_SECONDS", "60"))
    return max_events, window_seconds


class GatewayCreate(BaseModel):
    provider_type: str
    status: str = "active"
    meta: Optional[dict] = {}


def _provider_label(provider_type: str) -> str:
    labels = {
        "whatsapp_cloud": "WhatsApp",
        "microsoft_teams": "Microsoft Teams",
        "google_drive": "Google Drive",
        "gmail": "Gmail / correo",
        "school_calendar_upload": "Calendarios escolares",
        "sap_erp_webhook": "SAP S/4HANA",
        "aconex_oracle_api": "Aconex / Oracle P6",
        "sftp_cold_dump": "Buzon SFTP",
    }
    return labels.get(provider_type, provider_type.replace("_", " ").title())


def _text_from_payload(payload: dict) -> str:
    data = payload.get("data", {})
    parts = []
    for key in (
        "text",
        "message",
        "body",
        "caption",
        "transcript",
        "audio_transcript",
        "speech_text",
        "subject",
        "filename",
        "file_name",
        "drive_path",
        "channel",
    ):
        value = data.get(key)
        if value:
            parts.append(str(value))
    if not parts:
        parts.append(json.dumps(data, ensure_ascii=False, default=str))
    return " ".join(parts).strip()


def _detect_due_date(text: str) -> str | None:
    current_year = datetime.now(timezone.utc).year
    match = re.search(r"\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b", text or "")
    if not match:
        return None
    day = int(match.group(1))
    month = int(match.group(2))
    year = int(match.group(3) or current_year)
    if year < 100:
        year += 2000
    try:
        return datetime(year, month, day, 23, 59, tzinfo=timezone.utc).isoformat()
    except ValueError:
        return None


def _classify_agent_event(provider_type: str, event_type: str, data: dict) -> dict:
    text = _text_from_payload({"data": data}).lower()
    provider = _provider_label(provider_type)
    summary = f"{provider}: evento {event_type}"
    actions: list[dict] = []
    category = "inbox"
    priority = "medium"

    if any(word in text for word in ["prueba", "evaluacion", "evaluación", "control", "trabajo", "tarea", "calendario", "agenda"]):
        category = "school_planner"
        priority = "high"
        summary = f"{provider}: posible calendario, prueba o entrega escolar"
        actions.append({
            "type": "create_review_task",
            "title": "Revisar agenda escolar recibida por " + provider,
            "priority": "high",
            "tags": ["ia", "escolar", provider_type],
        })
    elif any(word in text for word in ["factura", "boleta", "pago", "vencimiento", "cuenta", "cobro"]):
        category = "finance"
        summary = f"{provider}: posible gasto, cuenta o vencimiento"
        actions.append({
            "type": "create_review_task",
            "title": "Revisar documento financiero recibido por " + provider,
            "priority": "medium",
            "tags": ["ia", "finanzas", provider_type],
        })
    elif any(word in text for word in ["receta", "medicamento", "doctor", "control medico", "salud"]):
        category = "health"
        priority = "high"
        summary = f"{provider}: posible documento o compromiso de salud"
        actions.append({
            "type": "create_review_task",
            "title": "Revisar compromiso de salud recibido por " + provider,
            "priority": "high",
            "tags": ["ia", "salud", provider_type],
        })
    elif provider_type in {"google_drive", "microsoft_teams", "gmail"}:
        summary = f"{provider}: documento o conversacion pendiente de clasificar"
        actions.append({
            "type": "create_review_task",
            "title": "Clasificar informacion recibida desde " + provider,
            "priority": "medium",
            "tags": ["ia", "documentos", provider_type],
        })

    return {
        "category": category,
        "priority": priority,
        "summary": summary,
        "actions": actions,
        "due_at": _detect_due_date(text),
        "text_excerpt": _text_from_payload({"data": data})[:700],
    }


def _create_agent_review_task(db, *, household_id: str, organization_id: str | None, action: dict, due_at: str | None) -> str:
    task_id = str(uuid.uuid4())
    timestamp = now()
    db.execute(
        """
        INSERT INTO task_items (id,household_id,organization_id,title,status,due_at,assigned_person_id,priority,tags,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            task_id,
            household_id,
            organization_id,
            action["title"],
            "open",
            due_at,
            None,
            action.get("priority", "medium"),
            json.dumps(action.get("tags", []), ensure_ascii=False),
            timestamp,
            timestamp,
        ),
    )
    return task_id


@router.get("/{household_id}/gateways")
def list_gateways(household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "admin")
    gateways = db.execute(
        """
        SELECT id, household_id, organization_id, provider_type, status, last_sync_at,
               token_expires_at, token_rotated_at, created_at, meta
        FROM coupling_gateways
        WHERE household_id=?
        """,
        (household_id,),
    ).fetchall()

    out = []
    for gateway in gateways:
        item = dict(gateway)
        item["meta"] = json.loads(item["meta"]) if item.get("meta") else {}
        out.append(item)
    return {"gateways": out}


@router.get("/{household_id}/agent-events")
def list_agent_events(household_id: str, limit: int = 30, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "member")
    limit = max(1, min(int(limit or 30), 100))
    rows = db.execute(
        """
        SELECT id, trace_id, gateway_id, provider_type, external_event_id, event_type, summary,
               actions, status, created_at, alert_id, task_ids, audit_id, assistant_action_id
        FROM agent_hub_events
        WHERE household_id=?
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (household_id, limit),
    ).fetchall()
    return {
        "items": [
            {
                "id": row["id"],
                "trace_id": row["trace_id"],
                "gateway_id": row["gateway_id"],
                "provider_type": row["provider_type"],
                "external_event_id": row["external_event_id"],
                "event_type": row["event_type"],
                "summary": row["summary"],
                "actions": json.loads(row["actions"] or "[]"),
                "status": row["status"],
                "created_at": row["created_at"],
                "alert_id": row["alert_id"],
                "task_ids": json.loads(row["task_ids"] or "[]"),
                "audit_id": row["audit_id"],
                "assistant_action_id": row["assistant_action_id"],
            }
            for row in rows
        ]
    }


@router.get("/{household_id}/agent-events/{trace_id}")
def get_agent_event_trace(household_id: str, trace_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "member")
    event = db.execute(
        """
        SELECT *
        FROM agent_hub_events
        WHERE household_id=? AND trace_id=?
        """,
        (household_id, trace_id),
    ).fetchone()
    if not event:
        raise HTTPException(status_code=404, detail="Trace not found")

    alert = None
    if event["alert_id"]:
        alert_row = db.execute("SELECT * FROM alerts WHERE id=? AND household_id=?", (event["alert_id"], household_id)).fetchone()
        alert = dict(alert_row) if alert_row else None

    task_ids = json.loads(event["task_ids"] or "[]")
    tasks = []
    if task_ids:
        placeholders = ",".join(["?"] * len(task_ids))
        tasks = [
            dict(row)
            for row in db.execute(
                f"SELECT id, title, status, due_at, priority, tags, created_at FROM task_items WHERE household_id=? AND id IN ({placeholders})",
                (household_id, *task_ids),
            ).fetchall()
        ]

    audit = None
    if event["audit_id"]:
        audit_row = db.execute("SELECT * FROM audit_log WHERE id=? AND household_id=?", (event["audit_id"], household_id)).fetchone()
        audit = dict(audit_row) if audit_row else None

    assistant_action = None
    if event["assistant_action_id"]:
        action_row = db.execute(
            "SELECT * FROM assistant_action_log WHERE id=? AND household_id=?",
            (event["assistant_action_id"], household_id),
        ).fetchone()
        assistant_action = dict(action_row) if action_row else None

    return {
        "event": {
            **dict(event),
            "payload": json.loads(event["payload"] or "{}"),
            "actions": json.loads(event["actions"] or "[]"),
            "task_ids": task_ids,
        },
        "alert": alert,
        "tasks": tasks,
        "audit": audit,
        "assistant_action": assistant_action,
    }


@router.post("/{household_id}/gateways")
def create_gateway(household_id: str, payload: GatewayCreate, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "admin")
    require_verified_email_for_sensitive_action(db, user["user_id"])
    if payload.status not in {"active", "paused", "error"}:
        raise HTTPException(status_code=400, detail="Invalid gateway status")

    gateway_id = str(uuid.uuid4())
    organization_id = get_household_organization_id(db, household_id)
    auth_token = _new_gateway_token()
    token_expires_at = _token_expiry_from_now()
    meta_json = json.dumps(payload.meta or {})

    db.execute(
        """
        INSERT INTO coupling_gateways (id, household_id, organization_id, provider_type, status, auth_token, token_expires_at, token_rotated_at, created_at, meta)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (gateway_id, household_id, organization_id, payload.provider_type, payload.status, auth_token, token_expires_at, now(), now(), meta_json),
    )
    write_audit_log(
        db,
        action="create",
        resource_type="coupling_gateway",
        household_id=household_id,
        user_id=user["user_id"],
        resource_id=gateway_id,
        metadata={"provider_type": payload.provider_type, "status": payload.status},
    )
    db.commit()

    return {"id": gateway_id, "auth_token": auth_token, "status": payload.status, "token_expires_at": token_expires_at}


@router.post("/{household_id}/gateways/{gateway_id}/rotate-token")
def rotate_gateway_token(household_id: str, gateway_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "admin")
    require_verified_email_for_sensitive_action(db, user["user_id"])
    gateway = db.execute(
        "SELECT id FROM coupling_gateways WHERE id=? AND household_id=?",
        (gateway_id, household_id),
    ).fetchone()
    if not gateway:
        raise HTTPException(status_code=404, detail="Gateway not found")

    auth_token = _new_gateway_token()
    token_expires_at = _token_expiry_from_now()
    rotated_at = now()
    db.execute(
        "UPDATE coupling_gateways SET auth_token=?, token_expires_at=?, token_rotated_at=? WHERE id=? AND household_id=?",
        (auth_token, token_expires_at, rotated_at, gateway_id, household_id),
    )
    write_audit_log(
        db,
        action="rotate_token",
        resource_type="coupling_gateway",
        household_id=household_id,
        user_id=user["user_id"],
        resource_id=gateway_id,
        metadata={"token_expires_at": token_expires_at},
    )
    db.commit()
    return {"id": gateway_id, "auth_token": auth_token, "token_expires_at": token_expires_at}


class WebhookPayload(BaseModel):
    event_type: str
    data: dict


@router.post("/webhook/{gateway_id}")
def receive_telemetry(
    gateway_id: str,
    payload: WebhookPayload,
    authorization: Optional[str] = Header(None),
    x_vantdomus_event_id: Optional[str] = Header(None),
    db=Depends(get_db),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")

    token = authorization.split(" ", 1)[1]
    gateway = db.execute("SELECT * FROM coupling_gateways WHERE id=? AND status='active'", (gateway_id,)).fetchone()
    # SECURITY: compare gateway token in constant time to avoid leaking the
    # token byte-by-byte via response-time timing. Always feed compare_digest
    # two strings even when gateway is None so the false branch still spends
    # a comparable amount of time (mild timing parity).
    expected = gateway["auth_token"] if gateway else ""
    if not gateway or not hmac.compare_digest(str(expected), str(token)):
        raise HTTPException(status_code=403, detail="Invalid Gateway or Token")
    if gateway["token_expires_at"] and datetime.fromisoformat(gateway["token_expires_at"]) <= _utcnow():
        raise HTTPException(status_code=403, detail="Gateway token expired")

    event_id = (x_vantdomus_event_id or "").strip()
    if not event_id:
        raise HTTPException(status_code=400, detail="Missing X-VantDomus-Event-Id header")

    duplicate = db.execute(
        "SELECT id FROM webhook_ingest_log WHERE gateway_id=? AND event_id=?",
        (gateway_id, event_id),
    ).fetchone()
    if duplicate:
        raise HTTPException(status_code=409, detail="Duplicate webhook event")

    max_events, window_seconds = _webhook_rate_limit()
    window_start = (datetime.now(timezone.utc) - timedelta(seconds=window_seconds)).isoformat()
    recent_count = db.execute(
        "SELECT COUNT(*) AS c FROM webhook_ingest_log WHERE gateway_id=? AND created_at>=?",
        (gateway_id, window_start),
    ).fetchone()["c"]
    if int(recent_count) >= max_events:
        raise HTTPException(status_code=429, detail="Webhook rate limit exceeded")

    timestamp = now()
    trace_id = "trace_" + str(uuid.uuid4())
    agent_event_id = str(uuid.uuid4())
    webhook_log_id = str(uuid.uuid4())
    db.execute("UPDATE coupling_gateways SET last_sync_at=? WHERE id=?", (timestamp, gateway_id))

    agent_result = _classify_agent_event(gateway["provider_type"], payload.event_type, payload.data)
    task_ids: list[str] = []
    concrete_actions = []
    for action in agent_result["actions"]:
        if action.get("type") == "create_review_task":
            task_id = _create_agent_review_task(
                db,
                household_id=gateway["household_id"],
                organization_id=gateway["organization_id"],
            action=action,
            due_at=agent_result.get("due_at"),
            )
            task_ids.append(task_id)
            concrete_actions.append({**action, "task_id": task_id})

    alert_id = str(uuid.uuid4())
    title = f"VantIA recibio informacion externa: {_provider_label(gateway['provider_type'])}"
    message = json.dumps(
        {
            "summary": agent_result["summary"],
            "category": agent_result["category"],
            "excerpt": agent_result["text_excerpt"],
            "actions": concrete_actions,
            "trace_id": trace_id,
        },
        ensure_ascii=False,
    )
    db.execute(
        """
        INSERT INTO alerts (id, household_id, organization_id, severity, title, message, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (alert_id, gateway["household_id"], gateway["organization_id"], agent_result["priority"], title, message, "open", timestamp),
    )
    db.execute(
        """
        INSERT INTO agent_hub_events (
          id, household_id, organization_id, gateway_id, provider_type, external_event_id,
          event_type, summary, payload, actions, status, created_at, trace_id, alert_id, task_ids
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            agent_event_id,
            gateway["household_id"],
            gateway["organization_id"],
            gateway_id,
            gateway["provider_type"],
            event_id,
            payload.event_type,
            agent_result["summary"],
            json.dumps(payload.data, ensure_ascii=False, default=str),
            json.dumps(concrete_actions, ensure_ascii=False, default=str),
            "triaged",
            timestamp,
            trace_id,
            alert_id,
            json.dumps(task_ids, ensure_ascii=False),
        ),
    )
    db.execute(
        """
        INSERT INTO webhook_ingest_log (id, gateway_id, household_id, organization_id, event_id, event_type, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (webhook_log_id, gateway_id, gateway["household_id"], gateway["organization_id"], event_id, payload.event_type, "ingested", timestamp),
    )
    audit_id = write_audit_log(
        db,
        action="webhook_ingest",
        resource_type="agent_hub_event",
        household_id=gateway["household_id"],
        resource_id=agent_event_id,
        metadata={
            "trace_id": trace_id,
            "gateway_id": gateway_id,
            "provider_type": gateway["provider_type"],
            "event_type": payload.event_type,
            "event_id": event_id,
            "webhook_log_id": webhook_log_id,
            "alert_id": alert_id,
            "task_ids": task_ids,
        },
    )
    assistant_action_id = write_assistant_action_log(
        db,
        household_id=gateway["household_id"],
        organization_id=gateway["organization_id"],
        tool_name="agent_hub_triage",
        arguments={
            "trace_id": trace_id,
            "gateway_id": gateway_id,
            "provider_type": gateway["provider_type"],
            "event_type": payload.event_type,
            "event_id": event_id,
        },
        result=json.dumps({"summary": agent_result["summary"], "task_ids": task_ids, "alert_id": alert_id, "trace_id": trace_id}, ensure_ascii=False),
        status="success",
    )
    db.execute(
        """
        UPDATE agent_hub_events
        SET audit_id=?, assistant_action_id=?
        WHERE id=?
        """,
        (audit_id, assistant_action_id, agent_event_id),
    )
    db.commit()

    return {
        "status": "ingested",
        "event_type": payload.event_type,
        "alert_id": alert_id,
        "trace_id": trace_id,
        "agent": {
            "summary": agent_result["summary"],
            "category": agent_result["category"],
            "actions": concrete_actions,
            "task_ids": task_ids,
            "trace_id": trace_id,
        },
    }
