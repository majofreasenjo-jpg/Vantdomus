"""
CP1c-FUNC-MIN-3.1 — Proposal Store + Executor.

Guarda las propuestas del orquestador (status 'pending') y, SOLO al confirmar un
humano, ejecuta la acción real y la audita. El modelo/mock nunca llega hasta
aquí sin pasar por el gate de confirmación.
"""

import json
import uuid
from datetime import datetime, timedelta, timezone

from app.audit import write_assistant_action_log, write_audit_log
from app.tenancy import get_household_organization_id
from .registry import get_contract


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _expiry(hours: int = 24) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


def _row_to_dict(row) -> dict:
    d = dict(row)
    if d.get("proposed_payload"):
        try:
            d["proposed_payload"] = json.loads(d["proposed_payload"])
        except Exception:
            d["proposed_payload"] = {}
    else:
        d["proposed_payload"] = {}
    d["sensitive"] = bool(d.get("sensitive"))
    d["requires_confirmation"] = bool(d.get("requires_confirmation"))
    # MIN-3.2 — la UI necesita saber qué campos puede editar el humano.
    contract = get_contract(d.get("tool_name", ""))
    d["editable_fields"] = list(contract.editable_fields) if contract else []
    return d


# =============================================================================
# MIN-3.2 — Expiración (lazy) + validación de edición segura
# =============================================================================

def _is_expired(d: dict) -> bool:
    exp = d.get("expires_at")
    return bool(exp) and exp < _now()


def _lazy_expire(db, d: dict) -> dict:
    """Si una propuesta pending ya venció, se marca 'expired' al leerla."""
    if d and d.get("status") == "pending" and _is_expired(d):
        db.execute("UPDATE assistant_proposals SET status='expired' WHERE id=?", (d["id"],))
        db.commit()
        d["status"] = "expired"
    return d


def validate_overrides(tool_name: str, overrides: dict) -> dict:
    """
    Edición segura: solo campos whitelisted en el contrato, con tipos básicos
    correctos. tool/household/user/person fuera de whitelist se RECHAZAN.
    Devuelve los overrides saneados; lanza ValueError con motivo claro si no.
    """
    if not overrides:
        return {}
    contract = get_contract(tool_name)
    if not contract:
        raise ValueError(f"Tool desconocida: {tool_name}")
    allowed = set(contract.editable_fields)
    bad = [k for k in overrides.keys() if k not in allowed]
    if bad:
        raise ValueError(
            f"Campos no editables: {', '.join(sorted(bad))}. "
            f"Solo puedes modificar: {', '.join(sorted(allowed)) or '(ninguno)'}."
        )
    props = (contract.input_schema or {}).get("properties", {})
    clean: dict = {}
    for k, v in overrides.items():
        expected = (props.get(k) or {}).get("type")
        if expected == "array":
            if not isinstance(v, list) or not all(isinstance(x, str) and x.strip() for x in v):
                raise ValueError(f"'{k}' debe ser una lista de textos no vacíos.")
            v = [str(x).strip()[:60] for x in v][:20]
            if not v:
                raise ValueError(f"'{k}' no puede quedar vacío.")
        elif expected == "string":
            if not isinstance(v, str):
                raise ValueError(f"'{k}' debe ser texto.")
            v = v.strip()[:200]
            if not v:
                raise ValueError(f"'{k}' no puede quedar vacío.")
        clean[k] = v
    return clean


