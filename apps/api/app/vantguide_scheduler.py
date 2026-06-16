"""
VantGuide Scheduler — runtime hardened (VG+1).

Recorre las UnitFunctions activas y emite FunctionEvents (reminder_due,
missed, escalation_due). Pensado para ejecutarse como **proceso/cron
externo** (Render cron, systemd timer, crontab), NO embebido en uvicorn.

VG+1 cambios vs versión 260:

  1. **Advisory lock global**:
     - Postgres: `pg_try_advisory_lock(SCHEDULER_LOCK_ID)` impide dos
       procesos corriendo simultáneamente.
     - SQLite: fila en `scheduler_runs` con `lease_until` actúa como lock.
     Si no obtiene el lock, registra "skipped_locked" y sale sin error.

  2. **Idempotencia robusta via índice UNIQUE compuesto**:
     `function_events (unit_function_id, scheduled_for, event_type)` con
     `scheduled_for IS NOT NULL`. La columna `dedupe_key` queda como
     fallback para eventos especiales.

  3. **AI confirmation gating** (decisión 7 de Codex):
     Funciones con `ai_needs_confirmation=1` y `confirmed_at IS NULL`
     NO disparan recordatorios. Quedan en cola hasta que un humano
     confirme via `POST /unit_functions/{id}/confirm`.

  4. **Métricas estructuradas** persistidas en `scheduler_runs`:
     started_at / finished_at / lease_until / status / functions_scanned /
     reminder_due_emitted / missed_emitted / escalations_emitted /
     duplicates_skipped / errors.

  5. **CLI canónico**: `python -m app.vantguide_scheduler` — pensado para
     que el orquestador (cron/systemd/Render) lo ejecute cada minuto.

Importante:
  - NO requiere Redis / Celery. La elección de cron externo es deliberada
    (decisión 6 de Codex) — simplicidad y cero infra adicional para MVP.
  - Resolución: 1 minuto. Suficiente para familia y B2B inicial.
"""

from __future__ import annotations

import json
import logging
import os
import socket
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

try:
    from zoneinfo import ZoneInfo
except ImportError:
    ZoneInfo = None  # type: ignore

logger = logging.getLogger(__name__)


# =============================================================================
# Constantes
# =============================================================================

# Identificador estable usado por pg_try_advisory_lock. Hash arbitrario de
# "vantguide-scheduler" — debe ser único dentro del cluster Postgres.
SCHEDULER_LOCK_ID = 7531009254  # cualquier int64 estable funciona

# Cuánto tiempo el SQLite lock fallback considera "vivo" un run.
# Si pasa más de esto desde el `started_at` y el run no terminó, asumimos
# que crasheó y le permitimos a un nuevo tick tomar el lock.
STALE_LEASE_SECONDS = 5 * 60  # 5 minutos


# =============================================================================
# Helpers
# =============================================================================

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now_utc().isoformat()


def _resolve_tz(tz_name: Optional[str]):
    if not tz_name or ZoneInfo is None:
        return timezone.utc
    try:
        return ZoneInfo(tz_name)
    except Exception:
        logger.warning("Unknown timezone %s, defaulting to UTC", tz_name)
        return timezone.utc


def _household_tz(db, household_id: Optional[str]) -> str:
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


def _is_postgres(db) -> bool:
    """Detecta si el wrapper es PostgresConnectionWrapper."""
    from .db import PostgresConnectionWrapper
    return isinstance(db, PostgresConnectionWrapper)


# =============================================================================
# Advisory lock (Postgres) / sentinel lock (SQLite)
# =============================================================================

def _acquire_pg_advisory_lock(db) -> bool:
    """
    Intenta tomar el advisory lock en Postgres. Devuelve True si lo obtuvo,
    False si otro proceso ya lo tiene.

    pg_try_advisory_lock NO bloquea — devuelve inmediatamente. El lock se
    libera automáticamente al cerrar la conexión, lo que protege contra
    procesos crasheados.
    """
    try:
        cur = db.execute("SELECT pg_try_advisory_lock(%s) AS acquired" % SCHEDULER_LOCK_ID)
        row = cur.fetchone()
        return bool(row and row["acquired"])
    except Exception as exc:
        logger.warning("pg_try_advisory_lock failed (%s) — proceeding without lock", exc)
        return True  # fail-open: si el lock no existe, no bloqueamos el scheduler


def _release_pg_advisory_lock(db) -> None:
    try:
        db.execute("SELECT pg_advisory_unlock(%s)" % SCHEDULER_LOCK_ID)
    except Exception:
        pass


