import json
from datetime import datetime, timezone, timedelta, date
import uuid
from .rules import compute_health_score, compute_tasks_score, compute_finance_score, compute_hsi

def utcnow_iso():
    return datetime.now(timezone.utc).isoformat()

def compute_features_sqlite(db, household_id: str) -> dict:
    row = db.execute("SELECT meta FROM households WHERE id=?", (household_id,)).fetchone()
    meta = {}
    if row and row["meta"]:
        try:
            meta = json.loads(row["meta"])
        except Exception:
            meta = {}
    mode = (meta.get("mode") or "home")
    try:
        monthly_budget = float(meta.get("monthly_budget") or 0)
    except Exception:
        monthly_budget = 0.0

    alerts_open = int(db.execute("SELECT COUNT(*) AS c FROM alerts WHERE household_id=? AND status='open'", (household_id,)).fetchone()["c"])

    since_7d = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    missed_7d = int(db.execute("""
      SELECT COUNT(*) AS c
      FROM events
      WHERE household_id=? AND domain='health' AND event_type='medication_checkin'
        AND occurred_at >= ?
        AND json_extract(payload, '$.checkin.status')='missed'
    """, (household_id, since_7d)).fetchone()["c"])

    tasks_done_7d = int(db.execute("""
      SELECT COUNT(*) AS c FROM task_items
      WHERE household_id=? AND status='done' AND updated_at >= ?
    """, (household_id, since_7d)).fetchone()["c"])

    now_iso = utcnow_iso()
    tasks_overdue = int(db.execute("""
      SELECT COUNT(*) AS c FROM task_items
      WHERE household_id=? AND status!='done' AND due_at IS NOT NULL AND due_at < ?
    """, (household_id, now_iso)).fetchone()["c"])

    since_30d = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    spend_30d_total = float(db.execute("""
      SELECT COALESCE(SUM(amount),0) AS s FROM expenses
      WHERE household_id=? AND expense_at IS NOT NULL AND expense_at >= ?
    """, (household_id, since_30d)).fetchone()["s"])

    spend_30d_pharmacy = float(db.execute("""
      SELECT COALESCE(SUM(amount),0) AS s FROM expenses
      WHERE household_id=? AND expense_at IS NOT NULL AND expense_at >= ? AND category='pharmacy'
    """, (household_id, since_30d)).fetchone()["s"])

    health_score = compute_health_score(missed_7d)
    task_score = compute_tasks_score(tasks_overdue, tasks_done_7d)
    finance_score = compute_finance_score(spend_30d_total, monthly_budget)
    hsi = compute_hsi(health_score, task_score, finance_score, mode)

    return {
        "mode": mode,
        "monthly_budget": monthly_budget,
        "alerts_open": alerts_open,
        "missed_7d": missed_7d,
        "tasks_done_7d": tasks_done_7d,
        "tasks_overdue": tasks_overdue,
        "spend_30d_total": spend_30d_total,
        "spend_30d_pharmacy": spend_30d_pharmacy,
        "health_score": health_score,
        "task_score": task_score,
        "finance_score": finance_score,
        "hsi": hsi,
    }

def compute_and_store(db, household_id: str) -> dict:
    f = compute_features_sqlite(db, household_id)
    feature_date = date.today().isoformat()
    now = utcnow_iso()

    db.execute("""
      INSERT INTO features_daily (
        household_id, feature_date, mode,
        health_score, task_score, finance_score, hsi,
        missed_7d, tasks_done_7d, tasks_overdue,
        spend_30d_total, spend_30d_pharmacy, alerts_open, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(household_id, feature_date) DO UPDATE SET
        mode=excluded.mode,
        health_score=excluded.health_score,
        task_score=excluded.task_score,
        finance_score=excluded.finance_score,
        hsi=excluded.hsi,
        missed_7d=excluded.missed_7d,
        tasks_done_7d=excluded.tasks_done_7d,
        tasks_overdue=excluded.tasks_overdue,
        spend_30d_total=excluded.spend_30d_total,
        spend_30d_pharmacy=excluded.spend_30d_pharmacy,
        alerts_open=excluded.alerts_open,
        updated_at=excluded.updated_at
    """, (
        household_id, feature_date, f["mode"],
        int(f["health_score"]), int(f["task_score"]), int(f["finance_score"]), int(f["hsi"]),
        int(f["missed_7d"]), int(f["tasks_done_7d"]), int(f["tasks_overdue"]),
        float(f["spend_30d_total"]), float(f["spend_30d_pharmacy"]),
        int(f["alerts_open"]), now
    ))

    db.execute("INSERT INTO state_snapshot (id, household_id, computed_at, state_json) VALUES (?,?,?,?)",
               (uuid.uuid4().hex, household_id, now, json.dumps(f)))
    db.commit()
    return f