def create_proposal(db, *, household_id, user_id, action, provider_name) -> dict:
    """Persiste una ProposedAction como 'pending'. No ejecuta nada."""
    contract = get_contract(action.tool_name)
    if not contract:
        raise ValueError(f"Tool desconocida: {action.tool_name}")

    org = get_household_organization_id(db, household_id)
    pid = str(uuid.uuid4())
    db.execute(
        "INSERT INTO assistant_proposals ("
        "id, household_id, organization_id, person_id, user_id, tool_name, category, "
        "title, summary, sensitive, requires_confirmation, proposed_payload, provider, "
        "status, created_at, expires_at"
        ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            pid, household_id, org, action.person_id, user_id, action.tool_name, action.category,
            action.title, action.summary, 1 if contract.sensitive else 0,
            1 if contract.requires_confirmation else 0,
            json.dumps(action.payload, ensure_ascii=False), provider_name,
            "pending", _now(), _expiry(),
        ),
    )
    # Auditar la PROPUESTA (no solo la ejecución).
    write_audit_log(
        db, action="assistant_proposed", resource_type="assistant_proposal",
        household_id=household_id, user_id=user_id, resource_id=pid,
        metadata={"tool": action.tool_name, "category": action.category, "provider": provider_name},
    )
    db.commit()
    row = db.execute("SELECT * FROM assistant_proposals WHERE id=?", (pid,)).fetchone()
    return _row_to_dict(row)


def get_proposal(db, proposal_id: str) -> dict | None:
    row = db.execute("SELECT * FROM assistant_proposals WHERE id=?", (proposal_id,)).fetchone()
    return _lazy_expire(db, _row_to_dict(row)) if row else None


def list_proposals(db, household_id: str, status: str, role: str, my_person_id: str | None) -> list[dict]:
    # MIN-3.2 — historial mínimo: status="all" devuelve las últimas 50 en
    # cualquier estado (QA/usuario, acotado). Un status concreto filtra normal.
    if status == "all":
        rows = db.execute(
            "SELECT * FROM assistant_proposals WHERE household_id=? "
            "ORDER BY created_at DESC LIMIT 50",
            (household_id,),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM assistant_proposals WHERE household_id=? AND status=? "
            "ORDER BY created_at DESC LIMIT 200",
            (household_id, status),
        ).fetchall()
    items = [_lazy_expire(db, _row_to_dict(r)) for r in rows]
    if status not in ("all",):
        # tras lazy-expire pueden haber cambiado de estado; re-filtrar
        items = [p for p in items if p["status"] == status]
    if role not in ("owner", "admin"):
        items = [p for p in items if not p.get("person_id") or p.get("person_id") == my_person_id]
    return items


def reject_proposal(db, proposal, user_id: str) -> dict:
    db.execute(
        "UPDATE assistant_proposals SET status='rejected', decided_by_user_id=?, decided_at=? WHERE id=?",
        (user_id, _now(), proposal["id"]),
    )
    write_audit_log(
        db, action="assistant_rejected", resource_type="assistant_proposal",
        household_id=proposal["household_id"], user_id=user_id, resource_id=proposal["id"],
        metadata={"tool": proposal["tool_name"]},
    )
    db.commit()
    return get_proposal(db, proposal["id"])


