"""
OPS-2 M7.B — Web Push (VAPID) para recordatorios que llegan al teléfono aunque
la app esté cerrada.

TODO fail-closed y OPCIONAL:
  - Sin llaves VAPID en el entorno → push DESHABILITADO.
  - Sin la librería `pywebpush` instalada → push DESHABILITADO (no rompe el boot).
  - Solo en perfiles operativos (family-live/staging/prod), NUNCA family-pilot.
En cualquiera de esos casos, los recordatorios siguen avisando dentro de la app
(M7.A). El envío real lo dispara un Cron Job → POST /assistant/reminders/tick.

Config (variables de entorno, NUNCA en el repo):
  VAPID_PUBLIC_KEY   — clave pública (base64url) que el navegador usa para suscribir.
  VAPID_PRIVATE_KEY  — clave privada (base64url / PEM) para firmar. Secreta.
  VAPID_SUBJECT      — 'mailto:tucorreo@dominio' (contacto para el push service).
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_MAX_PAYLOAD = 3500  # los push services limitan ~4KB; dejamos margen.


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def vapid_public_key() -> str:
    return os.getenv("VAPID_PUBLIC_KEY", "").strip()


def _vapid_private_key() -> str:
    return os.getenv("VAPID_PRIVATE_KEY", "").strip()


def _vapid_subject() -> str:
    return os.getenv("VAPID_SUBJECT", "").strip()


def push_configured() -> bool:
    """¿Están las tres piezas VAPID presentes? (no valida la librería)."""
    return bool(vapid_public_key() and _vapid_private_key() and _vapid_subject())


def push_enabled() -> bool:
    """
    ¿Se puede enviar push REAL ahora mismo? Requiere perfil operativo + llaves
    VAPID + librería disponible. Fail-closed: ante la duda, False.
    """
    try:
        from ..config import is_family_live, settings
        env = settings.APP_ENV.strip().lower()
        operational = is_family_live() or env in {"staging", "production", "prod"}
    except Exception:
        operational = False
    if not operational:
        return False
    if not push_configured():
        return False
    return _library_available()


def _library_available() -> bool:
    try:
        import pywebpush  # noqa: F401
        return True
    except Exception:
        return False


# --------------------------------------------------------------------------
# Suscripciones
# --------------------------------------------------------------------------
def save_subscription(
    db, *, household_id: str, person_id: str | None, user_id: str | None,
    endpoint: str, p256dh: str, auth: str, ua: str | None = None,
) -> str:
    """Upsert por endpoint. Devuelve el id."""
    endpoint = (endpoint or "").strip()
    p256dh = (p256dh or "").strip()
    auth = (auth or "").strip()
    if not (endpoint and p256dh and auth):
        raise ValueError("Suscripción incompleta (endpoint/p256dh/auth)")
    existing = db.execute(
        "SELECT id FROM web_push_subscriptions WHERE endpoint=?", (endpoint,)
    ).fetchone()
    if existing:
        db.execute(
            "UPDATE web_push_subscriptions SET household_id=?, person_id=?, user_id=?, "
            "p256dh=?, auth=?, ua=?, failing_since=NULL WHERE id=?",
            (household_id, person_id, user_id, p256dh, auth, (ua or "")[:300], existing["id"]),
        )
        db.commit()
        return existing["id"]
    sid = str(uuid.uuid4())
    db.execute(
        "INSERT INTO web_push_subscriptions "
        "(id, household_id, person_id, user_id, endpoint, p256dh, auth, ua, created_at) "
        "VALUES (?,?,?,?,?,?,?,?,?)",
        (sid, household_id, person_id, user_id, endpoint, p256dh, auth, (ua or "")[:300], _now()),
    )
    db.commit()
    return sid


def delete_subscription(db, *, endpoint: str, household_id: str) -> bool:
    cur = db.execute(
        "DELETE FROM web_push_subscriptions WHERE endpoint=? AND household_id=?",
        ((endpoint or "").strip(), household_id),
    )
    db.commit()
    return (cur.rowcount or 0) > 0


def _subscriptions_for(db, household_id: str, person_id: str | None) -> list:
    """
    Suscripciones destino. Si person_id está definido → solo sus dispositivos
    (respeta privacidad de un recordatorio dirigido). Si es None → todo el hogar.
    """
    if person_id:
        rows = db.execute(
            "SELECT id, endpoint, p256dh, auth FROM web_push_subscriptions "
            "WHERE household_id=? AND person_id=?",
            (household_id, person_id),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT id, endpoint, p256dh, auth FROM web_push_subscriptions WHERE household_id=?",
            (household_id,),
        ).fetchall()
    return rows


# --------------------------------------------------------------------------
# Envío
# --------------------------------------------------------------------------
def _send_raw(*, endpoint: str, p256dh: str, auth: str, payload: str) -> int:
    """
    Envía UN push cifrado. Devuelve el status HTTP (201/200 = ok; 404/410 =
    suscripción muerta). Import perezoso: si falta pywebpush, lo trata como fallo
    recuperable (código 0) sin romper nada.
    """
    try:
        from pywebpush import webpush  # import perezoso
    except Exception:
        logger.warning("web_push: pywebpush no instalado; push omitido")
        return 0
    try:
        resp = webpush(
            subscription_info={"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}},
            data=payload,
            vapid_private_key=_vapid_private_key(),
            vapid_claims={"sub": _vapid_subject()},
            timeout=10,
        )
        return int(getattr(resp, "status_code", 201) or 201)
    except Exception as exc:
        code = getattr(getattr(exc, "response", None), "status_code", 0) or 0
        if code not in (404, 410):
            logger.warning("web_push: fallo enviando (%s)", str(exc)[:160])
        return int(code)


def notify_person(
    db, *, household_id: str, person_id: str | None,
    title: str, body: str = "", url: str = "/",
) -> dict:
    """
    Envía un push a los dispositivos del destinatario. Best-effort: nunca lanza.
    Limpia suscripciones muertas (404/410). Devuelve {sent, dead, skipped}.
    """
    if not push_enabled():
        return {"sent": 0, "dead": 0, "skipped": True}
    payload = json.dumps({"title": title[:120], "body": (body or "")[:400], "url": url})[:_MAX_PAYLOAD]
    subs = _subscriptions_for(db, household_id, person_id)
    sent, dead = 0, 0
    for s in subs:
        code = _send_raw(endpoint=s["endpoint"], p256dh=s["p256dh"], auth=s["auth"], payload=payload)
        if code in (200, 201):
            sent += 1
            db.execute("UPDATE web_push_subscriptions SET last_ok_at=?, failing_since=NULL WHERE id=?",
                       (_now(), s["id"]))
        elif code in (404, 410):
            dead += 1
            db.execute("DELETE FROM web_push_subscriptions WHERE id=?", (s["id"],))
        else:
            db.execute("UPDATE web_push_subscriptions SET failing_since=COALESCE(failing_since, ?) WHERE id=?",
                       (_now(), s["id"]))
    db.commit()
    return {"sent": sent, "dead": dead, "skipped": False}
