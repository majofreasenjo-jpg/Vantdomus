import re
import os
import shutil
import subprocess
import tempfile
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree

import fitz
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from ..audit import write_audit_log
from ..deps import get_current_user, get_db, require_household_role
from ..tenancy import get_household_organization_id
from .logbook import _copy_upload_with_limit, _private_upload_root, _safe_filename

router = APIRouter()


def now():
    return datetime.now(timezone.utc).isoformat()


def _allowed_extensions() -> set[str]:
    return {".pdf", ".txt", ".csv", ".docx", ".xlsx", ".xls", ".pptx", ".png", ".jpg", ".jpeg", ".tif", ".tiff"}


def _validate_file(file: UploadFile) -> None:
    extension = Path(file.filename or "").suffix.lower()
    if extension not in _allowed_extensions():
        raise HTTPException(status_code=400, detail=f"Tipo de archivo no soportado para analisis forense: {extension or 'sin extension'}")


def _clean_text(text: str, limit: int = 24000) -> str:
    normalized = re.sub(r"\s+", " ", text or "").strip()
    return normalized[:limit]


def _tesseract_cmd() -> str | None:
    configured = os.getenv("VANTDOMUS_TESSERACT_CMD") if "os" in globals() else None
    if configured and Path(configured).exists():
        return configured
    standard = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
    if standard.exists():
        return str(standard)
    return shutil.which("tesseract")


def _tessdata_dir() -> str | None:
    configured = os.getenv("VANTDOMUS_TESSDATA_DIR", r"C:\tmp\vantdomus_tessdata")
    path = Path(configured)
    if path.exists():
        return str(path)
    return None


def _ocr_image_file(path: Path, language: str = "spa+eng") -> str:
    cmd = _tesseract_cmd()
    if not cmd:
        return ""
    try:
        args = [cmd, str(path), "stdout", "-l", language, "--psm", "6"]
        tessdata = _tessdata_dir()
        if tessdata:
            args.extend(["--tessdata-dir", tessdata])
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=45,
            check=False,
        )
        if result.returncode == 0:
            return result.stdout
    except Exception:
        return ""
    return ""


def _ocr_pdf(path: Path, max_pages: int = 8) -> str:
    chunks: list[str] = []
    cmd = _tesseract_cmd()
    if not cmd:
        return ""
    with fitz.open(path) as doc, tempfile.TemporaryDirectory() as tmpdir:
        for idx, page in enumerate(doc[:max_pages]):
            pix = page.get_pixmap(dpi=220, alpha=False)
            img_path = Path(tmpdir) / f"page_{idx + 1}.png"
            pix.save(img_path)
            chunks.append(_ocr_image_file(img_path))
    return _clean_text(" ".join(chunks))


def _extract_pdf(path: Path) -> tuple[str, dict]:
    chunks: list[str] = []
    with fitz.open(path) as doc:
        for page in doc[:12]:
            chunks.append(page.get_text("text"))
    native = _clean_text(" ".join(chunks))
    if len(native) >= 400:
        return native, {"method": "pdf_text_layer", "ocr_used": False, "ocr_status": "no_requerido"}
    ocr = _ocr_pdf(path)
    if ocr:
        return ocr, {"method": "pdf_ocr", "ocr_used": True, "ocr_status": "ocr_ok"}
    return native, {
        "method": "pdf_text_layer_insufficient",
        "ocr_used": False,
        "ocr_status": "ocr_no_disponible_instalar_tesseract",
    }


def _extract_txt(path: Path) -> tuple[str, dict]:
    for encoding in ("utf-8", "latin-1"):
        try:
            return _clean_text(path.read_text(encoding=encoding)), {"method": "text", "ocr_used": False, "ocr_status": "no_requerido"}
        except UnicodeDecodeError:
            continue
    return "", {"method": "text_error", "ocr_used": False, "ocr_status": "no_requerido"}


def _xml_text(xml_bytes: bytes) -> str:
    root = ElementTree.fromstring(xml_bytes)
    values: list[str] = []
    for node in root.iter():
        if node.text:
            values.append(node.text)
    return " ".join(values)


def _extract_docx(path: Path) -> tuple[str, dict]:
    with zipfile.ZipFile(path) as archive:
        names = [name for name in archive.namelist() if name.startswith("word/") and name.endswith(".xml")]
        chunks = [_xml_text(archive.read(name)) for name in names[:10]]
    return _clean_text(" ".join(chunks)), {"method": "docx_xml", "ocr_used": False, "ocr_status": "no_requerido"}


