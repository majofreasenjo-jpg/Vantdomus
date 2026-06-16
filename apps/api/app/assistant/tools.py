import json
import os
import subprocess
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from app.audit import write_assistant_action_log, write_audit_log
from app.tenancy import get_household_organization_id


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "create_operational_task",
            "description": "Create an operational task/order in the database when the user asks to repair, review, maintain, inspect or assign work.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Clear title for the action."},
                    "priority": {"type": "string", "enum": ["low", "medium", "high"], "description": "Operational priority."},
                },
                "required": ["title", "priority"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "register_financial_expense",
            "description": "Register an expense, supply purchase, rental or operating cost in the database.",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount": {"type": "number", "description": "Numeric amount."},
                    "currency": {"type": "string", "description": "Currency code or symbol, default USD."},
                    "category": {"type": "string", "description": "Accounting category, such as supplies, repairs, general, hardware or pharmacy."},
                    "merchant": {"type": "string", "description": "Vendor, supplier or item name."},
                },
                "required": ["amount", "currency", "category", "merchant"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_claim_report",
            "description": "Generate the Antucoya/PUMA claim timeline Excel report when explicitly requested.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_formal_letter",
            "description": "Generate a formal DOCX letter for claim, pre-arbitration or appeal workflows.",
            "parameters": {
                "type": "object",
                "properties": {
                    "severity_level": {"type": "string", "enum": ["amistoso", "reclamo", "arbitral"]},
                    "recipient_name": {"type": "string"},
                    "recipient_role": {"type": "string"},
                    "subject": {"type": "string"},
                    "amount": {"type": "string"},
                    "facts_description": {"type": "string"},
                    "legal_arguments": {"type": "string"},
                },
                "required": [
                    "severity_level",
                    "recipient_name",
                    "recipient_role",
                    "subject",
                    "facts_description",
                    "legal_arguments",
                ],
            },
        },
    },
    # =========================================================================
    # VANTGUIDE TOOLS — núcleo transversal de funciones, evidencia, memoria
    # =========================================================================
    {
        "type": "function",
        "function": {
            "name": "create_family_function",
            "description": (
                "Crea una UnitFunction (también llamada Guía Familiar Función). "
                "Es la entidad central de VantGuide: cualquier cosa que una "
                "persona debe cumplir — estudiar, tomar medicamento, hacer una "
                "rutina del hogar, asistir a cita, completar protocolo B2B. "
                "Usa esta tool cuando el usuario pida agendar/recordar/asignar/programar "
                "algo concreto para una persona específica del hogar o unidad."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "person_id": {"type": "string", "description": "UUID de la persona a quien le toca."},
                    "category": {
                        "type": "string",
                        "enum": [
                            "study", "medication", "health_routine", "hygiene", "nutrition",
                            "sleep", "home_chore", "appointment", "document_deadline", "finance",
                            "social_connection", "calm_regulation", "exercise", "caregiver_task",
                            "work_task", "operational_protocol", "safety_check",
                        ],
                        "description": "Categoría de la función. 'study' para colegio/universidad, 'medication' para pastillas, 'home_chore' para tareas del hogar, etc.",
                    },
                    "title": {"type": "string", "description": "Título claro y corto. Ej: 'Tomar Losartán 50mg', 'Estudiar fracciones'."},
                    "description": {"type": "string", "description": "Contexto adicional opcional."},
                    "due_at": {"type": "string", "description": "ISO 8601 UTC para funciones puntuales. Opcional si tiene schedule recurrente."},
                    "schedule_times": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Horarios diarios HH:MM (ej. ['08:00','20:00']) para funciones recurrentes como medicación.",
                    },
                    "recurrence": {"type": "string", "enum": ["once", "daily", "weekly"], "description": "Frecuencia. Default: 'once'."},
                    "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"]},
                    "responsible_person_id": {"type": "string", "description": "Quién supervisa (padre, cuidador). Opcional."},
                },
                "required": ["person_id", "category", "title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "log_function_evidence",
            "description": (
                "Registra una pieza de evidencia (positiva O NEGATIVA) sobre una función. "
                "Usa esto cuando el usuario reporta que cumplió/no cumplió una rutina, "
                "subió una foto/documento, o cuando vos como asistente generaste un "
                "resumen del avance. La evidencia negativa (que algo no funcionó) "
                "es tan valiosa como la positiva."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "unit_function_id": {"type": "string", "description": "UUID de la función."},
                    "evidence_type": {
                        "type": "string",
                        "enum": [
                            "checkin_confirmed", "checkin_missed", "voice_confirmation",
                            "photo_evidence", "caregiver_confirmation", "document_uploaded",
                            "assignment_completed", "quiz_completed", "medication_taken",
                            "medication_missed", "appointment_attended", "appointment_missed",
                            "calm_session_completed", "study_session_completed",
                            "reward_granted", "alert_triggered", "ai_summary", "manual_note",
                            "negative_outcome", "improvement_detected",
                        ],
                    },
                    "person_id": {"type": "string", "description": "Persona a quien pertenece la evidencia."},
                    "text_content": {"type": "string", "description": "Descripción libre opcional."},
                },
                "required": ["unit_function_id", "evidence_type", "person_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_person_memory",
            "description": (
                "Guarda una memoria estructurada de largo plazo sobre una persona. "
                "Usá esto cuando aprendiste algo importante: una preferencia (le funciona "
                "estudiar con música), un patrón (Elena toma mejor la pastilla en el desayuno), "
                "una mejora (adherencia subió tras cambio de horario) o un aprendizaje "
                "NEGATIVO (estudiar de noche no funcionó). La memoria vive en VantDomus, "
                "no en el modelo."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "person_id": {"type": "string", "description": "Persona. Omitir si es memoria del hogar entero."},
                    "memory_type": {
                        "type": "string",
                        "enum": [
                            "preference", "family_story", "routine_pattern", "health_context",
                            "study_pattern", "motivation_pattern", "calm_strategy",
                            "risk_pattern", "social_connection", "negative_learning",
                            "improvement", "caregiver_note", "operational_context",
                        ],
                    },
                    "content": {"type": "string", "description": "El aprendizaje en palabras claras y cortas."},
                    "importance": {"type": "number", "description": "0.0-1.0. Default 0.5. Memorias críticas (riesgo) > 0.7."},
                },
                "required": ["memory_type", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_caregiver_alert",
            "description": (
                "Crea una alerta para el rol cuidador/responsable cuando se detecta "
                "un patrón preocupante (varios missed, retraso significativo, riesgo). "
                "NO usar para recordatorios normales — eso es función del scheduler. "
                "Usar solo cuando hay algo que el cuidador debe saber AHORA."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "unit_function_id": {"type": "string", "description": "Función relacionada con la alerta."},
                    "severity": {"type": "string", "enum": ["low", "medium", "high"]},
                    "title": {"type": "string"},
                    "message": {"type": "string", "description": "Mensaje al cuidador, calmo y accionable."},
                    "target_role": {"type": "string", "enum": ["responsible", "household", "caregiver"]},
                },
                "required": ["severity", "title", "message"],
            },
        },
    },
]


