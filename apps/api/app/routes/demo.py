"""
Demo seed para VantDomus.

Modos soportados:
- "home" (preferido): familia chilena multi-generacional con escolar + medicación
  de adulta mayor + finanzas hogar en CLP. Activa industry_preset="family" para
  que el frontend (web y mobile) cambie taxonomía automáticamente.
- "team": demo B2B corporativo (mantiene comportamiento legacy).

El objetivo del modo "home" es que un inversor o cliente abra el dashboard
recién seedeado y vea una historia familiar completa SIN tocar nada más:
- Familia "Pérez Soto" con 4 personas (papá, mamá, hijo escolar, abuela)
- Plan de medicación de la abuela con 2 dosis omitidas → alerta high
- Prueba escolar de Diego con 5 recordatorios escalonados
- Cita médica próxima
- Gastos del hogar en CLP realistas (luz, supermercado, farmacia, útiles)
- Tareas mixtas (rutina, escolar, salud, finanzas)
"""

import json
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..deps import get_current_user, get_db, require_household_role, require_operational_feature_enabled
from ..tenancy import get_household_organization_id

router = APIRouter(prefix="/demo", tags=["Demo"])


def now():
    return datetime.now(timezone.utc).isoformat()


def _iso(dt: datetime) -> str:
    return dt.replace(tzinfo=timezone.utc).isoformat() if dt.tzinfo is None else dt.isoformat()


