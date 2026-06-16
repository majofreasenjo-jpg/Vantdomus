import base64
import html
import os
import re
from datetime import datetime, timezone
from pathlib import Path

import fitz  # PyMuPDF
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from ..audit import write_audit_log
from ..deps import get_current_user, get_db, require_household_role
from ..malware import MalwareDetected, MalwareScanUnavailable, scan_file_path
from ..security_events import write_security_event
from ..tenancy import get_household_organization_id

router = APIRouter()


class DocumentBatchReq(BaseModel):
    household_id: str
    batch_name: str
    target_directory: str
    target_dates: list[str] = []
    crop_x: int = 0
    crop_y: int = 0
    crop_w: int = 800
    crop_h: int = 500


class DocumentBatchResp(BaseModel):
    message: str
    processed_count: int
    gallery_url: str
    batch_id: str


def now():
    return datetime.now(timezone.utc).isoformat()


def _private_upload_root() -> Path:
    return Path(os.getenv("VANTDOMUS_PRIVATE_UPLOAD_DIR", "private_uploads")).resolve()


def _safe_batch_id(batch_name: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9_-]+", "_", batch_name.strip().lower()).strip("_")
    return value[:80] or "vision_batch"


def _vision_batch_dir(organization_id: str | None, household_id: str, batch_id: str) -> Path:
    root = _private_upload_root()
    path = (root / "vision" / (organization_id or "unassigned") / household_id / batch_id).resolve()
    if not str(path).startswith(str(root)):
        raise HTTPException(status_code=400, detail="Invalid vision batch path")
    path.mkdir(parents=True, exist_ok=True)
    return path


def _vision_intake_root(organization_id: str | None, household_id: str) -> Path:
    """
    Per-tenant intake directory: this is the ONLY area on the host that
    process_scanned_documents is allowed to walk. Each (org, household) is
    isolated to its own subtree under the private upload root.
    """
    root = _private_upload_root()
    intake = (root / "vision_intake" / (organization_id or "unassigned") / household_id).resolve()
    if not str(intake).startswith(str(root)):
        raise HTTPException(status_code=400, detail="Invalid vision intake path")
    intake.mkdir(parents=True, exist_ok=True)
    return intake


def _resolve_intake_subdir(intake_root: Path, raw_target: str) -> Path:
    """
    Resolve a user-supplied target_directory as a subpath of the tenant's
    intake root, rejecting any traversal that escapes that root. Absolute
    paths, drive letters, '..', symlinks-outside, and Windows-style
    backslash escapes are all rejected.
    """
    if not raw_target or not raw_target.strip():
        # Default to the tenant intake root itself.
        return intake_root

    candidate = raw_target.strip().replace("\\", "/")
    # Strip any leading slashes so the path is always treated as relative
    # to the tenant intake root, never as an absolute host path.
    candidate = candidate.lstrip("/")

    rel = Path(candidate)
    if rel.is_absolute() or rel.drive:
        raise HTTPException(
            status_code=400,
            detail="target_directory debe ser relativo al area de ingestion del tenant.",
        )

    resolved = (intake_root / rel).resolve()
    try:
        resolved.relative_to(intake_root)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="target_directory escapa del area privada del tenant.",
        )
    return resolved


def _gallery_path(organization_id: str | None, household_id: str, batch_id: str) -> Path:
    return _vision_batch_dir(organization_id, household_id, batch_id) / "gallery.html"


def _encode_image_data_uri(path: Path) -> str:
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