def execute_tool_call(db, household_id: str, tool_name: str, args: dict, user_id: str | None = None) -> str:
    # Pre-declare result so that an unhandled exception path inside any branch
    # below cannot leave `result` unbound when the audit-log call references it.
    result: str = f"ERROR: Tool {tool_name} is not implemented or invalid."
    try:
        # Each branch is mutually exclusive; using elif guarantees exactly one
        # handler runs per call, which prevents accidental double-execution
        # and ensures unknown tools fall through to the default error above.
        if tool_name == "create_operational_task":
            result = _create_operational_task(db, household_id, args, user_id=user_id)
        elif tool_name == "register_financial_expense":
            result = _register_financial_expense(db, household_id, args, user_id=user_id)
        elif tool_name == "generate_claim_report":
            result = _generate_claim_report()
        elif tool_name == "generate_formal_letter":
            result = _generate_formal_letter(args)
        # VantGuide tools
        elif tool_name == "create_family_function":
            result = _create_family_function(db, household_id, args, user_id=user_id)
        elif tool_name == "log_function_evidence":
            result = _log_function_evidence(db, household_id, args, user_id=user_id)
        elif tool_name == "update_person_memory":
            result = _update_person_memory(db, household_id, args, user_id=user_id)
        elif tool_name == "create_caregiver_alert":
            result = _create_caregiver_alert(db, household_id, args, user_id=user_id)
        write_assistant_action_log(
            db,
            household_id=household_id,
            user_id=user_id,
            tool_name=tool_name,
            arguments=args,
            result=result,
            status="success" if result.startswith("SUCCESS") else "error",
            commit=True,
        )
        return result
    except Exception as exc:
        result = f"ERROR: Executing tool {tool_name} failed: {exc}"
        write_assistant_action_log(
            db,
            household_id=household_id,
            user_id=user_id,
            tool_name=tool_name,
            arguments=args,
            result=result,
            status="error",
            commit=True,
        )
        return result