def _extract_xlsx(path: Path) -> tuple[str, dict]:
    with zipfile.ZipFile(path) as archive:
        names = [name for name in archive.namelist() if name.startswith("xl/worksheets/") and name.endswith(".xml")]
        if "xl/sharedStrings.xml" in archive.namelist():
            shared = _xml_text(archive.read("xl/sharedStrings.xml"))
        else:
            shared = ""
        sheets = [_xml_text(archive.read(name)) for name in names[:8]]
    return _clean_text(" ".join([shared, *sheets])), {"method": "xlsx_xml", "ocr_used": False, "ocr_status": "no_requerido"}


def _extract_pptx(path: Path) -> tuple[str, dict]:
    with zipfile.ZipFile(path) as archive:
        names = [name for name in archive.namelist() if name.startswith("ppt/slides/") and name.endswith(".xml")]
        chunks = [_xml_text(archive.read(name)) for name in names[:40]]
    return _clean_text(" ".join(chunks)), {"method": "pptx_xml", "ocr_used": False, "ocr_status": "no_requerido"}


def _extract_image(path: Path) -> tuple[str, dict]:
    text = _ocr_image_file(path)
    if text:
        return _clean_text(text), {"method": "image_ocr", "ocr_used": True, "ocr_status": "ocr_ok"}
    return "", {"method": "image_ocr_unavailable", "ocr_used": False, "ocr_status": "ocr_no_disponible_instalar_tesseract"}


def _extract_text(path: Path) -> tuple[str, dict]:
    suffix = path.suffix.lower()
    try:
        if suffix == ".pdf":
            return _extract_pdf(path)
        if suffix in {".txt", ".csv"}:
            return _extract_txt(path)
        if suffix == ".docx":
            return _extract_docx(path)
        if suffix in {".xlsx", ".xls"}:
            if suffix == ".xls":
                return "", {"method": "xls_legacy_no_soportado", "ocr_used": False, "ocr_status": "no_requerido"}
            return _extract_xlsx(path)
        if suffix == ".pptx":
            return _extract_pptx(path)
        if suffix in {".png", ".jpg", ".jpeg", ".tif", ".tiff"}:
            return _extract_image(path)
    except Exception:
        return "", {"method": "extract_error", "ocr_used": False, "ocr_status": "error_extraccion"}
    return "", {"method": "unsupported", "ocr_used": False, "ocr_status": "no_requerido"}


def _find_terms(text: str, terms: list[str]) -> list[str]:
    lower = text.lower()
    return [term for term in terms if term.lower() in lower]