def execute_proposal(db, proposal, user_id: str, overrides: dict | None = None) -> dict:
    """
    Ejecuta una propuesta YA confirmada por un humano. Marca 'confirmed' →
    ejecuta → 'executed' | 'failed'. Toda ejecución queda auditada.

    MIN-3.2: solo se ejecuta desde 'pending' (o 'failed' = reintento controlado);
    los overrides pasan por validate_overrides (whitelist + tipos) ANTES de
    tocar nada; si editan person_id se verifica que pertenezca al hogar; la
    edición queda auditada.
    """
    if proposal["status"] not in ("pending", "failed"):
        raise ValueError(f"La propuesta está '{proposal['status']}' y no puede ejecutarse.")
    if _is_expired(proposal):
        raise ValueError("La propuesta expiró. Pídele a Domi que la proponga de nuevo.")

    hid = proposal["household_id"]
    org = proposal["organization_id"] or get_household_organization_id(db, hid)
    tool = proposal["tool_name"]
    clean_overrides = validate_overrides(tool, overrides or {})
    payload = {**(proposal.get("proposed_payload") or {}), **clean_overrides}
    pid = payload.get("person_id") or proposal.get("person_id")

    # Si el humano editó la persona, debe existir EN ESTE hogar (anti-tamper).
    if clean_overrides.get("person_id"):
        row = db.execute("SELECT id FROM persons WHERE id=? AND household_id=?",
                         (clean_overrides["person_id"], hid)).fetchone()
        if not row:
            raise ValueError("La persona indicada no pertenece a este hogar.")

    # Auditar la EDICIÓN (solo claves editadas; los valores van al action log).
    if clean_overrides:
        write_audit_log(
            db, action="assistant_proposal_edited", resource_type="assistant_proposal",
            household_id=hid, user_id=user_id, resource_id=proposal["id"],
            metadata={"tool": tool, "edited_fields": sorted(clean_overrides.keys())},
        )

    db.execute("UPDATE assistant_proposals SET status='confirmed', decided_by_user_id=?, decided_at=? WHERE id=?",
               (user_id, _now(), proposal["id"]))

    result_type = None
    result_id = None
    try:
        if tool == "propose_shopping_item":
            items = payload.get("items") or []
            if not items:
                raise ValueError("No hay productos para agregar.")
            created = []
            for name in items[:20]:
                iid = str(uuid.uuid4())
                db.execute(
                    "INSERT INTO household_shopping_items ("
                    "id, household_id, organization_id, requested_by_user_id, requested_by_person_id, "
                    "assigned_to_person_id, item_name, quantity, unit, category, priority, "
                    "store_type, preferred_store, estimated_price, currency, external_url, "
                    "status, notes, metadata, created_at, updated_at"
                    ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (iid, hid, org, user_id, pid, None, str(name), None, None,
                     payload.get("category", "grocery"), "normal", payload.get("store_type", "supermarket"),
                     None, None, "CLP", None, "needed", "Propuesto por Domi (confirmado)",
                     json.dumps({"from_assistant_proposal": proposal["id"]}, ensure_ascii=False), _now(), _now()),
                )
                created.append(iid)
            result_type, result_id = "shopping_items", f"{len(created)} items"

        elif tool == "propose_study_task":
            if not pid:
                raise ValueError("Asigná un integrante para la tarea de estudio.")
            from app.routes.unit_functions import create_unit_function_internal
            result_id = create_unit_function_internal(
                db, household_id=hid, organization_id=org, person_id=pid,
                category="study", title=payload.get("title", "Compromiso de estudio"),
                source_type="ai_suggestion", created_by_user_id=user_id, created_by_ai=True,
                due_at=payload.get("due_at"),
                metadata={"from_assistant_proposal": proposal["id"]}, dual_write_task=False,
            )
            result_type = "unit_function"

        elif tool == "propose_family_notice":
            post_id = str(uuid.uuid4())
            db.execute(
                "INSERT INTO family_board_posts ("
                "id, household_id, organization_id, author_user_id, author_person_id, "
                "post_type, title, body, priority, pinned, "
                "visible_to_roles, visible_to_person_ids, expires_at, metadata, created_at, updated_at"
                ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (post_id, hid, org, user_id, pid, "announcement",
                 payload.get("title", "Aviso para la familia"), payload.get("body", ""),
                 "normal", 0, None, None, None,
                 json.dumps({"from_assistant_proposal": proposal["id"]}, ensure_ascii=False), _now(), _now()),
            )
            result_type, result_id = "family_post", post_id
        else:
            raise ValueError(f"Tool no ejecutable: {tool}")

        db.execute(
            "UPDATE assistant_proposals SET status='executed', result_resource_type=?, result_resource_id=? WHERE id=?",
            (result_type, str(result_id), proposal["id"]),
        )
        write_assistant_action_log(
            db, household_id=hid, user_id=user_id, tool_name=tool,
            arguments=payload, result=f"SUCCESS: {result_type} {result_id}", status="success",
        )
        write_audit_log(
            db, action="assistant_executed", resource_type=result_type or "assistant_proposal",
            household_id=hid, user_id=user_id, resource_id=str(result_id),
            metadata={"tool": tool, "proposal_id": proposal["id"]},
        )
        db.commit()
        return get_proposal(db, proposal["id"])

    except Exception as exc:
        db.execute("UPDATE assistant_proposals SET status='failed', error=? WHERE id=?",
                   (str(exc)[:500], proposal["id"]))
        write_assistant_action_log(
            db, household_id=hid, user_id=user_id, tool_name=tool,
            arguments=payload, result=f"ERROR: {exc}", status="error",
        )
        db.commit()
        raise