def _create_operational_task(db, household_id: str, args: dict, user_id: str | None = None) -> str:
    task_id = str(uuid.uuid4())
    now = utcnow_iso()
    organization_id = get_household_organization_id(db, household_id)
    db.execute(
        """
        INSERT INTO task_items (id, household_id, organization_id, title, status, due_at, assigned_person_id, priority, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            task_id,
            household_id,
            organization_id,
            args.get("title", "Tarea auto-generada por IA"),
            "open",
            None,
            None,
            args.get("priority", "medium"),
            json.dumps(["ai"]),
            now,
            now,
        ),
    )
    write_audit_log(
        db,
        action="assistant_create",
        resource_type="task",
        household_id=household_id,
        user_id=user_id,
        resource_id=task_id,
        metadata={"tool": "create_operational_task", "title": args.get("title"), "priority": args.get("priority")},
    )
    db.commit()
    return f"SUCCESS: Task created successfully. Assigned Task ID: {task_id}"


def _register_financial_expense(db, household_id: str, args: dict, user_id: str | None = None) -> str:
    expense_id = str(uuid.uuid4())
    now = utcnow_iso()
    organization_id = get_household_organization_id(db, household_id)
    db.execute(
        """
        INSERT INTO expenses (id, household_id, organization_id, amount, currency, category, merchant, expense_at, notes, person_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            expense_id,
            household_id,
            organization_id,
            float(args.get("amount", 0)),
            args.get("currency", "USD"),
            args.get("category", "general"),
            args.get("merchant", "IA Bot"),
            now,
            "Registered by VantUnit assistant",
            None,
            now,
        ),
    )
    write_audit_log(
        db,
        action="assistant_create",
        resource_type="expense",
        household_id=household_id,
        user_id=user_id,
        resource_id=expense_id,
        metadata={
            "tool": "register_financial_expense",
            "amount": args.get("amount"),
            "currency": args.get("currency", "USD"),
            "category": args.get("category", "general"),
        },
    )
    db.commit()
    return f"SUCCESS: Expense/Supply registered successfully. Expense ID: {expense_id}"


def _generate_claim_report() -> str:
    base_dir = os.getenv("VANTDOMUS_CLAIM_REPORT_DIR")
    script_name = os.getenv("VANTDOMUS_CLAIM_REPORT_SCRIPT", "generate_claims_timeline_v3.py")
    if not base_dir:
        return "ERROR: VANTDOMUS_CLAIM_REPORT_DIR is not configured."

    base_path = Path(base_dir)
    script_path = base_path / script_name
    if not script_path.exists():
        return f"ERROR: Claim report script not found: {script_path}"

    result = subprocess.run(["python", str(script_path)], capture_output=True, text=True, cwd=str(base_path), timeout=120)
    if result.returncode == 0:
        return f"SUCCESS: Claim timeline report generated in {base_path}"
    return f"ERROR_EJECUCION: {result.stderr}"


def _generate_formal_letter(args: dict) -> str:
    generator_script = os.getenv("VANTDOMUS_LETTER_GENERATOR")
    output_dir = os.getenv("VANTDOMUS_LETTER_OUTPUT_DIR")
    if not generator_script or not output_dir:
        return "ERROR: VANTDOMUS_LETTER_GENERATOR and VANTDOMUS_LETTER_OUTPUT_DIR must be configured."

    script_path = Path(generator_script)
    out_path = Path(output_dir)
    if not script_path.exists():
        return f"ERROR: Letter generator not found: {script_path}"

    out_path.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".json", encoding="utf-8") as handle:
        json.dump(args, handle, ensure_ascii=False)
        temp_path = handle.name

    try:
        result = subprocess.run(
            ["python", str(script_path), temp_path, str(out_path)],
            capture_output=True,
            text=True,
            cwd=str(script_path.parent),
            encoding="utf-8",
            timeout=120,
        )
        if result.returncode == 0:
            filename = result.stdout.strip().splitlines()[-1] if result.stdout.strip() else str(out_path)
            return f"SUCCESS: Formal letter generated successfully: {filename}"
        return f"ERROR_EJECUCION: {result.stderr}"
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass


# =============================================================================
# VANTGUIDE TOOLS
# =============================================================================

