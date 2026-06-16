import uuid, json, re
from datetime import datetime, timezone, timedelta
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from ..deps import get_db, get_current_user, require_household_role, require_person_in_household
from ..audit import write_audit_log
from ..tenancy import get_household_organization_id
from .forensics import _extract_text, _validate_file
from .logbook import _copy_upload_with_limit, _private_upload_root, _safe_filename
# VantGuide: el SchoolPlanner pasa a ser un *adapter* de ingesta académica
# hacia el motor común UnitFunction (categoría=study, source_type=school_notice).
# Mantenemos la creación legacy de task_items via dual_write_task=True para
# que las pantallas viejas (kanban) sigan viendo los ítems.
from .unit_functions import create_unit_function_internal

router = APIRouter(prefix="/tasks", tags=["Tasks"])

def now():
    return datetime.now(timezone.utc).isoformat()

def _parse_due_date(value: str | None) -> datetime:
    if value:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            try:
                return datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                pass
    return datetime.now(timezone.utc) + timedelta(days=14)

def _insert_task(db, household_id: str, organization_id: str | None, title: str, due_at: datetime, assigned_person_id: str | None, priority: str, tags: list[str]):
    tid = str(uuid.uuid4())
    ts = now()
    db.execute("""
      INSERT INTO task_items (id,household_id,organization_id,title,status,due_at,assigned_person_id,priority,tags,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    """, (tid, household_id, organization_id, title, "open", due_at.isoformat(), assigned_person_id, priority, json.dumps(tags), ts, ts))
    return tid

def _extract_calendar_candidates(text: str) -> list[dict]:
    candidates: list[dict] = []
    pattern = re.compile(r"(?P<date>\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b)(?P<label>.{0,110})")
    current_year = datetime.now(timezone.utc).year
    for match in pattern.finditer(text or ""):
        raw_date = match.group("date")
        label = " ".join(match.group("label").strip(" :-–—\t\r\n").split())[:90]
        parts = re.split(r"[/-]", raw_date)
        if len(parts) < 2:
            continue
        day, month = int(parts[0]), int(parts[1])
        year = int(parts[2]) if len(parts) > 2 else current_year
        if year < 100:
            year += 2000
        try:
            due = datetime(year, month, day, 23, 59, tzinfo=timezone.utc)
        except ValueError:
            continue
        candidates.append({"due": due, "label": label or "Evaluacion detectada"})
        if len(candidates) >= 8:
            break
    return candidates

@router.post("")
def create_task(household_id: str, title: str, due_date: str|None=None, assigned_person_id: str|None=None,
                priority: str="medium", tags: str="", user=Depends(get_current_user), db=Depends(get_db)):
    if priority not in ("low","medium","high"):
        raise HTTPException(status_code=400, detail="priority must be low|medium|high")
    require_household_role(db, user["user_id"], household_id, "member")
    due_at = f"{due_date}T23:59:59+00:00" if due_date else None
    tag_list = [t.strip() for t in (tags or "").split(",") if t.strip()]
    require_person_in_household(db, assigned_person_id, household_id)
    tid = str(uuid.uuid4())
    ts = now()
    organization_id = get_household_organization_id(db, household_id)
    db.execute("""
      INSERT INTO task_items (id,household_id,organization_id,title,status,due_at,assigned_person_id,priority,tags,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    """, (tid, household_id, organization_id, title, "open", due_at, assigned_person_id, priority, json.dumps(tag_list), ts, ts))
    write_audit_log(
        db,
        action="create",
        resource_type="task",
        household_id=household_id,
        user_id=user["user_id"],
        resource_id=tid,
        metadata={"title": title, "priority": priority, "tags": tag_list},
    )
    db.commit()
    return {"id": tid}