# ---------------------------------------------------------------------------
# Family seed (mode="home")
# ---------------------------------------------------------------------------
def _seed_family(db, household_id: str, organization_id: str | None) -> dict:
    """Construye la escena familiar completa. Idempotente: usa INSERT OR IGNORE."""
    ts = now()
    now_dt = datetime.now(timezone.utc)

    # --- 1. Meta del household: activa preset family + budget + tz CLP ---
    row = db.execute("SELECT meta FROM households WHERE id=?", (household_id,)).fetchone()
    meta = {}
    if row and row["meta"]:
        try:
            meta = json.loads(row["meta"])
        except Exception:
            meta = {}
    meta["mode"] = "home"
    # CRITICO: industry_preset activa todo el modo familia en frontend.
    # El audit detectó que solo setear mode=home no era suficiente.
    meta["industry_preset"] = "family"
    meta.setdefault("monthly_budget", 850000)
    meta.setdefault("currency_default", "CLP")
    meta.setdefault("family_name", "Familia Pérez Soto")
    meta.setdefault("tz", "America/Santiago")
    db.execute("UPDATE households SET meta=? WHERE id=?", (json.dumps(meta, ensure_ascii=False), household_id))

    # --- 2. Personas (4 integrantes, multi-generacional) ---
    persons = [
        # (id, display_name, relation)
        (str(uuid.uuid4()), "Pedro Pérez", "Padre"),
        (str(uuid.uuid4()), "Camila Soto", "Madre"),
        (str(uuid.uuid4()), "Diego Pérez", "Hijo"),
        (str(uuid.uuid4()), "Elena Soto", "Abuela"),
    ]
    pid_padre, pid_madre, pid_hijo, pid_abuela = [p[0] for p in persons]
    for pid, name, relation in persons:
        db.execute(
            "INSERT OR IGNORE INTO persons "
            "(id, household_id, organization_id, display_name, relation, created_at) "
            "VALUES (?,?,?,?,?,?)",
            (pid, household_id, organization_id, name, relation, ts),
        )

    # --- 3. Medicación: abuela Elena toma Losartán mañana y noche ---
    losartan_times = ["08:00", "20:00"]
    db.execute(
        """
        INSERT INTO adherence_plans (household_id, person_id, med_name, reminder_times, verification_mode, updated_at)
        VALUES (?,?,?,?,?,?)
        ON CONFLICT(household_id, person_id, med_name) DO UPDATE SET
          reminder_times=excluded.reminder_times,
          verification_mode=excluded.verification_mode,
          updated_at=excluded.updated_at
        """,
        (household_id, pid_abuela, "Losartán 50mg", json.dumps(losartan_times), "tap", ts),
    )
    aspirina_times = ["09:00"]
    db.execute(
        """
        INSERT INTO adherence_plans (household_id, person_id, med_name, reminder_times, verification_mode, updated_at)
        VALUES (?,?,?,?,?,?)
        ON CONFLICT(household_id, person_id, med_name) DO UPDATE SET
          reminder_times=excluded.reminder_times,
          verification_mode=excluded.verification_mode,
          updated_at=excluded.updated_at
        """,
        (household_id, pid_abuela, "Aspirina 100mg", json.dumps(aspirina_times), "tap", ts),
    )

    # Event: plan de adherencia configurado (para timeline)
    ev_plan = str(uuid.uuid4())
    plan_payload = json.dumps(
        {"medication": {"name": "Losartán 50mg"}, "adherence_plan": {"reminder_times": losartan_times, "verification_mode": "tap"}},
        ensure_ascii=False,
    )
    db.execute(
        "INSERT INTO events (id, household_id, organization_id, domain, event_type, occurred_at, summary, payload, created_at) "
        "VALUES (?,?,?,?,?,?,?,?,?)",
        (ev_plan, household_id, organization_id, "health", "adherence_plan_set", ts,
         "Plan de adherencia configurado: Losartán 50mg", plan_payload, ts),
    )
    db.execute("INSERT OR IGNORE INTO event_actors (event_id, person_id, role) VALUES (?,?,?)",
               (ev_plan, pid_abuela, "patient"))

    # 2 fallos consecutivos → genera la alerta "Riesgo de no adherencia"
    for minutes_ago in (60, 10):
        ev = str(uuid.uuid4())
        event_time = _iso(now_dt - timedelta(minutes=minutes_ago))
        payload = json.dumps(
            {"medication": {"name": "Losartán 50mg"}, "checkin": {"status": "missed", "timestamp": event_time}},
            ensure_ascii=False,
        )
        db.execute(
            "INSERT INTO events (id, household_id, organization_id, domain, event_type, occurred_at, summary, payload, created_at) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (ev, household_id, organization_id, "health", "medication_checkin", event_time,
             "Check-in Losartán: olvidada", payload, event_time),
        )
        db.execute("INSERT OR IGNORE INTO event_actors (event_id, person_id, role) VALUES (?,?,?)",
                   (ev, pid_abuela, "patient"))

    db.execute(
        """
        INSERT OR REPLACE INTO medication_state
        (household_id, person_id, med_name, consecutive_missed, last_status, last_checkin_at)
        VALUES (?,?,?,?,?,?)
        """,
        (household_id, pid_abuela, "Losartán 50mg", 2, "missed", ts),
    )

    db.execute(
        "INSERT INTO alerts (id, household_id, organization_id, severity, event_id, title, message, status, dedupe_key, created_at) "
        "VALUES (?,?,?,?,?,?,?,?,?,?)",
        (
            str(uuid.uuid4()), household_id, organization_id, "high", None,
            "Elena olvidó su Losartán 2 veces seguidas",
            "Se detectaron 2 dosis consecutivas omitidas. Conviene avisarle o pasar a verla.",
            "open", None, ts,
        ),
    )

    # --- 4. Eventos escolares de Diego: prueba de matemáticas próximo viernes ---
    prueba_date = now_dt + timedelta(days=7)
    school_event_id = str(uuid.uuid4())
    school_payload = json.dumps(
        {
            "student": "Diego Pérez",
            "subject": "Matemáticas",
            "evaluation_title": "Prueba unidad 3 — Fracciones",
            "due_date": prueba_date.date().isoformat(),
            "source": "circular escolar",
        },
        ensure_ascii=False,
    )
    db.execute(
        "INSERT INTO events (id, household_id, organization_id, domain, event_type, occurred_at, summary, payload, created_at) "
        "VALUES (?,?,?,?,?,?,?,?,?)",
        (school_event_id, household_id, organization_id, "school", "school_evaluation_scheduled",
         ts, "Prueba de Matemáticas para Diego (Fracciones)", school_payload, ts),
    )
    db.execute("INSERT OR IGNORE INTO event_actors (event_id, person_id, role) VALUES (?,?,?)",
               (school_event_id, pid_hijo, "student"))

    # --- 5. Cita médica de Elena: cardiología próximo martes 10:30 ---
    cita_date = (now_dt + timedelta(days=2)).replace(hour=13, minute=30)  # 10:30 Chile = 13:30 UTC
    med_event_id = str(uuid.uuid4())
    med_payload = json.dumps(
        {
            "appointment": {
                "doctor": "Dra. María González",
                "specialty": "Cardiología",
                "location": "Clínica Las Condes",
                "datetime": cita_date.isoformat(),
            },
        },
        ensure_ascii=False,
    )
    db.execute(
        "INSERT INTO events (id, household_id, organization_id, domain, event_type, occurred_at, summary, payload, created_at) "
        "VALUES (?,?,?,?,?,?,?,?,?)",
        (med_event_id, household_id, organization_id, "health", "medical_appointment_scheduled",
         _iso(cita_date), "Cita Elena con Dra. González — Cardiología", med_payload, ts),
    )
    db.execute("INSERT OR IGNORE INTO event_actors (event_id, person_id, role) VALUES (?,?,?)",
               (med_event_id, pid_abuela, "patient"))

    # --- 6. Tareas: mix de escolar (Diego) + hogar + salud + finanzas ---
    # 6.a Tareas escolares de Diego (5 recordatorios escalonados generados por SchoolPlanner)
    school_tasks = [
        # offset_days, title, status, priority, tag
        (-10, "Diego: Diagnóstico inicial — Fracciones", "done", "low", "school"),
        (-3, "Diego: Resumen del tema con apuntes", "open", "medium", "school"),
        (3, "Diego: Práctica con ejercicios", "open", "medium", "school"),
        (6, "Diego: Repaso final víspera prueba", "open", "high", "school"),
        (7, "Diego: PRUEBA Matemáticas — Fracciones", "open", "high", "school"),
    ]
    for offset, title, status, priority, tag in school_tasks:
        due_at = _iso(now_dt + timedelta(days=offset))
        db.execute(
            "INSERT OR IGNORE INTO task_items "
            "(id, household_id, organization_id, title, status, due_at, assigned_person_id, priority, tags, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), household_id, organization_id, title, status, due_at, pid_hijo,
             priority, json.dumps([tag]), ts, ts),
        )

    # 6.b Tareas del hogar / salud / finanzas
    home_tasks = [
        # offset_days, title, status, priority, assigned_to, tag
        (1, "Pagar cuenta de luz (vence mañana)", "open", "high", pid_madre, "finance"),
        (2, "Llevar a Elena a Cardiología 10:30", "open", "high", pid_padre, "health"),
        (3, "Renovar receta de Losartán en farmacia", "open", "medium", pid_madre, "health"),
        (4, "Reunión de apoderados — jueves 19hs", "open", "medium", pid_madre, "school"),
        (-1, "Comprar útiles que pidió la profesora", "done", "low", pid_madre, "school"),
        (5, "Revisar mochila Diego (rutina semanal)", "open", "low", pid_madre, "routine"),
    ]
    for offset, title, status, priority, assigned, tag in home_tasks:
        due_at = _iso(now_dt + timedelta(days=offset))
        db.execute(
            "INSERT OR IGNORE INTO task_items "
            "(id, household_id, organization_id, title, status, due_at, assigned_person_id, priority, tags, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), household_id, organization_id, title, status, due_at, assigned,
             priority, json.dumps([tag]), ts, ts),
        )

    # --- 7. Gastos en CLP realistas (familia chilena) ---
    expenses = [
        # days_ago, amount_CLP, category, merchant, notes, person
        (1, 145000, "groceries", "Líder Supermercado", "Compra semanal hogar", pid_madre),
        (2, 12500, "health", "Farmacia Cruz Verde", "Losartán Elena", pid_madre),
        (3, 85000, "utilities", "Enel Distribución", "Cuenta luz mes", pid_padre),
        (4, 35000, "health", "Clínica Las Condes", "Consulta cardiología Elena", pid_padre),
        (5, 25000, "school", "Librería Antártica", "Útiles Diego — 2do trimestre", pid_madre),
        (6, 7500, "groceries", "Pan del día", "Almuerzo Camila", pid_madre),
        (8, 22000, "utilities", "Aguas Andinas", "Cuenta agua bimestral", pid_padre),
        (10, 18500, "education", "Colegio Diego", "Cuota actividades extra", pid_madre),
    ]
    for days_ago, amount, category, merchant, notes, person in expenses:
        expense_at = _iso(now_dt - timedelta(days=days_ago))
        db.execute(
            "INSERT OR IGNORE INTO expenses "
            "(id, household_id, organization_id, amount, currency, category, merchant, expense_at, notes, person_id, created_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), household_id, organization_id, float(amount), "CLP",
             category, merchant, expense_at, notes, person, ts),
        )

    return {
        "ok": True,
        "mode": "home",
        "industry_preset": "family",
        "family_name": meta["family_name"],
        "persons": [
            {"id": pid, "name": name, "relation": relation}
            for (pid, name, relation) in persons
        ],
        "summary": {
            "medication_plans": 2,
            "missed_doses_alert": 1,
            "school_tasks": 5,
            "home_tasks": 6,
            "medical_appointments": 1,
            "expenses_30d": len(expenses),
            "currency": "CLP",
        },
    }