def _build_report(filename: str, purpose: str, text: str, extraction: dict, client_name: str = "Cliente") -> dict:
    claim_terms = _find_terms(text, ["NOC", "improductividad", "adicional", "atraso", "interferencia", "controversia", "claim", "stand-by", "lucro cesante", "sobreestadía"])
    tender_terms = _find_terms(text, ["licitacion", "oferta", "adjudicacion", "contrato", "APU", "ECO", "bases tecnicas", "gastos generales", "IFC", "rev_", "memoria de calculo"])
    hse_terms = _find_terms(text, ["HSE", "derrame", "incidente", "seguridad", "fatiga", "near miss", "ambiental"])
    delta_terms = _find_terms(text, ["delta", "licitacion vs", "proyecto", "IFC", "cambio revision", "inyeccion", "no existe"])
    finance_terms = _find_terms(text, ["reajustabilidad", "IPC", "multas", "garantia", "retencion", "estado de pago", "burn rate", "gastos generales", "umbral", "25%", "UF", "precio fijo"])
    redline_terms = _find_terms(text, ["prevalecera", "primacia", "orden de cambio", "libro de obra", "caducidad", "suspension", "limite", "cap"])
    dates = sorted(set(re.findall(r"\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b", text)))[:12]
    amounts = sorted(set(re.findall(r"(?:M\$|\$|UF)\s?[\d\.\,]+", text)))[:12]

    classification = "Documento contractual / evidencia general"
    if tender_terms:
        classification = "Licitacion / contrato / oferta economica"
    if claim_terms:
        classification = "Evidencia de claim / controversia"
    if hse_terms and not claim_terms:
        classification = "Evidencia HSE / cumplimiento"
    if delta_terms and tender_terms:
        classification = "Visor Delta: Licitacion vs Proyecto / Cambio de alcance"
    if finance_terms and tender_terms:
        classification = "Auditoria financiera contractual / Stress Test"

    findings = []
    if tender_terms:
        findings.append("Contiene referencias de licitacion/contrato/oferta que deben cruzarse contra alcance, APU/ECO, HH, maquinaria y gastos generales.")
    if claim_terms:
        findings.append("Contiene posibles gatillantes de claim o controversia: revisar linea de tiempo, causalidad, impacto y respaldo documental.")
    if hse_terms:
        findings.append("Contiene elementos HSE: validar fecha, responsable, evidencia privada, medidas correctivas y relacion con continuidad operacional.")
    if delta_terms:
        findings.append("Presenta indicios tipo Visor Delta: comparar estado de licitacion contra estado proyecto/IFC para detectar cambio de revision, inyeccion documental o aumento de alcance.")
    if finance_terms:
        findings.append("Presenta gatillantes de auditoria financiera: revisar reajustabilidad, multas, garantias, retenciones, gastos generales, forma de pago y exposicion de caja.")
    if redline_terms:
        findings.append("Contiene materia apta para red-lining contractual: requiere propuesta de clausulas de primacia, limite de multas, orden de cambio y proteccion de gastos generales.")
    if amounts:
        findings.append("Incluye montos: deben compararse contra presupuesto, oferta economica y desviaciones registradas en finanzas.")
    if dates:
        findings.append("Incluye fechas: deben incorporarse al timeline probatorio y a la matriz de evidencia.")
    if not findings:
        findings.append("No se detectaron terminos criticos en la extraccion inicial; requiere revision manual o documento con OCR si es escaneado.")

    missing = [
        "Contrato/base contractual asociada.",
        "Fecha de ocurrencia y fecha de comunicacion formal.",
        "Responsable interno y contraparte cliente.",
        "Impacto cuantificado en HH, plazo, costo o productividad.",
        "Documento fuente que respalde cada afirmacion.",
        "Matriz de cruce Licitacion vs Proyecto/Contrato cuando exista cambio de alcance.",
        "Modelo financiero de stress test si hay impacto en GG, multas, IPC, plazo o burn rate.",
    ]

    extract_preview = text[:1200] if text else "Sin texto extraible. Si es escaneado, requiere OCR activo."
    report = "\n".join([
        "VANTDOMUS | INTELIGENCIA FORENSE",
        f"DOSSIER MAESTRO: AUDITORIA FORENSE {client_name or 'CLIENTE'}",
        "ANEXO PERICIAL DOCUMENTAL Y FINANCIERO",
        "",
        f"Archivo: {filename}",
        f"Objetivo declarado: {purpose or 'Analisis forense documental'}",
        f"Metodo de lectura: {extraction.get('method')} | OCR: {extraction.get('ocr_status')}",
        f"Clasificacion inicial: {classification}",
        "",
        "1. RESUMEN EJECUTIVO",
        f"El presente dossier convierte el documento cargado en una pieza de evidencia auditable para {client_name or 'el cliente'}. El analisis sigue la linea usada en entregables NOC, Visor Delta, Matriz de Evidencia y Auditoria Financiera: identificar naturaleza documental, riesgo contractual, efecto economico y trazabilidad probatoria.",
        "",
        "2. TRAZABILIDAD Y METODO DE LECTURA",
        f"- Archivo fuente preservado en repositorio privado VantDomus: {filename}",
        f"- Metodo de extraccion: {extraction.get('method')}",
        f"- Estado OCR: {extraction.get('ocr_status')}",
        f"- Caracteres extraidos para analisis: {len(text)}",
        "",
        "3. PILAR DOCUMENTAL: MATRIZ DE EVIDENCIA",
        "- El documento debe quedar enlazado a su fuente original, fecha, revision, carpeta de origen, responsable y modulo VantDomus asociado.",
        "- Si pertenece a licitacion/proyecto, debe incorporarse a una matriz tipo: DOCUMENTO/FAMILIA | ESTADO LICITACION | ESTADO PROYECTO/CONTRATO | DIAGNOSTICO PERICIAL.",
        "",
        "4. HALLAZGOS PERICIALES INICIALES",
        *[f"- {item}" for item in findings],
        "",
        "5. MATRIZ DE INDICIOS DETECTADOS",
        f"- Terminos claim: {', '.join(claim_terms) if claim_terms else 'No detectados'}",
        f"- Terminos licitacion/contrato: {', '.join(tender_terms) if tender_terms else 'No detectados'}",
        f"- Terminos HSE: {', '.join(hse_terms) if hse_terms else 'No detectados'}",
        f"- Terminos Visor Delta: {', '.join(delta_terms) if delta_terms else 'No detectados'}",
        f"- Terminos financieros/stress test: {', '.join(finance_terms) if finance_terms else 'No detectados'}",
        f"- Terminos red-lining: {', '.join(redline_terms) if redline_terms else 'No detectados'}",
        f"- Fechas: {', '.join(dates) if dates else 'No detectadas'}",
        f"- Montos: {', '.join(amounts) if amounts else 'No detectados'}",
        "",
        "6. PILAR CONTRACTUAL: RIESGOS Y CONTRADICCIONES",
        "- Revisar primacia documental entre contrato, Bases Tecnicas, Terminos Comerciales, Oferta Tecnica y Oferta Economica.",
        "- Levantar contradicciones sobre reajustabilidad, multas, garantias, forma de pago, suspension, alcance marginal y caducidades procedimentales.",
        "",
        "7. PILAR FINANCIERO: STRESS TEST Y EXPOSICION",
        "- Si existen montos, plazos, multas, GG, IPC o HH, el documento debe entrar a simulacion de stress financiero.",
        "- Drivers minimos: impacto por gastos generales, burn rate por paralizacion, multas UF/dia, retenciones, garantias, maquinaria, HH directas e indirectas.",
        "",
        "8. DIAGNOSTICO PERICIAL PRELIMINAR",
        f"- Clasificacion: {classification}",
        "- Hipotesis de trabajo: contrastar documento fuente contra contrato, oferta economica, bases tecnicas, proyecto IFC, NOC y matriz de evidencia.",
        "- Riesgo probatorio: todo hallazgo debe quedar vinculado a fecha, archivo fuente, responsable y efecto cuantificable.",
        "",
        "9. EVIDENCIA FALTANTE A SOLICITAR",
        *[f"- {item}" for item in missing],
        "",
        "10. PLIEGO DE RED-LINING / ACCIONES DE BLINDAJE",
        "- Definir clausula de primacia documental a favor de la oferta del cliente si hay contradiccion.",
        "- Definir limite acumulado de multas, retenciones y deducciones.",
        "- Definir pago proporcional de GG/utilidades ante aumento de alcance o extension de plazo.",
        "- Definir titulo operativo para ejecutar y cobrar obras extraordinarias sin caducidad por formalismo documental.",
        "",
        "11. DICTAMEN TECNICO PRELIMINAR",
        "- El documento queda incorporado como pieza de evidencia inicial. Su fuerza probatoria dependera del cruce con matriz documental, timeline, contrato y respaldo economico.",
        "- Si se detecta diferencia Licitacion vs Proyecto, debe abrirse ficha Visor Delta con: documento/familia, estado licitacion, estado proyecto IFC y diagnostico pericial.",
        "- Si se detecta claim o NOC, debe abrirse trazabilidad de causalidad: evento, impacto, fecha, costo/HH/plazo y soporte fuente.",
        "",
        "12. EXTRACTO VERIFICABLE",
        extract_preview,
    ])

    return {
        "classification": classification,
        "findings": findings,
        "dates": dates,
        "amounts": amounts,
        "report": report,
        "extracted_chars": len(text),
        "extraction": extraction,
    }