def _acquire_sqlite_sentinel_lock(db, host: str) -> Optional[str]:
    """
    Lock fallback para SQLite via fila en `scheduler_runs`.

    Estrategia:
      1. Marcar como expirados los runs cuya lease_until pasó.
      2. Si existe algún run con status='running' Y lease_until vigente,
         devolver None (otro proceso está corriendo).
      3. Crear una fila nueva con lease_until = now + STALE_LEASE_SECONDS.

    Devuelve el ID del scheduler_run si lo obtuvo, None si está locked.
    """
    now = _now_utc()
    now_iso = now.isoformat()
    stale_threshold_iso = (now - timedelta(seconds=STALE_LEASE_SECONDS)).isoformat()

    # Expirar runs viejos sin finished_at
    db.execute(
        "UPDATE scheduler_runs SET status='error', finished_at=?, "
        "error_detail='lease_expired' "
        "WHERE status='running' AND started_at < ?",
        (now_iso, stale_threshold_iso),
    )

    # ¿Hay un run activo con lease vigente?
    active = db.execute(
        "SELECT id FROM scheduler_runs "
        "WHERE status='running' AND (lease_until IS NULL OR lease_until > ?)",
        (now_iso,),
    ).fetchone()
    if active:
        return None  # locked

    # Crear nuestro run
    run_id = str(uuid.uuid4())
    lease_until = (now + timedelta(seconds=STALE_LEASE_SECONDS)).isoformat()
    db.execute(
        "INSERT INTO scheduler_runs ("
        "id, started_at, finished_at, lease_until, host, status, metrics_json"
        ") VALUES (?,?,?,?,?,?,?)",
        (run_id, now_iso, None, lease_until, host, "running", "{}"),
    )
    db.commit()
    return run_id


def _finalize_run(db, run_id: Optional[str], status: str, metrics: dict, error_detail: Optional[str] = None) -> None:
    if not run_id:
        return
    db.execute(
        "UPDATE scheduler_runs SET "
        "finished_at=?, lease_until=NULL, status=?, "
        "functions_scanned=?, reminder_due_emitted=?, "
        "missed_emitted=?, escalations_emitted=?, "
        "duplicates_skipped=?, errors=?, error_detail=?, metrics_json=? "
        "WHERE id=?",
        (
            _now_iso(), status,
            int(metrics.get("scanned", 0)),
            int(metrics.get("reminder_due_emitted", 0)),
            int(metrics.get("missed_emitted", 0)),
            int(metrics.get("escalation_emitted", 0)),
            int(metrics.get("skipped_duplicate", 0)),
            int(metrics.get("errors", 0)),
            error_detail,
            json.dumps(metrics, ensure_ascii=False, default=str),
            run_id,
        ),
    )
    db.commit()


# =============================================================================
# Idempotencia: insert con dedupe compuesto + dedupe_key fallback
# =============================================================================

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
    Inserta un function_event idempotente. Protegido por DOS mecanismos:
      1. UNIQUE INDEX compuesto parcial (unit_function_id, scheduled_for, event_type)
      2. dedupe_key TEXT UNIQUE como fallback

    Devuelve True si insertó, False si era duplicado.
    """
    # Pre-check rápido (el índice compuesto seguirá protegiendo igual)
    existing = db.execute(
        "SELECT 1 FROM function_events "
        "WHERE unit_function_id=? AND scheduled_for=? AND event_type=?",
        (unit_function_id, scheduled_for, event_type),
    ).fetchone()
    if existing:
        return False

    now_iso = _now_iso()
    ev_id = str(uuid.uuid4())
    dedupe = f"{unit_function_id}|{scheduled_for}|{event_type}"
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
        # UNIQUE constraint en composite OR dedupe_key — race con otro proceso
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
    Devuelve los ISO UTC de las invocaciones del schedule que caen entre
    ahora y ahora+horizon_minutes.
    """
    tz = _resolve_tz(tz_name)
    now_utc = _now_utc()
    horizon_end_utc = now_utc + timedelta(minutes=horizon_minutes)

    times = schedule.get("times", [])
    days = schedule.get("days", [1, 2, 3, 4, 5, 6, 7])

    results: list[str] = []
    for offset_days in (0, 1):  # hoy + mañana (cross-day)
        local_today = (now_utc.astimezone(tz)).date() + timedelta(days=offset_days)
        weekday_iso = local_today.isoweekday()
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
# Loop principal
# =============================================================================

