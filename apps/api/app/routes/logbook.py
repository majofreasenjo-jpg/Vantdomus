import os
import secrets
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..audit import write_audit_log
from ..deps import get_current_user, get_db, require_household_role, require_verified_email_for_sensitive_action
from ..malware import MalwareDetected, MalwareScanUnavailable, StreamingMalwareScanner
from ..security_events import write_security_event
from ..tenancy import get_household_organization_id

router = APIRouter()


def now():
    return datetime.now(timezone.utc).isoformat()


def _private_upload_root() -> Path:
    return Path(os.getenv("VANTDOMUS_PRIVATE_UPLOAD_DIR", "private_uploads")).resolve()


def _safe_filename(filename: str) -> str:
    return Path(filename.replace("\\", "/")).name.replace(" ", "_")


def _hash_share_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _max_signed_url_ttl_seconds() -> int:
    return int(os.getenv("VANTDOMUS_SIGNED_URL_MAX_TTL_SECONDS", "86400"))


def _max_upload_bytes() -> int:
    return int(os.getenv("VANTDOMUS_MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))


def _allowed_upload_mimes() -> set[str]:
    raw = os.getenv(
        "VANTDOMUS_ALLOWED_UPLOAD_MIMES",
        "application/pdf,image/png,image/jpeg,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel",
    )
    return {item.strip().lower() for item in raw.split(",") if item.strip()}


def _allowed_upload_extensions() -> set[str]:
    raw = os.getenv("VANTDOMUS_ALLOWED_UPLOAD_EXTENSIONS", ".pdf,.png,.jpg,.jpeg,.txt,.csv,.docx,.pptx,.xlsx,.xls")
    return {item.strip().lower() for item in raw.split(",") if item.strip()}


def _validate_upload(file: UploadFile) -> None:
    extension = Path(file.filename or "").suffix.lower()
    content_type = (file.content_type or "").lower()
    if extension not in _allowed_upload_extensions():
        raise HTTPException(status_code=400, detail=f"Attachment extension not allowed: {extension or 'none'}")
    if content_type and content_type not in _allowed_upload_mimes():
        raise HTTPException(status_code=400, detail=f"Attachment content type not allowed: {content_type}")


def _copy_upload_with_limit(
    file: UploadFile,
    path: Path,
    *,
    db,
    household_id: str,
    organization_id: str | None,
    user_id: str,
) -> int:
    max_bytes = _max_upload_bytes()
    total = 0
    scanner = StreamingMalwareScanner()
    with open(path, "wb") as buffer:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > max_bytes:
                buffer.close()
                try:
                    path.unlink(missing_ok=True)
                except OSError:
                    pass
                raise HTTPException(status_code=413, detail=f"Attachment exceeds {max_bytes} bytes")
            try:
                scanner.scan_chunk(chunk)
            except MalwareScanUnavailable as exc:
                buffer.close()
                try:
                    path.unlink(missing_ok=True)
                except OSError:
                    pass
                write_security_event(
                    db,
                    event_type="malware_scan_unavailable",
                    severity="high",
                    source="logbook_upload",
                    household_id=household_id,
                    organization_id=organization_id,
                    user_id=user_id,
                    metadata={"filename": file.filename, "error": str(exc)},
                    commit=True,
                )
                raise HTTPException(status_code=503, detail=str(exc))
            except MalwareDetected as exc:
                buffer.close()
                try:
                    path.unlink(missing_ok=True)
                except OSError:
                    pass
                write_security_event(
                    db,
                    event_type="malware_detected",
                    severity="critical",
                    source="logbook_upload",
                    household_id=household_id,
                    organization_id=organization_id,
                    user_id=user_id,
                    metadata={"filename": file.filename, "reason": str(exc)},
                    commit=True,
                )
                raise HTTPException(status_code=400, detail=str(exc))
            buffer.write(chunk)
        try:
            scanner.finish()
        except MalwareScanUnavailable as exc:
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass
            write_security_event(
                db,
                event_type="malware_scan_unavailable",
                severity="high",
                source="logbook_upload",
                household_id=household_id,
                organization_id=organization_id,
                user_id=user_id,
                metadata={"filename": file.filename, "error": str(exc)},
                commit=True,
            )
            raise HTTPException(status_code=503, detail=str(exc))
        except MalwareDetected as exc:
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass
            write_security_event(
                db,
                event_type="malware_detected",
                severity="critical",
                source="logbook_upload",
                household_id=household_id,
                organization_id=organization_id,
                user_id=user_id,
                metadata={"filename": file.filename, "reason": str(exc)},
                commit=True,
            )
            raise HTTPException(status_code=400, detail=str(exc))
    return total


@router.get("")
def list_entries(household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "viewer")
    rows = db.execute(
        """
        SELECT l.id, l.entry_type, l.content, l.created_at, l.event_date, l.attachment_url, l.attachment_name, u.email as author_name
        FROM logbook_entries l
        LEFT JOIN users u ON l.user_id = u.id
        WHERE l.household_id = ?
        ORDER BY COALESCE(l.event_date, l.created_at) DESC
        LIMIT 100
        """,
        (household_id,),
    ).fetchall()
    return {"items": [dict(row) for row in rows]}


@router.get("/{entry_id}/attachment")
def download_attachment(entry_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    row = db.execute(
        "SELECT household_id, attachment_path, attachment_name FROM logbook_entries WHERE id=?",
        (entry_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Attachment not found")

    require_household_role(db, user["user_id"], row["household_id"], "viewer")
    if not row["attachment_path"]:
        raise HTTPException(status_code=404, detail="Attachment not found")

    path = Path(row["attachment_path"]).resolve()
    root = _private_upload_root()
    if not str(path).startswith(str(root)) or not path.exists():
        raise HTTPException(status_code=404, detail="Attachment not found")

    return FileResponse(path, filename=row["attachment_name"] or path.name)


@router.post("/{entry_id}/share")
def create_attachment_share_link(
    entry_id: str,
    ttl_seconds: int = 900,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    row = db.execute(
        """
        SELECT household_id, organization_id, attachment_path, attachment_name
        FROM logbook_entries
        WHERE id=?
        """,
        (entry_id,),
    ).fetchone()
    if not row or not row["attachment_path"]:
        raise HTTPException(status_code=404, detail="Attachment not found")

    require_household_role(db, user["user_id"], row["household_id"], "admin")
    require_verified_email_for_sensitive_action(db, user["user_id"])
    max_ttl = _max_signed_url_ttl_seconds()
    ttl = max(60, min(int(ttl_seconds), max_ttl))
    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=ttl)).isoformat()
    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_share_token(raw_token)
    token_id = str(uuid.uuid4())

    db.execute(
        """
        INSERT INTO signed_file_tokens (
          id, token_hash, household_id, organization_id, resource_type, resource_id,
          file_path, file_name, created_by_user_id, created_at, expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            token_id,
            token_hash,
            row["household_id"],
            row["organization_id"],
            "logbook_attachment",
            entry_id,
            row["attachment_path"],
            row["attachment_name"],
            user["user_id"],
            now(),
            expires_at,
        ),
    )
    write_audit_log(
        db,
        action="create_signed_link",
        resource_type="logbook_attachment",
        household_id=row["household_id"],
        user_id=user["user_id"],
        resource_id=entry_id,
        metadata={"expires_at": expires_at, "ttl_seconds": ttl},
    )
    db.commit()

    return {
        "url": f"/logbook/shared/{raw_token}",
        "expires_at": expires_at,
        "ttl_seconds": ttl,
    }


@router.get("/shared/{token}")
def download_shared_attachment(token: str, db=Depends(get_db)):
    token_hash = _hash_share_token(token)
    row = db.execute(
        """
        SELECT id, household_id, resource_id, file_path, file_name, expires_at, revoked_at
        FROM signed_file_tokens
        WHERE token_hash=? AND resource_type='logbook_attachment'
        """,
        (token_hash,),
    ).fetchone()
    if not row or row["revoked_at"]:
        raise HTTPException(status_code=404, detail="Shared attachment not found")
    if datetime.fromisoformat(row["expires_at"]) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Shared attachment link expired")

    path = Path(row["file_path"]).resolve()
    root = _private_upload_root()
    if not str(path).startswith(str(root)) or not path.exists():
        raise HTTPException(status_code=404, detail="Shared attachment not found")

    write_audit_log(
        db,
        action="download_signed_link",
        resource_type="logbook_attachment",
        household_id=row["household_id"],
        resource_id=row["resource_id"],
        metadata={"token_id": row["id"]},
    )
    db.commit()

    return FileResponse(path, filename=row["file_name"] or path.name)


@router.post("/shared/{token}/revoke")
def revoke_shared_attachment(token: str, user=Depends(get_current_user), db=Depends(get_db)):
    token_hash = _hash_share_token(token)
    row = db.execute(
        """
        SELECT id, household_id, resource_id, revoked_at
        FROM signed_file_tokens
        WHERE token_hash=? AND resource_type='logbook_attachment'
        """,
        (token_hash,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Shared attachment not found")

    require_household_role(db, user["user_id"], row["household_id"], "admin")
    require_verified_email_for_sensitive_action(db, user["user_id"])
    revoked_at = row["revoked_at"] or now()
    db.execute("UPDATE signed_file_tokens SET revoked_at=? WHERE id=?", (revoked_at, row["id"]))
    write_audit_log(
        db,
        action="revoke_signed_link",
        resource_type="logbook_attachment",
        household_id=row["household_id"],
        user_id=user["user_id"],
        resource_id=row["resource_id"],
        metadata={"token_id": row["id"], "revoked_at": revoked_at},
    )
    db.commit()
    return {"status": "revoked", "revoked_at": revoked_at}


@router.post("")
def create_entry(
    household_id: str,
    entry_type: str = Form(...),
    content: str = Form(...),
    event_date: str = Form(None),
    file: UploadFile = File(None),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_household_role(db, user["user_id"], household_id, "member")
    organization_id = get_household_organization_id(db, household_id)

    entry_id = str(uuid.uuid4())
    ts = now()
    valid_types = {
        "hito",
        "comentario",
        "accidente",
        "implementacion",
        "reunion",
        "acuerdo",
        "auditoria",
        "inspeccion",
        "aviso",
        "instruccion",
    }
    if entry_type not in valid_types:
        entry_type = "comentario"

    attachment_url = None
    attachment_name = None
    attachment_path = None

    if file and file.filename:
        _validate_upload(file)
        root = _private_upload_root()
        target_dir = root / (organization_id or "unassigned") / household_id
        target_dir.mkdir(parents=True, exist_ok=True)
        safe_name = _safe_filename(file.filename)
        store_name = f"{entry_id}_{safe_name}"
        path = (target_dir / store_name).resolve()
        if not str(path).startswith(str(root)):
            raise HTTPException(status_code=400, detail="Invalid attachment filename")

        size = _copy_upload_with_limit(
            file,
            path,
            db=db,
            household_id=household_id,
            organization_id=organization_id,
            user_id=user["user_id"],
        )

        attachment_url = f"/logbook/{entry_id}/attachment"
        attachment_name = file.filename
        attachment_path = str(path)

    ev_date = event_date or ts
    db.execute(
        """
        INSERT INTO logbook_entries (
          id, household_id, organization_id, user_id, entry_type, content, created_at,
          event_date, attachment_url, attachment_name, attachment_path
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (entry_id, household_id, organization_id, user["user_id"], entry_type, content, ts, ev_date, attachment_url, attachment_name, attachment_path),
    )
    write_audit_log(
        db,
        action="create",
        resource_type="logbook_entry",
        household_id=household_id,
        user_id=user["user_id"],
        resource_id=entry_id,
        metadata={"entry_type": entry_type, "has_attachment": bool(attachment_path), "attachment_size": size if attachment_path else 0},
    )
    db.commit()

    return {"id": entry_id, "status": "created"}