def _contract_doc_type(filename: str, text: str) -> str:
    name = (filename or "").lower()
    lower = (text or "").lower()
    if "terminos comerciales" in name or "terminos comerciales" in lower:
        return "Terminos comerciales"
    if "contrato" in name or "contrato" in lower:
        return "Contrato / borrador contractual"
    if "bbtt" in name or "bases tecnicas" in lower or "base tecnica" in lower:
        return "Bases tecnicas / alcance"
    if "eco" in name or "apu" in lower or "precio unitario" in lower:
        return "Oferta economica / APU / ECO"
    if "adjudicacion" in name or "carta de oferta" in name:
        return "Oferta / adjudicacion"
    return "Documento de respaldo"


def _contract_snippet(text: str, terms: list[str], radius: int = 180) -> str:
    lower = (text or "").lower()
    for term in terms:
        idx = lower.find(term.lower())
        if idx >= 0:
            start = max(0, idx - radius)
            end = min(len(text), idx + len(term) + radius)
            return _clean_text(text[start:end], 420)
    return ""


def _contract_sources(documents: list[dict], terms: list[str]) -> tuple[str, str]:
    hits = []
    evidence = ""
    for doc in documents:
        text = doc.get("text", "")
        lower = text.lower()
        if any(term.lower() in lower for term in terms):
            hits.append(doc["filename"])
            if not evidence:
                evidence = _contract_snippet(text, terms)
    return ", ".join(hits[:4]) or "Paquete documental", evidence


