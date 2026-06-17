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
import re
import unicodedata
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..deps import get_current_user, get_db, require_household_role, require_operational_feature_enabled
from ..security import hash_password
from ..tenancy import get_household_organization_id

# Password compartida para las cuentas de integrantes del demo (todas iguales,
# es solo para mostrar la visibilidad por persona en el pitch).
DEMO_MEMBER_PASSWORD = "Demo-Pass-2026!"

# VantGuide: el seed familiar pobla el modelo nuevo (unit_functions, evidence,
# memory, person_support_profile). Las tablas legacy (task_items, alerts) se
# siguen llenando para retrocompat con UI vieja.
from .unit_functions import create_unit_function_internal
from .vantguide_library import (
    log_evidence_internal,
    upsert_memory_internal,
    upsert_profile_internal,
)

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
    # Idempotente DE VERDAD: reusar por (household_id, display_name). Antes se
    # generaba un uuid nuevo por corrida → INSERT OR IGNORE igual insertaba y
    # re-correr "Cargar datos de ejemplo" duplicaba los integrantes.
    person_defs = [
        ("Pedro Pérez", "Padre"),
        ("Camila Soto", "Madre"),
        ("Diego Pérez", "Hijo"),
        ("Elena Soto", "Abuela"),
    ]
    person_ids = []
    for name, relation in person_defs:
        existing = db.execute(
            "SELECT id FROM persons WHERE household_id=? AND display_name=?",
            (household_id, name),
        ).fetchone()
        if existing:
            pid = existing["id"]
        else:
            pid = str(uuid.uuid4())
            db.execute(
                "INSERT INTO persons "
                "(id, household_id, organization_id, display_name, relation, created_at) "
                "VALUES (?,?,?,?,?,?)",
                (pid, household_id, organization_id, name, relation, ts),
            )
        person_ids.append(pid)
    pid_padre, pid_madre, pid_hijo, pid_abuela = person_ids

    # Idempotencia TOTAL: si el hogar ya tiene funciones sembradas, no recrear
    # la escena (re-clic en "Cargar datos de ejemplo" no debe duplicar nada).
    # Las personas y el preset family ya quedaron asegurados arriba.
    already = db.execute(
        "SELECT COUNT(*) AS n FROM unit_functions WHERE household_id=?",
        (household_id,),
    ).fetchone()
    if already and already["n"] > 0:
        return {
            "ok": True,
            "mode": "home",
            "industry_preset": "family",
            "family_name": meta["family_name"],
            "already_seeded": True,
            "persons": [
                {"id": pid, "name": name, "relation": relation}
                for pid, (name, relation) in zip(person_ids, person_defs)
            ],
        }

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

    # =========================================================================
    # 8. ENRIQUECIMIENTO VantGuide
    #
    # Crea las entidades del nuevo modelo en paralelo a las legacy. Esto le
    # permite al inversor/cliente que abre el demo ver:
    #   - Funciones reales (unit_functions) para estudio/medicación/hogar
    #   - Perfiles de apoyo con preferencias (no diagnósticos clínicos)
    #   - Evidencia positiva y NEGATIVA en la biblioteca
    #   - Memoria estructurada con aprendizajes acumulados
    # =========================================================================

    user_id_for_demo = "demo-seed"  # marca de origen, no es un user real

    # 8.a Perfiles de apoyo por integrante
    upsert_profile_internal(
        db, pid_padre, household_id, organization_id,
        age_group="adult", role_in_unit="padre",
        communication_style="direct", supervision_level="autonomous",
        motivation_style="quiet_completion",
    )
    upsert_profile_internal(
        db, pid_madre, household_id, organization_id,
        age_group="adult", role_in_unit="madre",
        communication_style="warm", supervision_level="autonomous",
        motivation_style="progress_bar",
        reward_preferences=[{"kind": "shared_goal"}],
    )
    upsert_profile_internal(
        db, pid_hijo, household_id, organization_id,
        age_group="child", role_in_unit="hijo",
        communication_style="playful", supervision_level="light_reminder",
        motivation_style="rewards",
        reward_preferences=[{"kind": "screen_time"}, {"kind": "symbolic"}],
        calm_tools=["soft_music", "pomodoro"],
        study_style="short_bursts",
        attention_profile="benefits_from_structure",
    )
    upsert_profile_internal(
        db, pid_abuela, household_id, organization_id,
        age_group="senior", role_in_unit="abuela",
        communication_style="step_by_step", supervision_level="guided",
        motivation_style="praise",
        memory_support_level="light",
        anxiety_support="gentle",
        loneliness_risk="medium",
        health_notes="Hipertensión controlada con Losartán. Cita cardiológica cada 6 meses.",
    )

    # 8.b UnitFunctions del modelo nuevo, una por cada tarea legacy
    # Estudio Diego (5 funciones escalonadas, source=school_notice)
    school_titles = [
        (-10, "Diego: Diagnóstico inicial — Fracciones", "done"),
        (-3, "Diego: Resumen del tema con apuntes", "open"),
        (3, "Diego: Práctica con ejercicios", "open"),
        (6, "Diego: Repaso final víspera prueba", "open"),
        (7, "Diego: PRUEBA Matemáticas — Fracciones", "open"),
    ]
    school_function_ids: list[str] = []
    for offset, title, status in school_titles:
        try:
            uf_id = create_unit_function_internal(
                db,
                household_id=household_id,
                organization_id=organization_id,
                person_id=pid_hijo,
                category="study",
                title=title,
                source_type="school_notice",
                created_by_user_id=user_id_for_demo,
                due_at=_iso(now_dt + timedelta(days=offset)),
                priority="high" if "PRUEBA" in title or "Repaso" in title else "medium",
                # FIX: supervision_level del UnitFunction acepta solo
                #   autonomous|reminder_only|supervised|co_executed
                # No confundir con person_support_profile.supervision_level
                # que acepta autonomous|light_reminder|guided|accompanied.
                supervision_level="reminder_only",
                support_mode="tap",
                metadata={"subject": "Matemáticas", "topic": "Fracciones"},
                dual_write_task=False,  # ya creamos task_items arriba
            )
            school_function_ids.append(uf_id)
            # Si está "done", marcar completed
            if status == "done":
                from .unit_functions import _insert_function_event
                _insert_function_event(
                    db,
                    unit_function_id=uf_id,
                    household_id=household_id,
                    organization_id=organization_id,
                    event_type="completed",
                    triggered_by="user",
                    triggered_by_user_id=user_id_for_demo,
                )
                db.execute(
                    "UPDATE unit_functions SET status='done', updated_at=? WHERE id=?",
                    (ts, uf_id),
                )
        except Exception:
            pass  # idempotente: el seed se puede correr 2 veces sin romper

    # Medicación Elena (2 funciones recurrentes diarias)
    for med_name, schedule_times in [
        ("Losartán 50mg", ["08:00", "20:00"]),
        ("Aspirina 100mg", ["09:00"]),
    ]:
        try:
            create_unit_function_internal(
                db,
                household_id=household_id,
                organization_id=organization_id,
                person_id=pid_abuela,
                responsible_person_id=pid_madre,
                category="medication",
                title=f"Tomar {med_name}",
                source_type="prescription",
                created_by_user_id=user_id_for_demo,
                schedule={"times": schedule_times, "days": [1, 2, 3, 4, 5, 6, 7], "tz": "America/Santiago"},
                recurrence="daily",
                priority="high",
                supervision_level="supervised",
                support_mode="tap",
                evidence_required=True,
                metadata={"med_name": med_name, "dosage": med_name.split()[-1] if " " in med_name else None},
                dual_write_task=False,
            )
        except Exception:
            pass

    # Función appointment para Elena (cardio)
    try:
        appt_uf = create_unit_function_internal(
            db,
            household_id=household_id,
            organization_id=organization_id,
            person_id=pid_abuela,
            responsible_person_id=pid_padre,
            category="appointment",
            title="Cita Cardiología con Dra. González",
            source_type="doctor_instruction",
            created_by_user_id=user_id_for_demo,
            due_at=_iso(cita_date),
            priority="high",
            # FIX: ver comentario arriba — supervision_level del UnitFunction
            # no acepta "accompanied", solo {autonomous|reminder_only|supervised|co_executed}.
            supervision_level="supervised",
            metadata={"specialty": "Cardiología", "doctor": "Dra. María González", "location": "Clínica Las Condes"},
            dual_write_task=False,
        )
    except Exception:
        appt_uf = None

    # === Pre-VG+2.4: Función IA pendiente confirmación ===
    # Para mostrar el flujo "la IA propuso esto, falta tu confirmación".
    # Categoría medication (sensible) → ai_needs_confirmation auto=true.
    ai_pending_uf = None
    try:
        ai_pending_uf = create_unit_function_internal(
            db,
            household_id=household_id,
            organization_id=organization_id,
            person_id=pid_abuela,
            responsible_person_id=pid_madre,
            category="medication",
            title="Atorvastatina 20mg — detectada en receta (pendiente confirmar)",
            source_type="prescription",
            created_by_user_id="assistant",
            created_by_ai=True,
            ai_confidence=0.87,
            ai_extraction_source="ocr_receta_septiembre_2026",
            ai_explanation=(
                "La IA leyó la receta más reciente de Elena y detectó una "
                "estatina adicional. Antes de activar recordatorios, "
                "necesitamos que un familiar confirme la dosis."
            ),
            schedule={"times": ["21:00"], "days": [1, 2, 3, 4, 5, 6, 7], "tz": "America/Santiago"},
            recurrence="daily",
            priority="medium",
            supervision_level="supervised",
            support_mode="tap",
            evidence_required=True,
            metadata={"med_name": "Atorvastatina 20mg", "dosage_per_day": 1},
            dual_write_task=False,
        )
    except Exception:
        ai_pending_uf = None

    # === Pre-VG+2.4: 2 entradas en unit_function_versions para narrativa ===
    # Simulamos historia: Losartán empezó como 08:00/13:00/20:00 (3 dosis),
    # se redujo a 08:00/20:00 (2 dosis) por consejo médico, y la adherencia
    # mejoró. Esto da material a la "Biblioteca de Evolución" del UI futuro.
    losartan_uf_row = db.execute(
        "SELECT id, version FROM unit_functions "
        "WHERE household_id=? AND person_id=? AND category='medication' "
        "  AND title LIKE 'Tomar Losart%' LIMIT 1",
        (household_id, pid_abuela),
    ).fetchone()
    if losartan_uf_row:
        losartan_uf_id = losartan_uf_row["id"]
        # Snapshot v1: 3 dosis diarias (estado inicial hipotético)
        try:
            db.execute(
                "INSERT INTO unit_function_versions ("
                "id, unit_function_id, version, snapshot_json, "
                "changed_by_user_id, changed_by_ai, change_reason, change_source, created_at"
                ") VALUES (?,?,?,?,?,?,?,?,?)",
                (
                    str(uuid.uuid4()), losartan_uf_id, 1,
                    json.dumps({
                        "title": "Tomar Losartán 50mg",
                        "schedule": {"times": ["08:00", "13:00", "20:00"], "days": [1, 2, 3, 4, 5, 6, 7]},
                        "recurrence": "daily",
                        "supervision_level": "supervised",
                        "support_mode": "tap",
                        "_demo_note": "Estado inicial: 3 dosis diarias. Adherencia ~60%.",
                    }, ensure_ascii=False),
                    "demo-seed-historical", 0,
                    "ajuste_horario_post_consulta",
                    "manual_patch", _iso(now_dt - timedelta(days=30)),
                ),
            )
            # Snapshot v2: la familia (post-consulta) lo simplifica a 2 dosis
            db.execute(
                "INSERT INTO unit_function_versions ("
                "id, unit_function_id, version, snapshot_json, "
                "changed_by_user_id, changed_by_ai, change_reason, change_source, created_at"
                ") VALUES (?,?,?,?,?,?,?,?,?)",
                (
                    str(uuid.uuid4()), losartan_uf_id, 2,
                    json.dumps({
                        "title": "Tomar Losartán 50mg",
                        "schedule": {"times": ["08:00", "20:00"], "days": [1, 2, 3, 4, 5, 6, 7]},
                        "recurrence": "daily",
                        "supervision_level": "supervised",
                        "support_mode": "tap",
                        "_demo_note": "Tras consulta cardio: pasamos a 2 dosis. Adherencia subió a ~85%.",
                    }, ensure_ascii=False),
                    "demo-seed-historical", 0,
                    "simplificacion_dosis_y_recordatorio_visual",
                    "manual_patch", _iso(now_dt - timedelta(days=14)),
                ),
            )
            # Bump version del row activo a 3 (porque hay 2 snapshots históricos)
            db.execute(
                "UPDATE unit_functions SET version=? WHERE id=?",
                (3, losartan_uf_id),
            )
        except Exception:
            pass

    # 8.c Evidencia: positiva (Diego completó diagnóstico) y NEGATIVA (Elena
    # olvidó pastilla, Diego no se concentró estudiando de noche)
    if school_function_ids:
        # Positiva: Diego terminó el diagnóstico
        try:
            log_evidence_internal(
                db,
                household_id=household_id,
                organization_id=organization_id,
                unit_function_id=school_function_ids[0],
                person_id=pid_hijo,
                evidence_type="study_session_completed",
                text_content="Diego terminó el diagnóstico inicial en 25 minutos. Identificó 2 conceptos que le cuestan.",
                created_by_user_id=user_id_for_demo,
            )
        except Exception:
            pass
        # Negativa: estudiar de noche no funcionó
        try:
            log_evidence_internal(
                db,
                household_id=household_id,
                organization_id=organization_id,
                unit_function_id=school_function_ids[1] if len(school_function_ids) > 1 else school_function_ids[0],
                person_id=pid_hijo,
                evidence_type="negative_outcome",
                text_content="Intentó estudiar a las 22:00 — se durmió, no avanzó. Próxima sesión moverla a la tarde.",
                created_by_user_id=user_id_for_demo,
            )
        except Exception:
            pass

    # Evidencias medication: las 2 missed que ya creamos arriba como events
    # también las exponemos en evidence_items para que la biblioteca las muestre
    try:
        log_evidence_internal(
            db,
            household_id=household_id,
            organization_id=organization_id,
            person_id=pid_abuela,
            evidence_type="medication_missed",
            text_content="Elena olvidó la dosis de las 20:00 (Losartán)",
            created_by_user_id=user_id_for_demo,
        )
        log_evidence_internal(
            db,
            household_id=household_id,
            organization_id=organization_id,
            person_id=pid_abuela,
            evidence_type="medication_missed",
            text_content="Elena olvidó la dosis del día siguiente — patrón post-cena observado",
            created_by_user_id=user_id_for_demo,
        )
    except Exception:
        pass

    # 8.d Memoria: aprendizajes acumulados (positivos y negativos)
    memories = [
        # (memory_type, content, importance, person_id)
        ("study_pattern", "A Diego le funciona estudiar en bloques de 20 minutos con descansos cortos.", 0.8, pid_hijo),
        ("negative_learning", "Diego intentó estudiar tarde — no funciona. Mover sesiones a la tarde.", 0.7, pid_hijo),
        ("calm_strategy", "Diego se concentra mejor con música suave de fondo (lofi).", 0.7, pid_hijo),
        ("routine_pattern", "Elena adhiere mejor a la medicación cuando se asocia al desayuno.", 0.8, pid_abuela),
        ("risk_pattern", "Elena tiende a saltarse la dosis nocturna después de cenar fuera.", 0.7, pid_abuela),
        ("preference", "Camila prefiere recibir resumen semanal los domingos por la tarde.", 0.5, pid_madre),
        ("social_connection", "Elena valora mucho las llamadas dominicales con sus nietos.", 0.6, pid_abuela),
        ("family_story", "Familia Pérez Soto vive en comuna de Las Condes. 4 integrantes activos.", 0.4, None),
    ]
    for m_type, content, importance, pers in memories:
        try:
            upsert_memory_internal(
                db,
                household_id=household_id,
                organization_id=organization_id,
                memory_type=m_type,
                content=content,
                importance=importance,
                person_id=pers,
                created_by_user_id=user_id_for_demo,
            )
        except Exception:
            pass

    # === Pre-VG+2.4: evidencia adicional de mejora ("antes vs después") ===
    if losartan_uf_row:
        try:
            log_evidence_internal(
                db,
                household_id=household_id,
                organization_id=organization_id,
                unit_function_id=losartan_uf_row["id"],
                person_id=pid_abuela,
                evidence_type="improvement_detected",
                text_content=(
                    "Tras simplificar el horario de Losartán de 3 a 2 dosis y "
                    "agregar recordatorio visual, la adherencia subió de ~60% "
                    "a ~85% en 14 días."
                ),
                metadata={
                    "before": {"adherence": 0.60, "dose_count": 3},
                    "after": {"adherence": 0.85, "dose_count": 2},
                    "improvement_pct": 41.7,
                },
                created_by_user_id=user_id_for_demo,
            )
        except Exception:
            pass
        try:
            upsert_memory_internal(
                db,
                household_id=household_id,
                organization_id=organization_id,
                memory_type="improvement",
                content=(
                    "Reducir Losartán de 3 a 2 dosis + recordatorio visual "
                    "mejoró la adherencia de Elena de 60% a 85%."
                ),
                importance=0.85,
                person_id=pid_abuela,
                created_by_user_id=user_id_for_demo,
            )
        except Exception:
            pass

    return {
        "ok": True,
        "mode": "home",
        "industry_preset": "family",
        "family_name": meta["family_name"],
        "persons": [
            {"id": pid, "name": name, "relation": relation}
            for pid, (name, relation) in zip(person_ids, person_defs)
        ],
        "summary": {
            "medication_plans": 2,
            "missed_doses_alert": 1,
            "school_tasks": 5,
            "home_tasks": 6,
            "medical_appointments": 1,
            "expenses_30d": len(expenses),
            "currency": "CLP",
            # VantGuide
            "unit_functions_study": len(school_function_ids),
            "unit_functions_medication": 2,
            "unit_functions_appointment": 1 if appt_uf else 0,
            "unit_functions_ai_pending_confirmation": 1 if ai_pending_uf else 0,
            "unit_function_version_history": 2 if losartan_uf_row else 0,
            "evidence_items_positive": 2,    # diagnóstico + improvement_detected
            "evidence_items_negative": 3,
            "memory_items": len(memories) + (1 if losartan_uf_row else 0),
            "support_profiles": 4,
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


def _email_from_name(display_name: str, fallback_id: str) -> str:
    first = (display_name or "").strip().split(" ")[0].lower()
    # quitar acentos y dejar solo a-z0-9
    first = unicodedata.normalize("NFKD", first).encode("ascii", "ignore").decode("ascii")
    first = re.sub(r"[^a-z0-9]", "", first)
    if not first:
        first = f"persona{fallback_id[:6]}"
    return f"{first}@vantdomus.local"


@router.post("/seed_members")
def seed_members(household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    """
    VG+2.6: crea (idempotente) una cuenta de usuario por integrante del hogar y
    la vincula a su persona (persons.user_id). Permite demostrar la visibilidad
    por persona: cada integrante entra con su cuenta (rol `member`, NO owner) y
    ve solo lo suyo + lo compartido; el owner sigue viendo todo.
    """
    require_operational_feature_enabled("Demo seed", "VANTDOMUS_ALLOW_DEMO_SEED")
    require_household_role(db, user["user_id"], household_id, "owner")

    persons = db.execute(
        "SELECT id, display_name FROM persons WHERE household_id=? ORDER BY created_at",
        (household_id,),
    ).fetchall()

    members = []
    for p in persons:
        email = _email_from_name(p["display_name"], p["id"])
        urow = db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
        if urow:
            uid = urow["id"]
        else:
            uid = str(uuid.uuid4())
            db.execute(
                "INSERT INTO users (id,email,password_hash,is_active,created_at) VALUES (?,?,?,?,?)",
                (uid, email, hash_password(DEMO_MEMBER_PASSWORD), 1, now()),
            )
        # Rol member (no owner): así NO ve todo, solo self + household.
        db.execute(
            "INSERT OR IGNORE INTO household_memberships (household_id,user_id,role,created_at) VALUES (?,?,?,?)",
            (household_id, uid, "member", now()),
        )
        db.execute("UPDATE persons SET user_id=? WHERE id=?", (uid, p["id"]))

        # Nota privada (solo 'self'): demuestra que un integrante ve lo suyo
        # privado y NO lo privado de los demás (el owner sí ve todo).
        # Idempotente: una sola por persona (marker demo_private en metadata).
        existing_private = db.execute(
            "SELECT id FROM evidence_items WHERE household_id=? AND person_id=? "
            "AND evidence_type='manual_note' AND metadata LIKE '%\"demo_private\": true%'",
            (household_id, p["id"]),
        ).fetchone()
        if not existing_private:
            organization_id = get_household_organization_id(db, household_id)
            log_evidence_internal(
                db,
                household_id=household_id,
                organization_id=organization_id,
                evidence_type="manual_note",
                created_by_user_id=uid,
                person_id=p["id"],
                text_content=(
                    f"Nota privada de {p['display_name']}: esto solo lo ve "
                    f"{p['display_name'].split(' ')[0]} (y un familiar responsable). "
                    "Los demás integrantes no la ven."
                ),
                metadata={"demo_private": True},
                visible_to_roles=["self"],
            )

        members.append({"person": p["display_name"], "email": email, "role": "member"})

    db.commit()
    return {
        "household_id": household_id,
        "password": DEMO_MEMBER_PASSWORD,
        "members": members,
    }
