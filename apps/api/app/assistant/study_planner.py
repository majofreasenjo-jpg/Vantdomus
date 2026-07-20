"""
OPS-1.C — Planificador de estudio de Domi.

Dos vías, misma salida uniforme (lista de pasos {title, due, priority, tags}):

  - IA real disponible → `ai_study_plan`: Domi LEE el aviso/material y arma un
    plan A LA MEDIDA (detecta materias, fechas de evaluación y pasos priorizados,
    considerando fechas solapadas). JSON estricto; cualquier fallo → fallback.
  - IA apagada (o fallo) → `deterministic_steps`: el plan de plantilla
    determinista de siempre (regex de fechas + 5 pasos por evaluación). Gratis,
    sin red.

El usuario SIEMPRE inicia la acción (envía el formulario del planificador); esto
NO es un agente autónomo. La IA solo redacta/estructura el plan que el usuario
pidió; los pasos se materializan como unit_functions/tasks del hogar, visibles y
editables. Sin ejecución oculta.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

MAX_STEPS = 12
MAX_SOURCE_CHARS = 6000
_VALID_PRIORITIES = {"low", "medium", "high"}
_STEP_TAG_WHITELIST = {"diagnostico", "resumen", "practica", "repaso", "evaluacion", "refuerzo", "otro"}


# ---------------------------------------------------------------------------
# Disponibilidad de IA (reusa el gate del gateway + los gates duros del provider)
# ---------------------------------------------------------------------------
def study_ai_available() -> bool:
    try:
        from .gateway import real_provider_permitted
        if not real_provider_permitted():
            return False
        from .providers.openai_provider import OpenAIProvider
        return OpenAIProvider().is_available()
    except Exception:  # pragma: no cover - fail-closed a determinista
        return False


# ---------------------------------------------------------------------------
# Utilidades de fecha
# ---------------------------------------------------------------------------
def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_due_date(due_date: str) -> datetime:
    """Fecha de entrega por defecto: la provista, o dentro de 10 días."""
    s = (due_date or "").strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y"):
        try:
            d = datetime.strptime(s, fmt)
            return d.replace(hour=23, minute=59, tzinfo=timezone.utc)
        except ValueError:
            continue
    return _now() + timedelta(days=10)


def _clamp_future(dt: datetime) -> datetime:
    """Ningún paso puede quedar en el pasado."""
    now = _now()
    return dt if dt > now else now


def _extract_calendar_candidates(text: str) -> list[dict]:
    candidates: list[dict] = []
    pattern = re.compile(r"(?P<date>\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b)(?P<label>.{0,110})")
    current_year = _now().year
    for match in pattern.finditer(text or ""):
        raw_date = match.group("date")
        label = " ".join(match.group("label").strip(" :-–—\t\r\n").split())[:90]
        parts = re.split(r"[/-]", raw_date)
        if len(parts) < 2:
            continue
        try:
            day, month = int(parts[0]), int(parts[1])
            year = int(parts[2]) if len(parts) > 2 else current_year
            if year < 100:
                year += 2000
            due = datetime(year, month, day, 23, 59, tzinfo=timezone.utc)
        except (ValueError, IndexError):
            continue
        candidates.append({"due": due, "label": label or "Evaluación detectada"})
        if len(candidates) >= 8:
            break
    return candidates


# ---------------------------------------------------------------------------
# Vía determinista (plantilla) — comportamiento histórico
# ---------------------------------------------------------------------------
def deterministic_steps(
    *, source_text: str, subject: str, student: str, due_date: str, evaluation_title: str
) -> list[dict]:
    base_subject = (subject or "").strip() or "Ramo pendiente"
    student_label = (student or "").strip() or "estudiante"
    candidates = _extract_calendar_candidates(source_text)
    if not candidates:
        candidates = [{
            "due": _parse_due_date(due_date),
            "label": (evaluation_title or "").strip() or base_subject or "Evaluación / entrega escolar",
        }]
    steps: list[dict] = []
    for item in candidates[:8]:
        due = item["due"]
        label = item["label"]
        template = [
            (f"Diagnóstico de estudio: {base_subject} — {label} ({student_label})", due - timedelta(days=10), "medium", "diagnostico"),
            (f"Resumen y materia clave: {base_subject} — {label}", due - timedelta(days=7), "medium", "resumen"),
            (f"Práctica guiada: {base_subject} — {label}", due - timedelta(days=4), "high", "practica"),
            (f"Repaso final y materiales: {base_subject} — {label}", due - timedelta(days=1), "high", "repaso"),
            (f"Evaluación / entrega: {base_subject} — {label}", due, "high", "evaluacion"),
        ]
        for title, task_due, priority, tag in template:
            steps.append({
                "title": title[:120],
                "due": _clamp_future(task_due),
                "priority": priority,
                "tags": ["estudio", tag, base_subject],
                "subject": base_subject,
            })
    return steps[:MAX_STEPS * 2]


# ---------------------------------------------------------------------------
# Vía IA real
# ---------------------------------------------------------------------------
_STUDY_SYSTEM = (
    "Eres Domi, planificador de estudio de VantDomus Hogar. A partir del aviso "
    "escolar y los datos, arma un PLAN DE ESTUDIO realista y a la medida para el "
    "estudiante: detecta las materias y las fechas de evaluación/entrega, y "
    "reparte pasos concretos y priorizados hasta cada fecha (diagnóstico, "
    "resumen, práctica, repaso, evaluación), evitando sobrecargar días con varias "
    "evaluaciones juntas. Responde EXCLUSIVAMENTE un objeto JSON válido, sin "
    "Markdown ni texto alrededor, con la forma EXACTA: "
    '{"subjects": ["<materia>"], "steps": [{"title": "<paso claro y accionable>", '
    '"date": "YYYY-MM-DD", "priority": "low|medium|high", '
    '"tag": "diagnostico|resumen|practica|repaso|evaluacion|refuerzo|otro"}]}. '
    "Reglas: fechas reales en formato YYYY-MM-DD; no inventes fechas que no se "
    "deduzcan del material o de la fecha de entrega dada; máximo 12 pasos; títulos "
    "en español, breves; NO incluyas nombres de otras personas, IDs ni datos "
    "sensibles. TÚ SOLO PLANIFICAS; el usuario confirmará y podrá editar."
)


def _validate_ai_steps(data: dict, base_subject: str) -> list[dict]:
    steps_raw = data.get("steps")
    if not isinstance(steps_raw, list) or not steps_raw:
        raise ValueError("steps vacío o inválido")
    subjects = data.get("subjects")
    subject_hint = base_subject
    if isinstance(subjects, list) and subjects and isinstance(subjects[0], str) and subjects[0].strip():
        subject_hint = subjects[0].strip()[:60]
    now = _now()
    lo, hi = now - timedelta(days=1), now + timedelta(days=400)
    out: list[dict] = []
    for s in steps_raw[:MAX_STEPS]:
        if not isinstance(s, dict):
            continue
        title = str(s.get("title") or "").strip()
        date_s = str(s.get("date") or "").strip()
        priority = str(s.get("priority") or "medium").strip().lower()
        tag = str(s.get("tag") or "otro").strip().lower()
        if not title or not date_s:
            continue
        try:
            due = datetime.strptime(date_s, "%Y-%m-%d").replace(hour=23, minute=59, tzinfo=timezone.utc)
        except ValueError:
            continue
        if not (lo <= due <= hi):
            continue
        if priority not in _VALID_PRIORITIES:
            priority = "medium"
        if tag not in _STEP_TAG_WHITELIST:
            tag = "otro"
        out.append({
            "title": title[:120],
            "due": _clamp_future(due),
            "priority": priority,
            "tags": ["estudio", tag, subject_hint],
            "subject": subject_hint,
        })
    if not out:
        raise ValueError("ningún paso válido tras validación")
    return out


def ai_study_plan(
    *, source_text: str, subject: str, student: str, due_date: str, evaluation_title: str, notes: str = ""
) -> list[dict] | None:
    """Devuelve pasos generados por IA, o None si no hay IA o la salida no valida."""
    if not study_ai_available():
        return None
    try:
        from .providers.openai_provider import OpenAIProvider
        provider = OpenAIProvider()
        base_subject = (subject or "").strip() or "Ramo pendiente"
        user = json.dumps({
            "estudiante": (student or "").strip() or "estudiante",
            "materia": base_subject,
            "titulo_evaluacion": (evaluation_title or "").strip(),
            "fecha_entrega": (due_date or "").strip(),
            "hoy": _now().strftime("%Y-%m-%d"),
            "notas": (notes or "")[:1000],
            "material": (source_text or "")[:MAX_SOURCE_CHARS],
        }, ensure_ascii=False)
        data = provider.complete_json(system=_STUDY_SYSTEM, user=user, max_tokens=700)
        allowed = {"subjects", "steps"}
        if set(data.keys()) - allowed:
            raise ValueError(f"campos top-level no permitidos: {sorted(set(data.keys()) - allowed)}")
        return _validate_ai_steps(data, base_subject)
    except Exception as exc:
        logger.warning("study_planner: IA no utilizable, uso plantilla (%s)", str(exc)[:120])
        return None


# ---------------------------------------------------------------------------
# Orquestador
# ---------------------------------------------------------------------------
def build_study_steps(
    *, source_text: str, subject: str, student: str, due_date: str, evaluation_title: str, notes: str = ""
) -> tuple[list[dict], str]:
    """
    Devuelve (steps, mode). mode ∈ {"ai", "template"}. Intenta IA real; ante
    ausencia o cualquier fallo cae de forma segura a la plantilla determinista.
    """
    steps = ai_study_plan(
        source_text=source_text, subject=subject, student=student,
        due_date=due_date, evaluation_title=evaluation_title, notes=notes,
    )
    if steps:
        return steps, "ai"
    return deterministic_steps(
        source_text=source_text, subject=subject, student=student,
        due_date=due_date, evaluation_title=evaluation_title,
    ), "template"
