import json, uuid
from datetime import datetime, timezone
from .features import compute_features_sqlite
from .rules import clamp

def utcnow_iso():
    return datetime.now(timezone.utc).isoformat()

def _ensure_household_meta_defaults(db, household_id: str):
    row = db.execute("SELECT meta FROM households WHERE id=?", (household_id,)).fetchone()
    meta = {}
    if row and row["meta"]:
        try:
            meta = json.loads(row["meta"])
        except Exception:
            meta = {}
    changed = False
    if "mode" not in meta:
        meta["mode"] = "home"; changed = True
    if "monthly_budget" not in meta:
        meta["monthly_budget"] = 0; changed = True
    if changed:
        db.execute("UPDATE households SET meta=? WHERE id=?", (json.dumps(meta), household_id))
        db.commit()
    return meta

def _insert_reco(db, household_id: str, kind: str, title: str, rationale: str, impact: int, payload: dict):
    rid = str(uuid.uuid4())
    db.execute("""
      INSERT INTO assistant_recommendations (id, household_id, created_at, status, kind, title, rationale, impact, payload)
      VALUES (?,?,?,?,?,?,?,?,?)
    """, (rid, household_id, utcnow_iso(), "open", kind, title, rationale, int(clamp(impact,0,100)), json.dumps(payload)))
    db.commit()
    return rid

def _dismiss_existing_same_kind(db, household_id: str, kind: str):
    db.execute("UPDATE assistant_recommendations SET status='dismissed' WHERE household_id=? AND status='open' AND kind=?",
               (household_id, kind))
    db.commit()

def _open_recos(db, household_id: str):
    rows = db.execute("""
      SELECT id, kind, title, rationale, impact, payload, created_at
      FROM assistant_recommendations
      WHERE household_id=? AND status='open'
      ORDER BY created_at DESC
      LIMIT 50
    """, (household_id,)).fetchall()
    items = []
    for r in rows:
        items.append({
            "id": r["id"], "kind": r["kind"], "title": r["title"], "rationale": r["rationale"],
            "impact": int(r["impact"]), "payload": json.loads(r["payload"] or "{}"),
            "created_at": r["created_at"],
        })
    return items

def generate_recommendations(db, household_id: str, force_refresh: bool = False):
    meta = _ensure_household_meta_defaults(db, household_id)
    f = compute_features_sqlite(db, household_id)

    if force_refresh:
        for k in ("health","tasks","finance","stability"):
            _dismiss_existing_same_kind(db, household_id, k)

    if f["missed_7d"] >= 2:
        _insert_reco(
            db, household_id, "health",
            "Reforzar adherencia de medicación",
            f"Se detectaron {f['missed_7d']} missed en los últimos 7 días. Ajusta rutina y recordatorios.",
            80,
            {"actions":[
                {"type":"create_task","title":"Revisar adherencia y ajustar rutina","priority":"high","tags":["health","adherence"]},
                {"type":"create_task","title":"Preparar pastillero / recordatorio visible","priority":"medium","tags":["health"]},
            ]}
        )

    if f["tasks_overdue"] >= 2:
        _insert_reco(
            db, household_id, "tasks",
            "Recuperación de tareas vencidas",
            f"Hay {f['tasks_overdue']} tareas vencidas. Prioriza y delega.",
            70,
            {"actions":[
                {"type":"create_task","title":"Recovery sprint: 3 tareas críticas hoy","priority":"high","tags":["recovery","tasks"]},
                {"type":"create_task","title":"Reasignar responsabilidades (10 min)","priority":"medium","tags":["planning","tasks"]},
            ]}
        )

    budget = float(f.get("monthly_budget") or meta.get("monthly_budget") or 0)
    if budget > 0 and float(f["spend_30d_total"]) >= 0.9 * budget:
        _insert_reco(
            db, household_id, "finance",
            "Control de presupuesto (riesgo)",
            f"Gasto 30d {f['spend_30d_total']:.2f} cerca/sobre presupuesto {budget:.2f}.",
            75,
            {"actions":[
                {"type":"create_task","title":"Revisión de gastos por categoría (15 min)","priority":"high","tags":["finance","budget"]},
                {"type":"create_task","title":"Definir tope semanal por categoría","priority":"medium","tags":["finance"]},
            ]}
        )

    if f["hsi"] < 60:
        _insert_reco(
            db, household_id, "stability",
            "Activar Recovery Mode (HSI bajo)",
            f"HSI={f['hsi']} indica riesgo. Ejecuta plan 48h.",
            85,
            {"actions":[
                {"type":"create_task","title":"Recovery Mode 48h: plan + seguimiento","priority":"high","tags":["stability","recovery"]},
            ]}
        )

    return _open_recos(db, household_id), f

def apply_recommendation(db, household_id: str, reco_id: str):
    row = db.execute("SELECT status, payload FROM assistant_recommendations WHERE id=? AND household_id=?",
                     (reco_id, household_id)).fetchone()
    if not row:
        raise ValueError("Recommendation not found")
    if row["status"] != "open":
        return {"ok": True, "already": True}

    payload = json.loads(row["payload"] or "{}")
    actions = payload.get("actions") or []
    created_task_ids = []

    now = utcnow_iso()
    for a in actions:
        if a.get("type") == "create_task":
            tid = str(uuid.uuid4())
            title = a.get("title") or "Task"
            priority = a.get("priority") or "medium"
            tags = json.dumps(a.get("tags") or [])
            db.execute("""
              INSERT INTO task_items (id, household_id, title, status, due_at, assigned_person_id, priority, tags, created_at, updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?)
            """, (tid, household_id, title, "open", None, None, priority, tags, now, now))
            created_task_ids.append(tid)

    db.execute("UPDATE assistant_recommendations SET status='applied' WHERE id=? AND household_id=?",
               (reco_id, household_id))
    db.commit()
    return {"ok": True, "created_task_ids": created_task_ids}
