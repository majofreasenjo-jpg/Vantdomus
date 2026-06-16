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
