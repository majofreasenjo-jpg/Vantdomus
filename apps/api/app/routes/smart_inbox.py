"""
VG+2.2 — Bandeja Inteligente familiar v1.

Sube/pega un documento → extrae texto (PDF; imagen queda pendiente de revisión
manual si no hay OCR) → clasifica por REGLAS simples y auditables → crea un
DocumentRouteCandidate con la ruta propuesta. NO crea acciones sensibles hasta
que un humano confirme.

Seguridad y límites (decisiones del co-arquitecto):
- No se envían documentos completos a IA si VANTDOMUS_AI_FEATURES_ENABLED=false.
- No se inventan datos faltantes; si falta el monto, se pide completarlo.
- No diagnostica ni crea tratamiento; medication/health requieren confirmación.
- Respeta scoping household/persona; un candidato "privado" (con person_id) solo
  lo ve el owner/admin o el propio integrante.
"""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from ..audit import write_audit_log
from ..deps import get_current_user, get_db, require_household_role
from ..tenancy import get_household_organization_id
from .unit_functions import create_unit_function_internal
from .vantguide_library import log_evidence_internal, upsert_memory_internal

router = APIRouter(prefix="/smart_inbox", tags=["SmartInbox"])

_MAX_BYTES = 10 * 1024 * 1024
_PREVIEW_LEN = 600


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Extracción de texto (PDF). Imagen sin OCR robusto → texto vacío (pendiente).
# ---------------------------------------------------------------------------
def _extract_text(filename: str, data: bytes) -> str:
    suffix = os.path.splitext(filename or "")[1].lower().lstrip(".")
    if suffix not in ("pdf",):
        # Imagen u otro formato: no forzamos OCR en v1.
        return ""
    try:
        import fitz  # PyMuPDF (lazy)
    except Exception:
        return ""
    try:
        with fitz.open(stream=data, filetype="pdf") as doc:
            return " ".join(page.get_text() for page in doc).strip()
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# Clasificador por reglas (auditable). Devuelve la mejor ruta por conteo de
# coincidencias de palabras clave. Sin match claro → general_archive.
# ---------------------------------------------------------------------------
_RULES = [
    {
        "route_type": "prescription_to_medication",
        "suggested_category": "medication",
        "keywords": ["receta", "medicamento", "comprimido", "tomar", "dosis",
                     "mg", "cada 8 horas", "cada 12 horas", "cada 24 horas",
                     "losart", "aspirina", "atorvastat", "metformina"],
        "requires_confirmation": True,
    },
    {
        "route_type": "receipt_to_finance",
        "suggested_category": "groceries",
        "keywords": ["boleta", "factura", "total", "subtotal", "supermercado",
                     "farmacia", "pago", "monto", "clp", "comercio", "iva"],
        "requires_confirmation": True,
    },
    {
        "route_type": "shopping_list_to_items",
        "suggested_category": "shopping",
        "keywords": ["lista de compras", "lista del super", "comprar", "lista super",
                     "hay que comprar", "falta", "necesitamos", "ir al super",
                     "supermercado lista", "feria"],
        "requires_confirmation": True,
    },
    {
        "route_type": "school_notice_to_study",
        "suggested_category": "study",
        "keywords": ["prueba", "evaluaci", "tarea", "trabajo", "entrega",
                     "lectura", "ramo", "curso", "colegio", "profesor", "circular"],
        "requires_confirmation": True,
    },
    {
        "route_type": "doctor_document_to_health",
        "suggested_category": "health_routine",
        "keywords": ["examen", "diagn", "control", "medic", "clinica", "clínica",
                     "laboratorio", "presion", "presión", "glicemia", "informe"],
        "requires_confirmation": True,
    },
    {
        "route_type": "insurance_policy_to_document",
        "suggested_category": "document_deadline",
        "keywords": ["poliza", "póliza", "seguro", "cobertura", "prima",
                     "deducible", "beneficio"],
        "requires_confirmation": True,
    },
    {
        "route_type": "bill_to_finance_or_deadline",
        "suggested_category": "document_deadline",
        "keywords": ["vencimiento", "pagar antes", "fecha de pago", "cuenta",
                     "servicio", "luz", "agua", "gas", "internet"],
        "requires_confirmation": True,
    },
]

_MED_RE = re.compile(
    r"([A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ\-]{3,30})\s*(\d{1,4})\s*(mg|mcg|g|ml|ui)\b",
    re.IGNORECASE,
)
_AMOUNT_RE = re.compile(
    r"(?:total|monto|pagar|\$|clp)\D{0,12}([\d][\d.\,]{2,})",
    re.IGNORECASE,
)
_DATE_RE = re.compile(r"\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b")


