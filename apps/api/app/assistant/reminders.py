"""
OPS-2 M7.A — Recordatorios programables + bandeja de notificaciones in-app.

La familia crea recordatorios reales ("recuérdame X a tal hora"). No hay cron
always-on en el piloto, así que la entrega es PULL e IDEMPOTENTE: cada vez que
alguien consulta sus notificaciones, `deliver_due` marca como 'delivered' (una
sola vez) los recordatorios ya vencidos. El usuario los ve en la campana y los
descarta (acuse). El push real (Web Push/VAPID) es M7.B y depende de llaves.

Privacidad: mismos criterios que M1 (self / tutela / hogar). Un recordatorio
privado de otro integrante nunca aparece en tu campana.

Estados: pending -> delivered -> dismissed ; pending/delivered -> cancelled.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

ALLOWED_SCOPES = {"private_self", "guardian_supervised", "household_shared"}
_MAX_TITLE = 200
_MAX_BODY = 1000
_MAX_ITEMS = 100


def _now_dt() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now_dt().isoformat()


def _parse(iso: str | None) -> datetime | None:
    """Parsea ISO-8601 a datetime UTC (acepta sufijo Z y naive=UTC)."""
    if not iso:
        return None
    try:
        s = iso.strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except (ValueError, TypeError):
        return None


def _active_guarded_person_ids(db, guardian_person_id: str | None) -> set[str]:
    if not guardian_person_id:
        return set()
    try:
        rows = db.execute(
            "SELECT minor_person_id FROM guardian_relationships "
            "WHERE guardian_person_id=? AND revoked_at IS NULL",
            (guardian_person_id,),
        ).fetchall()
        return {r["minor_person_id"] for r in rows}
    except Exception:
        return set()


def _can_see(*, scope: str, subject_pid: str | None, created_by: str | None,
             req_uid: str | None, req_pid: str | None, req_role: str | None,
             guarded: set[str]) -> bool:
    """¿El requester puede ver este recordatorio? (mismo criterio que M1)."""
    if scope == "household_shared":
        return True  # ya está acotado al hogar
    if scope == "private_self":
        return (req_pid is not None and req_pid == subject_pid) or (
            req_uid is not None and req_uid == created_by)
    if scope == "guardian_supervised":
        return (req_pid is not None and req_pid == subject_pid) or (
            subject_pid is not None and subject_pid in guarded)
    return False


def create_reminder(
    db, *,
    household_id: str,
    organization_id: str | None,
    person_id: str | None,
    created_by_user_id: str,
    title: str,
    body: str | None,
    remind_at: str,
    visibility_scope: str = "household_shared",
    dedupe_key: str | None = None,
) -> str:
    """Crea un recordatorio. Idempotente por dedupe_key. Devuelve el id."""
    title = (title or "").strip()
    if not title:
        raise ValueError("El recordatorio necesita un título")
    if visibility_scope not in ALLOWED_SCOPES:
        raise ValueError(f"visibility_scope no permitido: {visibility_scope}")
    dt = _parse(remind_at)
    if dt is None:
        raise ValueError("Fecha/hora del recordatorio inválida")

    if dedupe_key:
        existing = db.execute(
            "SELECT id FROM family_reminders WHERE household_id=? AND dedupe_key=?",
            (household_id, dedupe_key),
        ).fetchone()
        if existing:
            return existing["id"]

    rid = str(uuid.uuid4())
    db.execute(
        "INSERT INTO family_reminders "
        "(id, household_id, organization_id, person_id, created_by_user_id, title, body, "
        "remind_at, channel, visibility_scope, status, dedupe_key, created_at) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (rid, household_id, organization_id, person_id, created_by_user_id,
         title[:_MAX_TITLE], (body or "").strip()[:_MAX_BODY] or None,
         dt.isoformat(), "in_app", visibility_scope, "pending", dedupe_key, _now_iso()),
    )
    return rid


def deliver_due(db, household_id: str, now_iso: str | None = None) -> int:
    """
    Entrega PULL idempotente: marca 'delivered' los recordatorios 'pending' ya
    vencidos. Solo toca filas 'pending', así que llamarlo dos veces no duplica.
    Devuelve cuántos se entregaron en esta pasada.
    """
    now_dt = _parse(now_iso) or _now_dt()
    rows = db.execute(
        "SELECT id, remind_at FROM family_reminders "
        "WHERE household_id=? AND status='pending'",
        (household_id,),
    ).fetchall()
    due_ids = [r["id"] for r in rows if (_parse(r["remind_at"]) or now_dt) <= now_dt]
    if not due_ids:
        return 0
    stamp = now_dt.isoformat()
    delivered = 0
    for rid in due_ids:
        cur = db.execute(
            "UPDATE family_reminders SET status='delivered', delivered_at=? "
            "WHERE id=? AND status='pending'",
            (stamp, rid),
        )
        delivered += (cur.rowcount or 0)
    db.commit()
    return delivered


def _rows_for_household(db, household_id: str):
    return db.execute(
        "SELECT r.id, r.person_id, r.created_by_user_id, r.title, r.body, r.remind_at, "
        "r.visibility_scope, r.status, r.delivered_at, p.display_name "
        "FROM family_reminders r LEFT JOIN persons p ON p.id = r.person_id "
        "WHERE r.household_id=? AND r.status != 'cancelled' "
        "ORDER BY r.remind_at ASC LIMIT 400",
        (household_id,),
    ).fetchall()


def _visible(rows, *, req_uid, req_pid, req_role, guarded) -> list:
    out = []
    for r in rows:
        scope = r["visibility_scope"] or "household_shared"
        if _can_see(scope=scope, subject_pid=r["person_id"], created_by=r["created_by_user_id"],
                    req_uid=req_uid, req_pid=req_pid, req_role=req_role, guarded=guarded):
            out.append(r)
    return out


def _first_name(name: str | None, has_person: bool) -> str:
    if not has_person:
        return "familia"
    return (name or "").strip().split(" ")[0] or "Integrante"


def list_for_user(
    db, household_id: str, *,
    requester_user_id: str | None,
    requester_person_id: str | None,
    requester_role: str | None,
    now_iso: str | None = None,
    include_dismissed: bool = False,
) -> dict:
    """
    Corre la entrega pull y devuelve las notificaciones que el usuario puede ver.
    {items:[...], unseen: N}. unseen = entregadas y no descartadas (la campana).
    """
    deliver_due(db, household_id, now_iso)
    guarded = _active_guarded_person_ids(db, requester_person_id)
    rows = _visible(_rows_for_household(db, household_id),
                    req_uid=requester_user_id, req_pid=requester_person_id,
                    req_role=requester_role, guarded=guarded)
    items, unseen = [], 0
    for r in rows:
        status = r["status"]
        if status == "dismissed" and not include_dismissed:
            continue
        is_due = status == "delivered"
        if is_due:
            unseen += 1
        items.append({
            "id": r["id"],
            "title": r["title"],
            "body": r["body"],
            "remind_at": r["remind_at"],
            "for": _first_name(r["display_name"], bool(r["person_id"])),
            "status": status,
            "is_due": is_due,
        })
    return {"items": items[:_MAX_ITEMS], "unseen": unseen}


def _can_manage(db, household_id: str, reminder_id: str, *,
                req_uid, req_pid, req_role) -> bool:
    row = db.execute(
        "SELECT person_id, created_by_user_id, visibility_scope FROM family_reminders "
        "WHERE id=? AND household_id=? AND status != 'cancelled'",
        (reminder_id, household_id),
    ).fetchone()
    if not row:
        return False
    guarded = _active_guarded_person_ids(db, req_pid)
    if not _can_see(scope=row["visibility_scope"] or "household_shared",
                    subject_pid=row["person_id"], created_by=row["created_by_user_id"],
                    req_uid=req_uid, req_pid=req_pid, req_role=req_role, guarded=guarded):
        return False
    return (
        req_uid == row["created_by_user_id"]
        or (req_pid is not None and req_pid == row["person_id"])
        or req_role in ("owner", "admin")
        or (row["person_id"] is not None and row["person_id"] in guarded)
    )


def dismiss(db, household_id: str, reminder_id: str, *,
            requester_user_id, requester_person_id, requester_role) -> bool:
    """Acuse: marca 'dismissed' si el requester puede gestionarlo. Idempotente."""
    if not _can_manage(db, household_id, reminder_id,
                       req_uid=requester_user_id, req_pid=requester_person_id, req_role=requester_role):
        return False
    cur = db.execute(
        "UPDATE family_reminders SET status='dismissed', dismissed_at=? "
        "WHERE id=? AND household_id=? AND status IN ('pending','delivered')",
        (_now_iso(), reminder_id, household_id),
    )
    db.commit()
    return True  # can_manage pasó; si ya estaba dismissed, sigue siendo éxito idempotente