def _build_contractual_analysis(client_name: str, purpose: str, documents: list[dict]) -> dict:
    corpus = "\n".join(doc.get("text", "") for doc in documents)
    lower = corpus.lower()
    findings: list[dict] = []

    def has(*terms: str) -> bool:
        return any(term.lower() in lower for term in terms)

    def add(topic: str, severity: str, terms: list[str], finding: str, impact: str, recommendation: str, suggested_clause: str = "") -> None:
        source, evidence = _contract_sources(documents, terms)
        findings.append({
            "topic": topic,
            "severity": severity,
            "source": source,
            "evidence": evidence,
            "finding": finding,
            "impact": impact,
            "recommendation": recommendation,
            "suggested_clause": suggested_clause,
        })

    if has("gastos generales", "gasto general"):
        threshold_terms = ["10%", "15%", "gastos generales", "mayores gastos generales"]
        severity = "Alta" if has("10%") and has("15%") else "Media"
        add(
            "Gastos generales y umbrales de cobro",
            severity,
            threshold_terms,
            "El paquete contiene referencias a gastos generales y posibles umbrales o condiciones para su reconocimiento.",
            "Riesgo de que aumentos de alcance, plazo u obras similares no habiliten cobros suficientes por GG si el contrato deja el umbral o procedimiento ambiguo.",
            "Alinear contrato, oferta y terminos comerciales con un umbral unico, gatillantes verificables y formula de pago proporcional por plazo, alcance y recursos.",
            "Toda extension de plazo, aumento de alcance, interferencia o instruccion del mandante que incremente recursos dara derecho al reconocimiento proporcional de gastos generales y costos indirectos, sin perjuicio de los precios unitarios aplicables.",
        )

    if has("precio fijo", "no reajust", "sin reajust", "renuncia"):
        add(
            "Precio fijo, reajustabilidad y renuncias",
            "Alta",
            ["precio fijo", "no reajust", "sin reajust", "renuncia"],
            "Se detectan condiciones que podrian restringir reajustes, mayores costos o reservas de derecho.",
            "Puede bloquear recuperacion por inflacion, variacion de insumos, alzas de HH/equipos o mayores permanencias.",
            "Reservar expresamente derechos por cambios de alcance, extraordinarios, suspensiones, interferencias y hechos no imputables al contratista.",
            "La condicion de precio no impedira reconocer variaciones derivadas de cambios de alcance, obras extraordinarias, suspensiones, interferencias, hechos del mandante o modificaciones normativas.",
        )

    if has("orden de cambio", "ordenes de cambio", "libro de obra", "instruccion", "instrucción"):
        add(
            "Procedimiento de orden de cambio",
            "Alta",
            ["orden de cambio", "libro de obra", "instruccion", "instrucción"],
            "El paquete menciona mecanismos formales para cambios o instrucciones.",
            "Si el procedimiento es rigido, una instruccion operativa podria ejecutarse sin titulo suficiente para cobrar.",
            "Definir que instrucciones escritas, libro de obra, correos o actas permitan iniciar respaldo, valorizacion y reserva de derechos.",
            "Las instrucciones documentadas por libro de obra, correo, acta o plataforma del mandante constituiran respaldo suficiente para activar reserva de derechos y valorizacion provisoria mientras se formaliza la orden de cambio.",
        )

    if has("obra extraordinaria", "obras extraordinarias", "obras similares", "similar al encargo", "precios unitarios"):
        add(
            "Obras similares y extraordinarias",
            "Alta",
            ["obra extraordinaria", "obras extraordinarias", "obras similares", "similar al encargo", "precios unitarios"],
            "Existen referencias a obras similares, extraordinarias o valorizacion por precios unitarios.",
            "Riesgo de que trabajos fuera del alcance original se paguen como similares sin reconocer GG, HH indirectas, maquinaria, plazo o improductividad.",
            "Separar obra similar de obra extraordinaria y exigir analisis de impacto integral cuando el nuevo encargo altere secuencia, recursos o plazo.",
            "Una obra se considerara extraordinaria cuando modifique alcance, secuencia, permanencia, recursos o condiciones de ejecucion, aun cuando exista precio unitario referencial.",
        )

    if has("suspension", "paralizacion", "interferencia", "fuerza mayor", "caso fortuito"):
        add(
            "Suspensiones, interferencias y fuerza mayor",
            "Media",
            ["suspension", "paralizacion", "interferencia", "fuerza mayor", "caso fortuito"],
            "Se detectan materias de suspension, interferencia o eventos no imputables.",
            "Puede existir costo por stand-by, extension de plazo, improductividad y disponibilidad de equipos/personas.",
            "Incorporar formula de reconocimiento diario y obligacion de registrar evento, duracion, recursos afectados y causalidad.",
            "Las suspensiones o interferencias no imputables al contratista daran derecho a plazo, costos directos, indirectos y gastos generales debidamente trazados.",
        )

    if has("multa", "multas", "uf/dia", "retencion", "garantia", "boleta"):
        add(
            "Multas, retenciones y garantias",
            "Media",
            ["multa", "multas", "uf/dia", "retencion", "garantia", "boleta"],
            "El paquete contiene elementos de penalidades, retenciones o garantias.",
            "Riesgo de exposicion acumulada sin cap claro o con gatillantes no conectados a responsabilidad real.",
            "Exigir cap acumulado, debido proceso, exclusiones por causas del mandante y prohibicion de doble sancion.",
            "Las multas tendran limite acumulado, requeriran aviso y plazo de subsanacion, y no aplicaran respecto de atrasos causados por el mandante, terceros o eventos no imputables.",
        )

    if has("reembolsable", "reembolsables", "estado de pago", "facturacion", "facturación"):
        add(
            "Reembolsables, estados de pago y caja",
            "Media",
            ["reembolsable", "reembolsables", "estado de pago", "facturacion", "facturación"],
            "Se detectan materias de pago, reembolso o facturacion.",
            "Riesgo de tension de caja si los respaldos, plazos o aprobaciones quedan abiertos.",
            "Definir documentos suficientes, SLA de aprobacion y silencio positivo o instancia de escalamiento.",
            "Los respaldos cargados en plataforma y no observados dentro del plazo pactado se entenderan aceptados para efectos de pago o escalamiento formal.",
        )

    if has("termino anticipado", "término anticipado", "terminacion anticipada", "terminación anticipada"):
        add(
            "Termino anticipado",
            "Media",
            ["termino anticipado", "término anticipado", "terminacion anticipada", "terminación anticipada"],
            "Se detectan condiciones de termino anticipado.",
            "Puede dejar costos hundidos, desmovilizacion, compromisos con terceros y utilidad esperada sin cobertura.",
            "Incluir pago de trabajos ejecutados, costos comprometidos, desmovilizacion, GG y utilidad razonable.",
            "El termino anticipado obligara al pago de trabajos ejecutados, costos comprometidos, desmovilizacion, gastos generales devengados y utilidad proporcional.",
        )

    if not findings:
        add(
            "Lectura contractual inicial",
            "Media",
            ["contrato", "oferta", "licitacion", "licitación"],
            "No se detectaron gatillantes contractuales suficientes en el texto extraido.",
            "Puede tratarse de documentos escaneados, imagenes sin OCR o archivos que requieren revision manual.",
            "Verificar OCR, cargar contrato, oferta, terminos comerciales, BBTT y ECO/APU para generar dictamen completo.",
            "",
        )

    high = sum(1 for item in findings if item["severity"] == "Alta")
    medium = sum(1 for item in findings if item["severity"] == "Media")
    risk_score = min(100, 30 + high * 16 + medium * 8)
    reviewed_documents = [
        {
            "filename": doc["filename"],
            "document_type": _contract_doc_type(doc["filename"], doc.get("text", "")),
            "extracted_chars": len(doc.get("text", "")),
            "method": doc.get("extraction", {}).get("method"),
            "ocr_status": doc.get("extraction", {}).get("ocr_status"),
        }
        for doc in documents
    ]
    executive_summary = [
        f"Cliente/paquete: {client_name or 'Cliente'}; objetivo: {purpose or 'revision contractual y comercial'}.",
        f"Documentos procesados: {len(documents)}; hallazgos: {len(findings)}; riesgo contractual estimado: {risk_score}/100.",
        "El motor cruza contrato, terminos comerciales, bases tecnicas, oferta/ECO/APU y evidencia para detectar restricciones de cobro, cambio de alcance, obras extraordinarias y exposicion financiera.",
        "La recomendacion es cerrar contradicciones antes de enviar o aceptar versiones contractuales y dejar toda evidencia con fuente, fecha, revision y responsable.",
    ]
    checklist = [
        "Confirmar carta de confidencialidad perpetua antes de recibir documentos sensibles.",
        "Cruzar contrato vs terminos comerciales vs oferta vs BBTT vs ECO/APU.",
        "Normalizar umbrales de gastos generales, obras similares y extraordinarias.",
        "Agregar redacciones de reserva de derechos para cambios, suspensiones e interferencias.",
        "Cuantificar impacto en HH, maquinaria, plazo, GG, caja, multas y garantias.",
        "Preparar matriz de riesgos con evidencia, clausula fuente, impacto y texto propuesto.",
        "Emitir informe ejecutivo y anexo tecnico con trazabilidad documental.",
    ]
    email_brief = "\n".join([
        f"Estimados, junto con saludar, informamos que VantDomus proceso el paquete documental de {client_name or 'cliente'} para {purpose or 'revision contractual y comercial'}.",
        f"Resultado preliminar: riesgo {risk_score}/100, {len(findings)} hallazgos y {len(documents)} documentos leidos.",
        "Los focos principales deben revisarse en la matriz: gastos generales, obras extraordinarias/similares, ordenes de cambio, reajustabilidad, multas, suspensiones e impacto de caja.",
        "Quedamos atentos para emitir informe final con redacciones contractuales y cuantificacion economica una vez validadas las fuentes.",
    ])
    return {
        "analysis_type": "contractual_commercial_engine",
        "client_name": client_name,
        "purpose": purpose,
        "risk_score": risk_score,
        "executive_summary": executive_summary,
        "reviewed_documents": reviewed_documents,
        "findings": findings,
        "checklist": checklist,
        "email_brief": email_brief,
    }