def _to_number(raw: str) -> Optional[float]:
    raw = (raw or "").strip()
    # Formato CLP: punto = miles. Si hay coma decimal (poco común en boletas), la respetamos.
    if "," in raw and "." in raw:
        raw = raw.replace(".", "").replace(",", ".")
    else:
        raw = raw.replace(".", "").replace(",", "")
    try:
        v = float(raw)
        return v if v > 0 else None
    except ValueError:
        return None


# Marcas frecuentes en Chile para detectar el comercio real (no la dirección).
_MERCHANTS = [
    ("lider", "Líder"), ("jumbo", "Jumbo"), ("santa isabel", "Santa Isabel"),
    ("tottus", "Tottus"), ("unimarc", "Unimarc"), ("ekono", "Ekono"),
    ("acuenta", "Acuenta"), ("mayorista 10", "Mayorista 10"),
    ("cruz verde", "Cruz Verde"), ("salcobrand", "Salcobrand"),
    ("ahumada", "Farmacias Ahumada"), ("dr. simi", "Dr. Simi"),
    ("sodimac", "Sodimac"), ("easy", "Easy"), ("construmart", "Construmart"),
    ("copec", "Copec"), ("shell", "Shell"), ("petrobras", "Petrobras"),
]


def _detect_merchant(text: str) -> str:
    low = (text or "").lower()
    for key, label in _MERCHANTS:
        if key in low:
            return label
    # Si no hay marca conocida, la primera línea "de nombre" (no dirección/RUT/código).
    for ln in (text or "").splitlines():
        s = ln.strip()
        if len(s) < 3:
            continue
        up = s.upper()
        if up.startswith(("SUC", "RUT", "BOL", "FECHA", "HORA", "CODIGO", "CÓDIGO", "CAJA", "$")):
            continue
        if any(c.isalpha() for c in s):
            return s[:40]
    return _first_line(text)


def _parse_amount(text: str) -> Optional[float]:
    """Prefiere el TOTAL de la boleta (no el precio de un ítem)."""
    txt = text or ""
    cands = []
    # Montos que vienen tras una etiqueta "total" (excluyendo subtotal/iva/etc.)
    for m in re.finditer(r"(total[^\n$]{0,22}?)\$?\s*([\d][\d.\,]{2,})", txt, re.IGNORECASE):
        label = m.group(1).lower()
        if any(x in label for x in ("subtotal", "iva", "numero", "número", "acumulado", "exento", "artic")):
            continue
        v = _to_number(m.group(2))
        if v:
            cands.append(v)
    if cands:
        return max(cands)
    # Respaldo: el mayor monto con signo $ del documento.
    alls = [_to_number(x) for x in re.findall(r"\$\s*([\d][\d.\,]{2,})", txt)]
    alls = [a for a in alls if a]
    if alls:
        return max(alls)
    # Último respaldo: regex original.
    m = _AMOUNT_RE.search(txt)
    return _to_number(m.group(1)) if m else None


def _extract_shopping_items(text: str) -> list[str]:
    """Extrae nombres de productos desde una lista pegada (líneas, comas, viñetas)."""
    raw = (text or "")
    # separar por saltos de línea y comas
    parts: list[str] = []
    for line in raw.splitlines():
        for piece in line.split(","):
            parts.append(piece)
    items: list[str] = []
    seen = set()
    for p in parts:
        s = p.strip(" \t-•*–·:0123456789.)#")
        # descartar encabezados/ruido
        low = s.lower()
        if len(s) < 2 or len(s) > 40:
            continue
        if low in ("lista", "compras", "lista de compras", "supermercado", "comprar", "feria"):
            continue
        if s and low not in seen:
            seen.add(low)
            items.append(s[:40].capitalize())
        if len(items) >= 20:
            break
    return items


def _first_line(text: str) -> str:
    for ln in (text or "").splitlines():
        s = ln.strip()
        if len(s) >= 3:
            return s[:80]
    return (text or "").strip()[:80]