@router.post("/school_plan")
def create_school_plan(
    household_id: str = Form(...),
    student: str = Form(""),
    subject: str = Form(""),
    evaluation_title: str = Form(""),
    due_date: str = Form(""),
    assigned_person_id: str | None = Form(None),
    notes: str = Form(""),
    file: UploadFile | None = File(None),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_household_role(db, user["user_id"], household_id, "member")
    require_person_in_household(db, assigned_person_id, household_id)
    organization_id = get_household_organization_id(db, household_id)
    extracted_text = ""
    attachment_name = None
    if file and file.filename:
        _validate_file(file)
        root = _private_upload_root()
        upload_dir = root / (organization_id or "org") / household_id / "school_planner"
        upload_dir.mkdir(parents=True, exist_ok=True)
        safe_name = _safe_filename(file.filename)
        path = (upload_dir / f"{uuid.uuid4()}_{safe_name}").resolve()
        if root not in path.parents:
            raise HTTPException(status_code=400, detail="Invalid school planner attachment filename")
        _copy_upload_with_limit(file, path, db=db, household_id=household_id, organization_id=organization_id, user_id=user["user_id"])
        extracted_text, extraction = _extract_text(path)
        attachment_name = file.filename
    source_text = "\n".join([evaluation_title, notes, extracted_text]).strip()
    candidates = _extract_calendar_candidates(source_text)
    if not candidates:
        candidates = [{
            "due": _parse_due_date(due_date),
            "label": evaluation_title.strip() or subject.strip() or "Evaluacion / entrega escolar",
        }]
    created = []
    unit_function_ids = []
    for item in candidates[:8]:
        due = item["due"]
        label = item["label"]
        base_subject = subject.strip() or "Ramo pendiente"
        student_label = student.strip() or "estudiante"
        plan = [
            (f"Diagnostico de estudio: {base_subject} - {label} ({student_label})", due - timedelta(days=10), "medium", ["estudio", "diagnostico", base_subject]),
            (f"Resumen y materia clave: {base_subject} - {label}", due - timedelta(days=7), "medium", ["estudio", "resumen", base_subject]),
            (f"Practica guiada: {base_subject} - {label}", due - timedelta(days=4), "high", ["estudio", "practica", base_subject]),
            (f"Repaso final y materiales: {base_subject} - {label}", due - timedelta(days=1), "high", ["estudio", "repaso", base_subject]),
            (f"Evaluacion / entrega: {base_subject} - {label}", due, "high", ["evaluacion", base_subject]),
        ]
        for title, task_due, priority, tags in plan:
            task_due_clamped = max(task_due, datetime.now(timezone.utc))

            # VantGuide: crea la UnitFunction primaria (categoría=study) con
            # dual_write_task=True para que se inserte ADEMÁS un task_items
            # atado vía legacy_task_id. Esto mantiene retrocompat con kanban
            # web/mobile sin tener que tocar esas pantallas.
            if assigned_person_id:
                uf_id = create_unit_function_internal(
                    db,
                    household_id=household_id,
                    organization_id=organization_id,
                    person_id=assigned_person_id,
                    category="study",
                    title=title,
                    source_type="school_notice",
                    created_by_user_id=user["user_id"],
                    created_by_ai=False,
                    description=f"Generado desde planificador escolar — {base_subject}",
                    due_at=task_due_clamped.isoformat(),
                    priority=priority,
                    metadata={
                        "subject": base_subject,
                        "evaluation_label": label,
                        "student_label": student_label,
                        "step_tags": tags,
                    },
                    dual_write_task=True,
                )
                unit_function_ids.append(uf_id)
                # Encontrar el task_id que el dual-write generó
                row = db.execute(
                    "SELECT legacy_task_id FROM unit_functions WHERE id=?",
                    (uf_id,),
                ).fetchone()
                if row and row["legacy_task_id"]:
                    created.append(row["legacy_task_id"])
            else:
                # Sin persona asignada → fallback al insert legacy (no se
                # puede crear UnitFunction sin person_id NOT NULL en schema).
                created.append(_insert_task(
                    db, household_id, organization_id, title,
                    task_due_clamped, assigned_person_id, priority, tags,
                ))

    write_audit_log(
        db,
        action="create_school_plan",
        resource_type="unit_function" if unit_function_ids else "task",
        household_id=household_id,
        user_id=user["user_id"],
        metadata={
            "student": student,
            "subject": subject,
            "evaluation_title": evaluation_title,
            "due_date": due_date,
            "attachment_name": attachment_name,
            "tasks_created": len(created),
            "unit_functions_created": len(unit_function_ids),
            "via": "schoolplanner_adapter→UnitFunction",
        },
    )
    db.commit()
    return {
        "ok": True,
        "tasks_created": len(created),
        "unit_functions_created": len(unit_function_ids),
        "detected_items": len(candidates),
        "attachment_name": attachment_name,
        "message": "Plan de estudio familiar generado con recordatorios y seguimiento.",
    }

@router.get("")
def list_tasks(household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "viewer")
    rows = db.execute("""
      SELECT id,title,status,due_at,assigned_person_id,priority,tags,created_at,updated_at
      FROM task_items
      WHERE household_id=?
      ORDER BY created_at DESC
      LIMIT 200
    """, (household_id,)).fetchall()
    items = []
    for r in rows:
        items.append({
            "id": r["id"], "title": r["title"], "status": r["status"], "due_at": r["due_at"],
            "assigned_person_id": r["assigned_person_id"], "priority": r["priority"],
            "tags": json.loads(r["tags"] or "[]"),
            "created_at": r["created_at"], "updated_at": r["updated_at"],
        })
    return {"items": items}

@router.post("/{task_id}/done")
def mark_done(task_id: str, household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "member")
    row = db.execute("SELECT id FROM task_items WHERE id=? AND household_id=?", (task_id, household_id)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    ts = now()
    db.execute("UPDATE task_items SET status='done', updated_at=? WHERE id=?", (ts, task_id))
    write_audit_log(
        db,
        action="mark_done",
        resource_type="task",
        household_id=household_id,
        user_id=user["user_id"],
        resource_id=task_id,
    )
    db.commit()
    return {"ok": True}

@router.post("/{task_id}/status")
def change_status(task_id: str, household_id: str, status: str, user=Depends(get_current_user), db=Depends(get_db)):
    if status not in ("open", "in_progress", "done"):
        raise HTTPException(status_code=400, detail="Invalid status")
    require_household_role(db, user["user_id"], household_id, "member")
    row = db.execute("SELECT id FROM task_items WHERE id=? AND household_id=?", (task_id, household_id)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    ts = now()
    db.execute("UPDATE task_items SET status=?, updated_at=? WHERE id=?", (status, ts, task_id))
    write_audit_log(
        db,
        action="change_status",
        resource_type="task",
        household_id=household_id,
        user_id=user["user_id"],
        resource_id=task_id,
        metadata={"status": status},
    )
    db.commit()
    return {"ok": True, "status": status}