@router.post("/analyze_document")
def analyze_document(
    household_id: str = Form(...),
    client_name: str = Form("Cliente"),
    purpose: str = Form("Analisis forense documental"),
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_household_role(db, user["user_id"], household_id, "member")
    _validate_file(file)
    organization_id = get_household_organization_id(db, household_id)
    entry_id = str(uuid.uuid4())
    ts = now()

    root = _private_upload_root()
    target_dir = root / (organization_id or "unassigned") / household_id / "forensics"
    target_dir.mkdir(parents=True, exist_ok=True)
    safe_name = _safe_filename(file.filename or "documento")
    path = (target_dir / f"{entry_id}_{safe_name}").resolve()
    if not str(path).startswith(str(root)):
        raise HTTPException(status_code=400, detail="Invalid forensic attachment filename")

    size = _copy_upload_with_limit(
        file,
        path,
        db=db,
        household_id=household_id,
        organization_id=organization_id,
        user_id=user["user_id"],
    )
    extracted, extraction = _extract_text(path)
    report = _build_report(file.filename or safe_name, purpose, extracted, extraction, client_name)

    content = "\n".join([
        f"Analisis forense generado para: {file.filename or safe_name}",
        f"Clasificacion: {report['classification']}",
        f"Objetivo: {purpose}",
        "",
        report["report"],
    ])
    db.execute(
        """
        INSERT INTO logbook_entries (
          id, household_id, organization_id, user_id, entry_type, content, created_at,
          event_date, attachment_url, attachment_name, attachment_path
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            entry_id,
            household_id,
            organization_id,
            user["user_id"],
            "auditoria",
            content,
            ts,
            ts,
            f"/logbook/{entry_id}/attachment",
            file.filename,
            str(path),
        ),
    )
    write_audit_log(
        db,
        action="analyze_forensic_document",
        resource_type="forensic_document",
        household_id=household_id,
        user_id=user["user_id"],
        resource_id=entry_id,
        metadata={
            "filename": file.filename,
            "attachment_size": size,
            "classification": report["classification"],
            "extraction": extraction,
        },
    )
    db.commit()
    return {"id": entry_id, "status": "analyzed", **report}


@router.post("/contractual_analysis")
def contractual_analysis(
    household_id: str = Form(...),
    client_name: str = Form("Cliente"),
    purpose: str = Form("Revision contractual, comercial y forense"),
    files: list[UploadFile] = File(...),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_household_role(db, user["user_id"], household_id, "member")
    if not files:
        raise HTTPException(status_code=400, detail="Debes adjuntar al menos un documento para analizar.")
    if len(files) > 20:
        raise HTTPException(status_code=400, detail="El motor acepta hasta 20 documentos por paquete.")

    organization_id = get_household_organization_id(db, household_id)
    entry_id = str(uuid.uuid4())
    ts = now()
    root = _private_upload_root()
    target_dir = root / (organization_id or "unassigned") / household_id / "forensics" / "contractual"
    target_dir.mkdir(parents=True, exist_ok=True)

    documents: list[dict] = []
    total_size = 0
    for file in files:
        _validate_file(file)
        safe_name = _safe_filename(file.filename or "documento")
        path = (target_dir / f"{entry_id}_{len(documents) + 1:02d}_{safe_name}").resolve()
        if not str(path).startswith(str(root)):
            raise HTTPException(status_code=400, detail="Invalid contractual attachment filename")
        size = _copy_upload_with_limit(
            file,
            path,
            db=db,
            household_id=household_id,
            organization_id=organization_id,
            user_id=user["user_id"],
        )
        extracted, extraction = _extract_text(path)
        total_size += size
        documents.append({
            "filename": file.filename or safe_name,
            "path": str(path),
            "text": extracted,
            "extraction": extraction,
        })

    analysis = _build_contractual_analysis(client_name, purpose, documents)
    content_lines = [
        "VANTDOMUS | MOTOR DE ANALISIS CONTRACTUAL Y COMERCIAL",
        f"Cliente: {client_name}",
        f"Objetivo: {purpose}",
        f"Riesgo estimado: {analysis['risk_score']}/100",
        "",
        "Resumen ejecutivo:",
        *[f"- {item}" for item in analysis["executive_summary"]],
        "",
        "Documentos revisados:",
        *[f"- {item['filename']} | {item['document_type']} | OCR: {item['ocr_status']}" for item in analysis["reviewed_documents"]],
        "",
        "Hallazgos:",
    ]
    for idx, finding in enumerate(analysis["findings"], start=1):
        content_lines.extend([
            f"{idx}. {finding['topic']} [{finding['severity']}]",
            f"   Fuente: {finding['source']}",
            f"   Hallazgo: {finding['finding']}",
            f"   Impacto: {finding['impact']}",
            f"   Recomendacion: {finding['recommendation']}",
            f"   Redaccion sugerida: {finding['suggested_clause'] or 'No aplica'}",
        ])
    content_lines.extend(["", "Checklist:", *[f"- {item}" for item in analysis["checklist"]]])

    db.execute(
        """
        INSERT INTO logbook_entries (
          id, household_id, organization_id, user_id, entry_type, content, created_at,
          event_date, attachment_url, attachment_name, attachment_path
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            entry_id,
            household_id,
            organization_id,
            user["user_id"],
            "auditoria",
            "\n".join(content_lines),
            ts,
            ts,
            None,
            f"Paquete contractual {client_name}",
            str(target_dir),
        ),
    )
    write_audit_log(
        db,
        action="analyze_contractual_package",
        resource_type="contractual_package",
        household_id=household_id,
        user_id=user["user_id"],
        resource_id=entry_id,
        metadata={
            "client_name": client_name,
            "purpose": purpose,
            "files": [doc["filename"] for doc in documents],
            "attachment_size": total_size,
            "risk_score": analysis["risk_score"],
        },
    )
    db.commit()
    return {"id": entry_id, "status": "analyzed", **analysis}
