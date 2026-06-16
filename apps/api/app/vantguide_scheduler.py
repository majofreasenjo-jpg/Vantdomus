"""
VantGuide Scheduler — diseño y core sin runtime.

Este módulo evalúa UnitFunctions activos y emite FunctionEvents
correspondientes (reminder_due, checkin_due, missed, escalation_due,
reward_due, summary_due).

Ver `docs/VANTGUIDE_ARCHITECTURE.md §8` para el diseño completo.

ESTRATEGIA:
    Esta primera versión NO arranca un background runner. El loop principal
    `tick()` está implementado y es idempotente. Para activarlo en
    producción hay 3 opciones que NO requieren refactor:

    1. **Cron externo**: corremos `python -m app.vantguide_scheduler` desde
       crontab/systemd/Render cron jobs. Es lo más simple. Una invocación
       cada minuto alcanza para resolución <1 min en recordatorios.

    2. **APScheduler in-process**: agregamos en `main.py` un
       `BackgroundScheduler` que llame a `tick()` cada N segundos. Más
       acoplado pero sin infraestructura extra. Requiere proceso uvicorn
       de larga vida (no serverless).

    3. **Celery / RQ worker separado**: un job runner que llama a `tick()`.
       Más limpio para multi-tenant a escala. Requiere broker (Redis).

    Sea cual sea la elección, `tick()` es la función reutilizable.

IDEMPOTENCIA:
    `dedupe_key = function_id|scheduled_for|event_type` está marcado UNIQUE
    en `function_events`. Si `tick()` corre dos veces para el mismo minuto,
    el segundo INSERT falla silenciosamente y no se duplica el recordatorio.

ZONAS HORARIAS:
    Cada household tiene `meta.tz` (ej. "America/Santiago"). El scheduler
    expande horarios en la TZ local del household, después convierte a UTC
    para el `scheduled_for`. Las notifications.py interpretan UTC al
    despachar.

LIMITES DE DISEÑO:
    - Recurrence: por ahora solo `daily` y `once`. `weekly` se agrega después.
    - Sensores IoT / sensor → trigger no están conectados; el scheduler
      solo lee la DB.
    - Voz para verificación tampoco está conectada; el verification_mode
      `voice` se ignora por ahora.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

try:
    from zoneinfo import ZoneInfo
except ImportError:  # Python < 3.9 fallback (no debería pasar — requirements pinneados a 3.11)
    ZoneInfo = None  # type: ignore

logger = logging.getLogger(__name__)


# =============================================================================
# Helpers
# =============================================================================

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _resolve_tz(tz_name: Optional[str]) -> "timezone | ZoneInfo":
    """Resuelve TZ con fallback seguro a UTC si no se puede."""
    if not tz_name or ZoneInfo is None:
        return timezone.utc
    try:
        return ZoneInfo(tz_name)
    except Exception:
        logger.warning("Unknown timezone %s, defaulting to UTC", tz_name)
        return timezone.utc


def _household_tz(db, household_id: Optional[str]) -> str:
    """Devuelve el tz del household o America/Santiago como default familia."""
    if not household_id:
        return "UTC"
    row = db.execute(
        "SELECT meta FROM households WHERE id=?",
        (household_id,),
    ).fetchone()
    if not row or not row["meta"]:
        return "America/Santiago"
    try:
        meta = json.loads(row["meta"])
        return meta.get("tz") or "America/Santiago"
    except Exception:
        return "America/Santiago"


def _insert_event_if_new(
    db,
    *,
    unit_function_id: str,
    household_id: Optional[str],
    organization_id: Optional[str],
    event_type: str,
    scheduled_for: str,
    actual_at: Optional[str] = None,
    payload: Optional[dict] = None,
) -> bool:
    """
    Inserta un function_event con dedupe_key. Devuelve True si insertó,
    False si era duplicado (otro tick ya lo había puesto).
    """
    dedupe = f"{unit_function_id}|{scheduled_for}|{event_type}"
    existing = db.execute(
        "SELECT 1 FROM function_events WHERE dedupe_key=?",
        (dedupe,),
    ).fetchone()
    if existing:
        return False

    now_iso = _now_utc().isoformat()
    ev_id = str(uuid.uuid4())
    try:
        db.execute(
            "INSERT INTO function_events ("
            "id, unit_function_id, household_id, organization_id, event_type, "
            "scheduled_for, actual_at, payload, triggered_by, "
            "dedupe_key, created_at"
            ") VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (
                ev_id, unit_function_id, household_id, organization_id, event_type,
                scheduled_for, actual_at or now_iso,
                json.dumps(payload or {}, ensure_ascii=False),
                "scheduler", dedupe, now_iso,
            ),
        )
        return True
    except Exception as exc:
        # Race condition: otro proceso insertó entre nuestro SELECT y nuestro INSERT.
        # El UNIQUE constraint nos protege; tragar el error explícitamente.
        if "UNIQUE" in str(exc).upper() or "constraint" in str(exc).lower():
            return False
        raise


# =============================================================================
# Expansión de horarios
# =============================================================================

def _expand_daily_schedule(
    schedule: dict,
    function_due_at: Optional[str],
    tz_name: str,
    horizon_minutes: int = 5,
) -> list[str]:
    """
    Dado un `schedule` con forma {"times":["08:00","20:00"], "days":[1..7]},
    devuelve los ISO timestamps UTC de las invocaciones que caen dentro
    del próximo `horizon_minutes` desde ahora.

    Para una función con `recurrence='daily'` y `times=["08:00","20:00"]`,
    si son las 07:58 UTC-3 (= 10:58 UTC) en Santiago, este método devuelve:
        ["2026-06-16T11:00:00+00:00"]  # las 08:00 Santiago de hoy

    Para recurrence='once' usa function_due_at directamente.
    """
    tz = _resolve_tz(tz_name)
    now_utc = _now_utc()
    horizon_end_utc = now_utc + timedelta(minutes=horizon_minutes)

    times = schedule.get("times", [])
    days = schedule.get("days", [1, 2, 3, 4, 5, 6, 7])  # 1=Mon..7=Sun

    results: list[str] = []
    # Mirar hoy y mañana (para el caso 23:59 → 00:01 cross-day)
    for offset_days in (0, 1):
        local_today = (now_utc.astimezone(tz)).date() + timedelta(days=offset_days)
        weekday_iso = local_today.isoweekday()  # 1=Mon..7=Sun
        if weekday_iso not in days:
            continue
        for t in times:
            try:
                hh, mm = [int(x) for x in t.split(":", 1)]
            except (ValueError, AttributeError):
                continue
            local_dt = datetime(
                local_today.year, local_today.month, local_today.day,
                hh, mm, 0, tzinfo=tz,
            )
            utc_dt = local_dt.astimezone(timezone.utc)
            if now_utc <= utc_dt <= horizon_end_utc:
                results.append(utc_dt.isoformat())

    return results


# =============================================================================
# Loop principal del scheduler
# =============================================================================

def tick(db, *, horizon_minutes: int = 5) -> dict:
    """
    Recorre todas las UnitFunctions activas y emite los eventos *_due
    apropiados.

    Args:
        db: conexión DB activa
        horizon_minutes: ventana hacia adelante. Si el scheduler corre cada
            minuto, 5 minutos da margen. Si corre cada hora, subilo.

    Returns:
        dict con métricas: cuántos events emitió y de qué tipos.
    """
    metrics = {
        "scanned": 0,
        "reminder_due_emitted": 0,
        "missed_emitted": 0,
        "escalation_emitted": 0,
        "skipped_duplicate": 0,
    }

    rows = db.execute(
        "SELECT * FROM unit_functions WHERE status IN ('open', 'in_progress')"
    ).fetchall()
    now_utc = _now_utc()

    for row in rows:
        metrics["scanned"] += 1
        household_id = row["household_id"]
        organization_id = row["organization_id"]
        uf_id = row["id"]
        try:
            schedule = json.loads(row["schedule"] or "{}")
        except Exception:
            schedule = {}
        recurrence = row["recurrence"]
        due_at = row["due_at"]
        tz_name = _household_tz(db, household_id) if household_id else "UTC"

        # ---- 1. reminder_due para schedules recurrentes ----
        if schedule.get("times"):
            for scheduled_iso in _expand_daily_schedule(schedule, due_at, tz_name, horizon_minutes):
                inserted = _insert_event_if_new(
                    db,
                    unit_function_id=uf_id,
                    household_id=household_id,
                    organization_id=organization_id,
                    event_type="reminder_due",
                    scheduled_for=scheduled_iso,
                    payload={"category": row["category"], "title": row["title"]},
                )
                if inserted:
                    metrics["reminder_due_emitted"] += 1
                else:
                    metrics["skipped_duplicate"] += 1

        # ---- 2. missed: pasó due_at y no hay evidencia ni checkin completado ----
        if due_at and recurrence != "daily":
            try:
                due_dt = datetime.fromisoformat(due_at.replace("Z", "+00:00"))
                if due_dt.tzinfo is None:
                    due_dt = due_dt.replace(tzinfo=timezone.utc)
            except Exception:
                due_dt = None

            if due_dt and due_dt < now_utc:
                # ¿Hubo "completed" o evidencia positiva?
                has_completion = db.execute(
                    "SELECT 1 FROM function_events "
                    "WHERE unit_function_id=? AND event_type IN ('completed','rewarded') "
                    "LIMIT 1",
                    (uf_id,),
                ).fetchone()
                if not has_completion:
                    inserted = _insert_event_if_new(
                        db,
                        unit_function_id=uf_id,
                        household_id=household_id,
                        organization_id=organization_id,
                        event_type="missed",
                        scheduled_for=due_at,
                        payload={"reason": "due_passed_no_completion"},
                    )
                    if inserted:
                        metrics["missed_emitted"] += 1

        # ---- 3. escalation_due: 2 missed consecutivos ----
        missed_count = db.execute(
            "SELECT COUNT(*) as c FROM function_events "
            "WHERE unit_function_id=? AND event_type='missed'",
            (uf_id,),
        ).fetchone()
        if missed_count and missed_count["c"] >= 2:
            # Solo escalamos si responsable existe
            if row["responsible_person_id"]:
                inserted = _insert_event_if_new(
                    db,
                    unit_function_id=uf_id,
                    household_id=household_id,
                    organization_id=organization_id,
                    event_type="escalation_due",
                    scheduled_for=now_utc.isoformat(),
                    payload={
                        "reason": "consecutive_missed_threshold",
                        "missed_count": missed_count["c"],
                        "target_role": "responsible",
                        "target_person_id": row["responsible_person_id"],
                    },
                )
                if inserted:
                    metrics["escalation_emitted"] += 1

    db.commit()
    logger.info("vantguide_scheduler tick complete: %s", metrics)
    return metrics


# =============================================================================
# CLI: permite correrlo desde cron `python -m app.vantguide_scheduler`
# =============================================================================

def main():
    """Entry point para ejecución manual (cron / cron job / debug)."""
    import logging
    import sys
    from .db import connect

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    db = connect()
    try:
        result = tick(db)
        print(json.dumps(result, indent=2))
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