def _classify(text: str, filename: str) -> dict:
    low = (text or "").lower()
    best, best_score = None, 0
    for rule in _RULES:
        score = sum(1 for kw in rule["keywords"] if kw in low)
        if score > best_score:
            best, best_score = rule, score

    if not best or best_score == 0:
        return {
            "route_type": "general_archive",
            "suggested_category": "document",
            "title": _first_line(text) or os.path.basename(filename or "Documento"),
            "summary": "No se reconoció un tipo claro. Quedará archivado para revisión manual.",
            "confidence": 0.3 if text else 0.1,
            "requires_confirmation": True,
            "proposed_payload": {"title": _first_line(text) or os.path.basename(filename or "Documento")},
        }

    confidence = min(0.5 + 0.1 * best_score, 0.9)
    route = best["route_type"]
    payload: dict = {}
    title = ""
    summary = ""

    if route == "shopping_list_to_items":
        prod = _extract_shopping_items(text)
        title = f"{len(prod)} productos para la lista de compras" if prod else "Lista de compras detectada"
        summary = ("Detecté una lista de compras. Confirmá los productos y los agrego a Compras."
                   if prod else "Parece una lista de compras, pero no reconocí productos claros.")
        payload = {"items": prod, "category": "grocery", "store_type": "supermarket"}
        confidence = min(0.5 + 0.06 * len(prod), 0.9)
    elif route == "prescription_to_medication":
        mm = _MED_RE.search(text or "")
        med = (f"{mm.group(1).capitalize()} {mm.group(2)}{mm.group(3).lower()}"
               if mm else "Medicamento detectado")
        title = f"{med} — detectado en receta (pendiente confirmar)"
        summary = "Posible medicamento en una receta. Confirmá nombre y dosis antes de activar recordatorios."
        payload = {"med_title": med, "category": "medication"}
    elif route == "receipt_to_finance":
        amount = _parse_amount(text)
        merchant = _detect_merchant(text)
        title = f"Gasto: {merchant}" if merchant else "Gasto detectado"
        summary = ("Boleta/factura detectada." if amount
                   else "Boleta detectada, pero no se reconoció el monto — completalo a mano.")
        payload = {"amount": amount, "currency": "CLP", "category": "groceries", "merchant": merchant}
    elif route == "school_notice_to_study":
        title = f"Estudio: {_first_line(text)}" if text else "Compromiso de estudio"
        summary = "Aviso/circular con una evaluación o entrega. Confirmá integrante y fecha."
        d = _DATE_RE.search(text or "")
        payload = {"title": title, "category": "study", "due_date": d.group(1) if d else None}
    elif route == "doctor_document_to_health":
        title = f"Documento de salud: {_first_line(text)}" if text else "Documento de salud"
        summary = "Documento médico. Se guarda como evidencia/memoria de salud (sin diagnóstico automático)."
        payload = {"title": title, "kind": "evidence"}
    elif route in ("insurance_policy_to_document", "bill_to_finance_or_deadline"):
        d = _DATE_RE.search(text or "")
        title = f"Vencimiento: {_first_line(text)}" if text else "Documento con vencimiento"
        summary = "Documento con posible vencimiento. Confirmá la fecha."
        payload = {"title": title, "category": "document_deadline", "due_date": d.group(1) if d else None}

    return {
        "route_type": route,
        "suggested_category": best["suggested_category"],
        "title": title,
        "summary": summary,
        "confidence": confidence,
        "requires_confirmation": best["requires_confirmation"],
        "proposed_payload": payload,
    }


def _row_to_dict(row) -> dict:
    d = dict(row)
    try:
        d["proposed_payload"] = json.loads(d.get("proposed_payload") or "{}")
    except (TypeError, ValueError):
        d["proposed_payload"] = {}
    return d


def _current_person_id(db, user_id: str, household_id: str) -> Optional[str]:
    try:
        r = db.execute(
            "SELECT id FROM persons WHERE household_id=? AND user_id=?",
            (household_id, user_id),
        ).fetchone()
        return r["id"] if r else None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.post("/analyze")