@router.get("/batches/{batch_id}/gallery", response_class=HTMLResponse)
def get_batch_gallery(
    batch_id: str,
    household_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_household_role(db, user["user_id"], household_id, "viewer")
    organization_id = get_household_organization_id(db, household_id)
    path = _gallery_path(organization_id, household_id, _safe_batch_id(batch_id))
    if not path.exists():
        raise HTTPException(status_code=404, detail="Vision gallery not found")
    return HTMLResponse(path.read_text(encoding="utf-8"))


@router.post("/process_batch", response_model=DocumentBatchResp)
def process_scanned_documents(
    req: DocumentBatchReq,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Processes scanned PDFs into private visual crops for multimodal review.
    """
    require_household_role(db, user["user_id"], req.household_id, "member")
    organization_id = get_household_organization_id(db, req.household_id)

    # SECURITY: target_directory is treated as a path *relative* to this
    # tenant's intake root. Absolute paths and traversal (`..`) are rejected,
    # so a member cannot point at /etc, C:\Users\..., another tenant's data,
    # or arbitrary container filesystem locations.
    intake_root = _vision_intake_root(organization_id, req.household_id)
    target_directory = _resolve_intake_subdir(intake_root, req.target_directory)
    if not target_directory.exists() or not target_directory.is_dir():
        raise HTTPException(
            status_code=404,
            detail="El subdirectorio de ingestion no existe dentro del area privada del tenant.",
        )

    batch_id = _safe_batch_id(req.batch_name)
    batch_dir = _vision_batch_dir(organization_id, req.household_id, batch_id)

    found_files: list[Path] = []
    for root, _dirs, files in os.walk(target_directory):
        for filename in files:
            if not filename.lower().endswith(".pdf"):
                continue
            if not req.target_dates or any(target_date in filename for target_date in req.target_dates):
                found_files.append(Path(root) / filename)

    if not found_files:
        raise HTTPException(status_code=404, detail="No se encontraron PDFs validos con los filtros propuestos.")

    try:
        for filepath in found_files:
            scan_file_path(filepath)
    except MalwareScanUnavailable as exc:
        write_security_event(
            db,
            event_type="malware_scan_unavailable",
            severity="high",
            source="vision_batch",
            household_id=req.household_id,
            organization_id=organization_id,
            user_id=user["user_id"],
            metadata={"batch_id": batch_id, "error": str(exc)},
            commit=True,
        )
        raise HTTPException(status_code=503, detail=str(exc))
    except MalwareDetected as exc:
        write_security_event(
            db,
            event_type="malware_detected",
            severity="critical",
            source="vision_batch",
            household_id=req.household_id,
            organization_id=organization_id,
            user_id=user["user_id"],
            metadata={"batch_id": batch_id, "reason": str(exc)},
            commit=True,
        )
        raise HTTPException(status_code=400, detail=str(exc))

    gallery_parts = [
        "<html><body style='background:#111; color:white; font-family:sans-serif;'>",
        f"<h1>VantDomus Vision Tunnel - {html.escape(req.batch_name)}</h1>",
    ]
    processed_count = 0

    for idx, filepath in enumerate(found_files):
        try:
            doc = fitz.open(filepath)
            page = doc[0]
            rect = fitz.Rect(req.crop_x, req.crop_y, req.crop_x + req.crop_w, req.crop_y + req.crop_h)
            pix = page.get_pixmap(dpi=150, clip=rect)

            img_path = batch_dir / f"crop_{idx}.png"
            pix.save(img_path)
            data_uri = _encode_image_data_uri(img_path)
            filename_base = html.escape(filepath.name)

            gallery_parts.append(
                "<div style='margin-bottom:20px;'>"
                f"<h3 style='color:cyan;'>Doc: {filename_base}</h3>"
                f"<img src='{data_uri}' style='border:2px solid cyan; max-width:100%;' />"
                "</div>"
            )
            processed_count += 1
            doc.close()
        except Exception as exc:
            gallery_parts.append(
                f"<p style='color:red;'>Error vectorizando {html.escape(filepath.name)}: {html.escape(str(exc))}</p>"
            )

    gallery_parts.append("</body></html>")
    gallery_path = batch_dir / "gallery.html"
    gallery_path.write_text("".join(gallery_parts), encoding="utf-8")

    write_audit_log(
        db,
        action="process_batch",
        resource_type="vision_batch",
        household_id=req.household_id,
        user_id=user["user_id"],
        resource_id=batch_id,
        metadata={"processed_count": processed_count, "target_dates": req.target_dates},
    )
    db.commit()

    return DocumentBatchResp(
        message="Legajo documental compilado en almacenamiento privado.",
        processed_count=processed_count,
        gallery_url=f"/vision/batches/{batch_id}/gallery?household_id={req.household_id}",
        batch_id=batch_id,
    )