def _create_family_function(db, household_id: str, args: dict, user_id: str | None = None) -> str:
    """
    Crea una UnitFunction vía la lógica común (`create_unit_function_internal`).
    Acepta los args del schema declarado arriba en TOOL_DEFINITIONS.
    """
    from app.routes.unit_functions import create_unit_function_internal

    person_id = args.get("person_id")
    category = args.get("category")
    title = args.get("title")
    if not (person_id and category and title):
        return "ERROR: create_family_function requires person_id, category and title"

    organization_id = get_household_organization_id(db, household_id)

    # Schedule de horarios diarios opcional (medicación, rutinas)
    schedule_times = args.get("schedule_times")
    schedule = {}
    if schedule_times and isinstance(schedule_times, list):
        schedule = {"times": list(schedule_times), "days": [1, 2, 3, 4, 5, 6, 7]}

    try:
        uf_id = create_unit_function_internal(
            db,
            household_id=household_id,
            organization_id=organization_id,
            person_id=person_id,
            category=category,
            title=title,
            source_type="ai_suggestion",
            created_by_user_id=user_id or "ai",
            created_by_ai=True,
            description=args.get("description"),
            responsible_person_id=args.get("responsible_person_id"),
            due_at=args.get("due_at"),
            schedule=schedule,
            recurrence=args.get("recurrence") or ("daily" if schedule_times else "once"),
            priority=args.get("priority", "medium"),
            dual_write_task=True,
        )
        db.commit()
        return f"SUCCESS: VantGuide function created. ID: {uf_id} category={category}"
    except Exception as exc:
        return f"ERROR: failed to create VantGuide function: {exc}"


def _log_function_evidence(db, household_id: str, args: dict, user_id: str | None = None) -> str:
    """Registra evidencia (positiva o negativa) sobre una función."""
    from app.routes.vantguide_library import log_evidence_internal

    unit_function_id = args.get("unit_function_id")
    evidence_type = args.get("evidence_type")
    person_id = args.get("person_id")
    if not (unit_function_id and evidence_type):
        return "ERROR: log_function_evidence requires unit_function_id and evidence_type"

    organization_id = get_household_organization_id(db, household_id)
    try:
        ev_id = log_evidence_internal(
            db,
            household_id=household_id,
            organization_id=organization_id,
            evidence_type=evidence_type,
            created_by_user_id=user_id or "ai",
            unit_function_id=unit_function_id,
            person_id=person_id,
            text_content=args.get("text_content"),
            metadata={"by_ai": True},
        )
        db.commit()
        return f"SUCCESS: Evidence logged. ID: {ev_id} type={evidence_type}"
    except Exception as exc:
        return f"ERROR: failed to log evidence: {exc}"


def _update_person_memory(db, household_id: str, args: dict, user_id: str | None = None) -> str:
    """Guarda una memoria estructurada en VantDomus (no en el modelo)."""
    from app.routes.vantguide_library import upsert_memory_internal

    memory_type = args.get("memory_type")
    content = args.get("content")
    if not (memory_type and content):
        return "ERROR: update_person_memory requires memory_type and content"

    organization_id = get_household_organization_id(db, household_id)
    try:
        mem_id = upsert_memory_internal(
            db,
            household_id=household_id,
            organization_id=organization_id,
            memory_type=memory_type,
            content=content,
            created_by_user_id=user_id or "ai",
            person_id=args.get("person_id"),
            importance=float(args.get("importance", 0.5)),
        )
        db.commit()
        return f"SUCCESS: Memory stored. ID: {mem_id} type={memory_type}"
    except Exception as exc:
        return f"ERROR: failed to store memory: {exc}"


def _create_caregiver_alert(db, household_id: str, args: dict, user_id: str | None = None) -> str:
    """
    Crea una alerta para el cuidador/responsable. Usa la tabla existente
    `alerts` y opcionalmente registra un function_event de escalation.
    """
    severity = args.get("severity", "medium")
    title = args.get("title", "Atención del cuidador requerida")
    message = args.get("message", "")
    unit_function_id = args.get("unit_function_id")

    organization_id = get_household_organization_id(db, household_id)
    alert_id = str(uuid.uuid4())
    ts = utcnow_iso()
    db.execute(
        "INSERT INTO alerts (id, household_id, organization_id, severity, event_id, title, message, status, dedupe_key, created_at) "
        "VALUES (?,?,?,?,?,?,?,?,?,?)",
        (
            alert_id, household_id, organization_id, severity, None,
            title, message, "open", None, ts,
        ),
    )

    # Si la alerta refiere a una función, dejar marca en function_events
    if unit_function_id:
        try:
            db.execute(
                "INSERT OR IGNORE INTO function_events ("
                "id, unit_function_id, household_id, organization_id, event_type, "
                "scheduled_for, actual_at, payload, triggered_by, "
                "dedupe_key, created_at"
                ") VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (
                    str(uuid.uuid4()), unit_function_id, household_id, organization_id,
                    "escalation_due", ts, ts,
                    json.dumps({"alert_id": alert_id, "severity": severity, "by_ai": True}, ensure_ascii=False),
                    "ai", f"{unit_function_id}|{ts}|escalation_due_ai", ts,
                ),
            )
        except Exception:
            pass  # Race condition o función inexistente: la alerta queda igual

    db.commit()
    return f"SUCCESS: Caregiver alert created. ID: {alert_id} severity={severity}"
