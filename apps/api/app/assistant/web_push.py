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
import re
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


def safe_relative_url(url: str | None) -> str:
    """
    M7.B hardening — La URL que viaja en el push SOLO puede ser una ruta interna
    (same-origin). Rechaza absolutas (`https://…`), protocol-relative (`//host`),
    esquemas raros (`javascript:`) y variantes con backslash. Ante cualquier duda
    devuelve "/" (fail-safe): así un payload manipulado no puede llevar a nadie
    fuera de la app desde la notificación.
    """
    raw = (url or "").strip()
    if not raw.startswith("/"):
        return "/"
    if raw.startswith("//") or raw.startswith("/\\"):
        return "/"
    if any(ch in raw for ch in ("\r", "\n", "\t")) or "\\" in raw:
        return "/"
    # `/algo:` podría interpretarse como esquema en algunos navegadores.
    if re.match(r"^/[a-z][a-z0-9+.\-]*:", raw, re.IGNORECASE):
        return "/"
    return raw[:300]


# R94-FastShip — PRIVACIDAD EN PANTALLA BLOQUEADA, garantizada en el EMISOR.
#
# Antes, `notify_person` aceptaba `title`/`body` libres y un docstring pedía que
# fueran genéricos: eso es una convención, no una garantía. Un emisor futuro
# descuidado podía poner el texto de un recordatorio en la pantalla bloqueada.
# Ahora el emisor NO acepta texto libre: elige entre un conjunto CERRADO de
# mensajes aprobados. El contenido sensible se queda dentro de la app, tras la
# sesión. (El service worker impone lo mismo como última capa.)
LOCKSCREEN_MESSAGES: dict[str, tuple[str, str]] = {
    "reminder": ("VantDomus", "Tienes un recordatorio"),
}
DEFAULT_CATEGORY = "reminder"


def notify_person(
    db, *, household_id: str, person_id: str | None,
    category: str = DEFAULT_CATEGORY, url: str = "/", tag: str | None = None,
) -> dict:
    """
    Envía un push a los dispositivos del destinatario. Best-effort: nunca lanza.
    Limpia suscripciones muertas (404/410). Devuelve {sent, dead, skipped}.

    `category` elige el texto visible dentro de `LOCKSCREEN_MESSAGES`; NO se
    acepta texto libre, de modo que es imposible filtrar contenido familiar a
    la pantalla bloqueada desde aquí. Una categoría desconocida cae al mensaje
    por defecto (fail-safe) en vez de propagar nada del llamador.
    `tag` permite que un reenvío reemplace la notificación anterior en vez de
    apilar duplicados.
    """
    if not push_enabled():
        return {"sent": 0, "dead": 0, "skipped": True}
    title, body = LOCKSCREEN_MESSAGES.get(category) or LOCKSCREEN_MESSAGES[DEFAULT_CATEGORY]
    data = {"title": title, "body": body, "url": safe_relative_url(url)}
    if tag:
        data["tag"] = str(tag)[:120]
    payload = json.dumps(data)[:_MAX_PAYLOAD]
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