def tick(db, *, horizon_minutes: int = 5) -> dict:
    """
    Recorre las UnitFunctions activas y emite los eventos correspondientes.
    Idempotente. Pensado para ser llamado cada minuto desde cron externo.

    SALTA funciones con `ai_needs_confirmation=1 AND confirmed_at IS NULL`
    (decisión 7 de Codex). Esas funciones quedan en cola hasta que un
    humano las confirme.
    """
    metrics = {
        "scanned": 0,
        "reminder_due_emitted": 0,
        "missed_emitted": 0,
        "escalation_emitted": 0,
        "skipped_duplicate": 0,
        "skipped_pending_ai_confirmation": 0,
        "errors": 0,
    }

    rows = db.execute(
        "SELECT * FROM unit_functions WHERE status IN ('open', 'in_progress')"
    ).fetchall()
    now_utc = _now_utc()

    for row in rows:
        metrics["scanned"] += 1
        try:
            # === VG+1.4 gate: funciones IA sin confirmar NO se procesan ===
            if (
                row["created_by_ai"]
                and row["ai_needs_confirmation"]
                and not row["confirmed_at"]
            ):
                metrics["skipped_pending_ai_confirmation"] += 1
                continue

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

            # 1. reminder_due para schedules recurrentes
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

            # 2. missed
            if due_at and recurrence != "daily":
                try:
                    due_dt = datetime.fromisoformat(due_at.replace("Z", "+00:00"))
                    if due_dt.tzinfo is None:
                        due_dt = due_dt.replace(tzinfo=timezone.utc)
                except Exception:
                    due_dt = None

                if due_dt and due_dt < now_utc:
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

            # 3. escalation_due si 2+ missed y hay responsable
            missed_count = db.execute(
                "SELECT COUNT(*) as c FROM function_events "
                "WHERE unit_function_id=? AND event_type='missed'",
                (uf_id,),
            ).fetchone()
            if missed_count and missed_count["c"] >= 2:
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
        except Exception as exc:
            metrics["errors"] += 1
            logger.exception("Error processing function %s: %s", row.get("id") if hasattr(row, "get") else row["id"], exc)

    db.commit()
    return metrics


def tick_with_lock(db) -> dict:
    """
    Wrapper que adquiere el lock (Postgres advisory o SQLite sentinel),
    ejecuta tick(), y persiste métricas en scheduler_runs.

    Devuelve métricas + status del run.
    """
    host = socket.gethostname() or "unknown"
    run_id: Optional[str] = None
    is_pg = _is_postgres(db)

    # 1. Adquirir lock
    if is_pg:
        if not _acquire_pg_advisory_lock(db):
            logger.info("Scheduler skipped: pg_advisory_lock already held")
            # Registrar el skip igual para métricas
            run_id = str(uuid.uuid4())
            db.execute(
                "INSERT INTO scheduler_runs (id, started_at, finished_at, status, host, metrics_json) "
                "VALUES (?,?,?,?,?,?)",
                (run_id, _now_iso(), _now_iso(), "skipped_locked", host, "{}"),
            )
            db.commit()
            return {"status": "skipped_locked", "run_id": run_id}
        # Para PG no usamos la fila sentinel, pero registramos el run
        run_id = str(uuid.uuid4())
        db.execute(
            "INSERT INTO scheduler_runs (id, started_at, host, status, metrics_json) "
            "VALUES (?,?,?,?,?)",
            (run_id, _now_iso(), host, "running", "{}"),
        )
        db.commit()
    else:
        run_id = _acquire_sqlite_sentinel_lock(db, host)
        if run_id is None:
            logger.info("Scheduler skipped: SQLite sentinel lock held")
            return {"status": "skipped_locked"}

    # 2. Tick
    error_detail: Optional[str] = None
    final_status = "done"
    metrics: dict = {}
    try:
        metrics = tick(db)
    except Exception as exc:
        logger.exception("Scheduler tick failed: %s", exc)
        error_detail = str(exc)[:1000]
        final_status = "error"
        metrics["errors"] = (metrics.get("errors", 0) or 0) + 1

    # 3. Finalizar
    try:
        _finalize_run(db, run_id, final_status, metrics, error_detail)
    finally:
        if is_pg:
            _release_pg_advisory_lock(db)

    logger.info("vantguide_scheduler tick %s: %s", final_status, metrics)
    return {"status": final_status, "run_id": run_id, **metrics}


# =============================================================================
# CLI
# =============================================================================

def main():
    """Entry point para `python -m app.vantguide_scheduler`."""
    from .db import connect

    logging.basicConfig(
        level=os.getenv("VANTGUIDE_SCHEDULER_LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    db = connect()
    try:
        result = tick_with_lock(db)
        print(json.dumps(result, indent=2, default=str))
        return 0 if result.get("status") == "done" else 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