async def analyze_document(
    household_id: str = Form(...),
    person_id: Optional[str] = Form(None),
    pasted_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Sube/pega un documento, lo clasifica y crea un DocumentRouteCandidate."""
    require_household_role(db, user["user_id"], household_id, "member")

    source = "pasted_text"
    text = (pasted_text or "").strip()
    pending_image = False
    if file is not None:
        data = await file.read()
        if len(data) > _MAX_BYTES:
            raise HTTPException(status_code=413, detail="Archivo demasiado grande (máx 10 MB)")
        source = f"upload:{file.filename}"
        extracted = _extract_text(file.filename or "", data)
        if extracted:
            text = extracted
        elif not text:
            # Imagen/otro sin OCR: queda pendiente de revisión manual.
            pending_image = True
    if not text and not pending_image:
        raise HTTPException(status_code=400, detail="No hay texto para analizar (pegá texto o subí un PDF)")

    if pending_image:
        result = {
            "route_type": "general_archive",
            "suggested_category": "document",
            "title": (file.filename if file else "Documento"),
            "summary": "Imagen recibida. La lectura automática de fotos llegará más adelante; por ahora queda para revisión manual.",
            "confidence": 0.1,
            "requires_confirmation": True,
            "proposed_payload": {"title": (file.filename if file else "Documento"), "pending_manual_review": True},
        }
    else:
        result = _classify(text, file.filename if file else "")

    organization_id = get_household_organization_id(db, household_id)
    cid = str(uuid.uuid4())
    db.execute(
        "INSERT INTO document_route_candidates ("
        "id, household_id, organization_id, source_document_id, person_id, route_type, "
        "suggested_category, title, summary, extracted_text_preview, confidence, "
        "requires_confirmation, status, proposed_payload, created_by_ai, created_by_user_id, created_at"
        ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            cid, household_id, organization_id, source, person_id, result["route_type"],
            result["suggested_category"], result["title"], result["summary"],
            (text or "")[:_PREVIEW_LEN], result["confidence"],
            1 if result["requires_confirmation"] else 0, "pending",
            json.dumps(result["proposed_payload"], ensure_ascii=False),
            0, user["user_id"], _now(),
        ),
    )
    db.commit()
    row = db.execute("SELECT * FROM document_route_candidates WHERE id=?", (cid,)).fetchone()
    return _row_to_dict(row)


@router.get("/candidates")
def list_candidates(
    household_id: str,
    status: str = "pending",
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Lista candidatos. Scoping: owner/admin ven todos; un integrante (member)
    ve los no asignados o los de su propia persona."""
    role = require_household_role(db, user["user_id"], household_id, "viewer")
    rows = db.execute(
        "SELECT * FROM document_route_candidates WHERE household_id=? AND status=? "
        "ORDER BY created_at DESC LIMIT 200",
        (household_id, status),
    ).fetchall()
    items = [_row_to_dict(r) for r in rows]
    if role not in ("owner", "admin"):
        my_pid = _current_person_id(db, user["user_id"], household_id)
        items = [c for c in items if not c.get("person_id") or c.get("person_id") == my_pid]
    return {"items": items}


class ConfirmBody(BaseModel):
    overrides: dict = {}


@router.post("/candidates/{candidate_id}/confirm")
def confirm_candidate(
    candidate_id: str,
    body: ConfirmBody,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Confirma un candidato y crea el destino correspondiente."""
    row = db.execute("SELECT * FROM document_route_candidates WHERE id=?", (candidate_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Candidato no encontrado")
    cand = _row_to_dict(row)
    require_household_role(db, user["user_id"], cand["household_id"], "member")
    if cand["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"El candidato ya está {cand['status']}")

    hid = cand["household_id"]
    org = cand["organization_id"]
    pid = cand.get("person_id")
    payload = {**cand.get("proposed_payload", {}), **(body.overrides or {})}
    route = cand["route_type"]
    result_type = None
    result_id = None

    if route == "shopping_list_to_items":
        items = payload.get("items") or []
        if not items:
            raise HTTPException(status_code=400, detail="No hay productos para agregar a la lista")
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
                (iid, hid, org, user["user_id"], pid, None, str(name), None, None,
                 payload.get("category", "grocery"), "normal", payload.get("store_type", "supermarket"),
                 None, None, "CLP", None, "needed", "Desde Bandeja Inteligente",
                 json.dumps({"from_smart_inbox": True}, ensure_ascii=False), _now(), _now()),
            )
            created.append(iid)
        result_type = "shopping_items"
        result_id = f"{len(created)} items"
    elif route == "prescription_to_medication":
        if not pid:
            raise HTTPException(status_code=400, detail="Asigná un integrante para el medicamento")
        result_id = create_unit_function_internal(
            db, household_id=hid, organization_id=org, person_id=pid,
            category="medication", title=payload.get("med_title", "Medicamento") + " (pendiente confirmar)",
            source_type="prescription", created_by_user_id=user["user_id"], created_by_ai=True,
            ai_needs_confirmation=True, ai_confidence=cand.get("confidence"),
            ai_extraction_source=f"smart_inbox:{cand['source_document_id']}",
            ai_explanation="Detectado por la Bandeja Inteligente desde un documento. Confirmá dosis antes de activar recordatorios.",
            supervision_level="supervised", support_mode="tap", evidence_required=True,
            metadata={"med_name": payload.get("med_title"), "from_smart_inbox": True},
            dual_write_task=False,
        )
        result_type = "unit_function"
    elif route == "school_notice_to_study":
        if not pid:
            raise HTTPException(status_code=400, detail="Asigná un integrante para la función de estudio")
        result_id = create_unit_function_internal(
            db, household_id=hid, organization_id=org, person_id=pid,
            category="study", title=payload.get("title", "Compromiso de estudio"),
            source_type="school_notice", created_by_user_id=user["user_id"],
            due_at=(f"{payload['due_date']}" if payload.get("due_date") else None),
            metadata={"from_smart_inbox": True}, dual_write_task=False,
        )
        result_type = "unit_function"
    elif route in ("insurance_policy_to_document", "bill_to_finance_or_deadline"):
        result_id = create_unit_function_internal(
            db, household_id=hid, organization_id=org, person_id=pid,
            category="document_deadline", title=payload.get("title", "Vencimiento"),
            source_type="uploaded_document", created_by_user_id=user["user_id"],
            due_at=(f"{payload['due_date']}" if payload.get("due_date") else None),
            metadata={"from_smart_inbox": True}, dual_write_task=False,
        )
        result_type = "unit_function"
    elif route == "receipt_to_finance":
        amount = payload.get("amount")
        if not amount or float(amount) <= 0:
            raise HTTPException(status_code=400, detail="Falta el monto del gasto — completalo")
        eid = str(uuid.uuid4())
        db.execute(
            "INSERT INTO expenses (id,household_id,organization_id,amount,currency,category,merchant,expense_at,notes,person_id,created_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (eid, hid, org, float(amount), payload.get("currency", "CLP"),
             payload.get("category", "groceries"), payload.get("merchant"),
             _now(), "Cargado desde Bandeja Inteligente", pid, _now()),
        )
        result_type = "expense"
        result_id = eid
    elif route == "doctor_document_to_health":
        result_id = log_evidence_internal(
            db, household_id=hid, organization_id=org, evidence_type="document_uploaded",
            created_by_user_id=user["user_id"], person_id=pid,
            text_content=payload.get("title") or cand.get("title"),
            metadata={"from_smart_inbox": True, "route": route},
        )
        result_type = "evidence"
    else:  # general_archive
        result_id = log_evidence_internal(
            db, household_id=hid, organization_id=org, evidence_type="document_uploaded",
            created_by_user_id=user["user_id"], person_id=pid,
            text_content=payload.get("title") or cand.get("title"),
            metadata={"from_smart_inbox": True, "route": "general_archive"},
        )
        result_type = "evidence"

    db.execute(
        "UPDATE document_route_candidates SET status='accepted', confirmed_by_user_id=?, confirmed_at=?, "
        "result_resource_type=?, result_resource_id=?, proposed_payload=? WHERE id=?",
        (user["user_id"], _now(), result_type, result_id, json.dumps(payload, ensure_ascii=False), candidate_id),
    )
    write_audit_log(
        db, action="smart_inbox.confirm", resource_type="document_route_candidate",
        resource_id=candidate_id, household_id=hid, user_id=user["user_id"],
        metadata={"route_type": route, "result_type": result_type, "result_id": result_id},
    )
    db.commit()
    return {"ok": True, "result_type": result_type, "result_id": result_id, "route_type": route}


class RejectBody(BaseModel):
    reason: Optional[str] = None
    keep_as_learning: bool = False


@router.post("/candidates/{candidate_id}/reject")
def reject_candidate(
    candidate_id: str,
    body: RejectBody,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Rechaza un candidato. NO crea acciones. Opcionalmente guarda el rechazo
    como aprendizaje (negative_learning)."""
    row = db.execute("SELECT * FROM document_route_candidates WHERE id=?", (candidate_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Candidato no encontrado")
    cand = _row_to_dict(row)
    require_household_role(db, user["user_id"], cand["household_id"], "member")
    if cand["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"El candidato ya está {cand['status']}")

    if body.keep_as_learning:
        upsert_memory_internal(
            db, household_id=cand["household_id"], organization_id=cand["organization_id"],
            memory_type="negative_learning",
            content=f"Rechazó la propuesta '{cand.get('title')}' ({cand['route_type']}). {body.reason or ''}".strip(),
            created_by_user_id=user["user_id"], person_id=cand.get("person_id"), importance=0.3,
        )
    db.execute(
        "UPDATE document_route_candidates SET status='rejected', confirmed_by_user_id=?, confirmed_at=? WHERE id=?",
        (user["user_id"], _now(), candidate_id),
    )
    write_audit_log(
        db, action="smart_inbox.reject", resource_type="document_route_candidate",
        resource_id=candidate_id, household_id=cand["household_id"], user_id=user["user_id"],
        metadata={"route_type": cand["route_type"], "reason": body.reason},
    )
    db.commit()
    return {"ok": True, "status": "rejected"}