# ---------------------------------------------------------------------------
# Team seed (mode="team") — comportamiento legacy preservado
# ---------------------------------------------------------------------------
def _seed_team(db, household_id: str, organization_id: str | None) -> dict:
    """Comportamiento previo: dos operadores B2B + adherence genérico."""
    ts = now()
    pid1 = str(uuid.uuid4())
    pid2 = str(uuid.uuid4())

    row = db.execute("SELECT meta FROM households WHERE id=?", (household_id,)).fetchone()
    meta = {}
    if row and row["meta"]:
        try:
            meta = json.loads(row["meta"])
        except Exception:
            meta = {}
    meta["mode"] = "team"
    meta.setdefault("monthly_budget", 1200)
    db.execute("UPDATE households SET meta=? WHERE id=?", (json.dumps(meta, ensure_ascii=False), household_id))

    db.execute(
        "INSERT OR IGNORE INTO persons (id, household_id, organization_id, display_name, relation, created_at) VALUES (?,?,?,?,?,?)",
        (pid1, household_id, organization_id, "Pedro Pérez", "Operaciones", ts),
    )
    db.execute(
        "INSERT OR IGNORE INTO persons (id, household_id, organization_id, display_name, relation, created_at) VALUES (?,?,?,?,?,?)",
        (pid2, household_id, organization_id, "Camila Soto", "Finanzas", ts),
    )

    times = ["08:00", "20:00"]
    db.execute(
        """
        INSERT INTO adherence_plans (household_id, person_id, med_name, reminder_times, verification_mode, updated_at)
        VALUES (?,?,?,?,?,?)
        ON CONFLICT(household_id, person_id, med_name) DO UPDATE SET
          reminder_times=excluded.reminder_times,
          verification_mode=excluded.verification_mode,
          updated_at=excluded.updated_at
        """,
        (household_id, pid1, "Losartan", json.dumps(times), "tap", ts),
    )

    return {"ok": True, "mode": "team", "persons": [
        {"id": pid1, "name": "Pedro Pérez"},
        {"id": pid2, "name": "Camila Soto"},
    ]}


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------
@router.post("/seed")
def seed(household_id: str, mode: str = "home", user=Depends(get_current_user), db=Depends(get_db)):
    require_operational_feature_enabled("Demo seed", "VANTDOMUS_ALLOW_DEMO_SEED")
    if mode not in ("home", "team"):
        raise HTTPException(status_code=400, detail="mode must be home|team")
    require_household_role(db, user["user_id"], household_id, "owner")
    organization_id = get_household_organization_id(db, household_id)

    if mode == "home":
        result = _seed_family(db, household_id, organization_id)
    else:
        result = _seed_team(db, household_id, organization_id)

    db.commit()
    return result
