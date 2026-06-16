import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.audit import write_audit_log, write_assistant_action_log
from app.deps import get_current_user, get_db, require_household_role
from app.malware import MalwareDetected, MalwareScanUnavailable, scan_file_path
from app.security_events import write_security_event
from app.tenancy import get_household_organization_id
from app.voice import VoiceProviderError, synthesize_speech, transcribe_audio_file

router = APIRouter()

ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm", ".ogg", ".oga"}
MAX_AUDIO_BYTES = int(os.getenv("VANTDOMUS_AUDIO_MAX_BYTES", str(25 * 1024 * 1024)))


class SpeechRequest(BaseModel):
    household_id: str
    text: str
    voice: str | None = None


@router.get("/status")
def audio_status(user=Depends(get_current_user)):
    return {
        "provider": "openai",
        "configured": bool(os.getenv("OPENAI_API_KEY", "").strip()),
        "keys_mode": os.getenv("VANTDOMUS_AI_KEYS_MODE", "platform"),
        "secret_manager": os.getenv("VANTDOMUS_SECRET_MANAGER", "env"),
        "production_ready": bool(os.getenv("OPENAI_API_KEY", "").strip())
        and os.getenv("VANTDOMUS_AI_KEYS_MODE", "platform") in {"platform", "tenant_byok"},
        "stt_model": os.getenv("VANTDOMUS_STT_MODEL", "gpt-4o-mini-transcribe"),
        "tts_model": os.getenv("VANTDOMUS_TTS_MODEL", "gpt-4o-mini-tts"),
        "tts_voice": os.getenv("VANTDOMUS_TTS_VOICE", "alloy"),
        "max_audio_bytes": MAX_AUDIO_BYTES,
    }


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _private_upload_root() -> Path:
    return Path(os.getenv("VANTDOMUS_PRIVATE_UPLOAD_DIR", "private_uploads")).resolve()


def _safe_filename(filename: str) -> str:
    stem = Path(filename or "audio").stem
    suffix = Path(filename or "").suffix.lower()
    safe_stem = "".join(ch if ch.isalnum() or ch in {"-", "_"} else "_" for ch in stem)[:80] or "audio"
    if suffix not in ALLOWED_AUDIO_EXTENSIONS:
        suffix = ".webm"
    return safe_stem + suffix


def _audio_dir(organization_id: str | None, household_id: str) -> Path:
    root = _private_upload_root()
    path = (root / "audio" / (organization_id or "unassigned") / household_id).resolve()
    if not str(path).startswith(str(root)):
        raise HTTPException(status_code=400, detail="Invalid audio path")
    path.mkdir(parents=True, exist_ok=True)
    return path


def _save_upload(file: UploadFile, target_dir: Path) -> tuple[Path, int]:
    filename = _safe_filename(file.filename or "audio.webm")
    target = target_dir / f"{uuid.uuid4()}_{filename}"
    size = 0
    with target.open("wb") as out:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_AUDIO_BYTES:
                try:
                    target.unlink()
                except OSError:
                    pass
                raise HTTPException(status_code=413, detail="Audio demasiado grande.")
            out.write(chunk)
    return target, size


@router.post("/transcribe")
def transcribe_audio(
    household_id: str = Form(...),
    source: str = Form("upload"),
    provider_event_id: str = Form(""),
    language: str = Form("es"),
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_household_role(db, user["user_id"], household_id, "member")
    organization_id = get_household_organization_id(db, household_id)
    suffix = Path(file.filename or "").suffix.lower()
    if suffix and suffix not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Formato de audio no permitido.")

    target, size = _save_upload(file, _audio_dir(organization_id, household_id))
    trace_id = "trace_voice_" + str(uuid.uuid4())
    try:
        scan_file_path(target)
    except MalwareScanUnavailable as exc:
        write_security_event(
            db,
            event_type="malware_scan_unavailable",
            severity="high",
            source="audio_transcription",
            household_id=household_id,
            organization_id=organization_id,
            user_id=user["user_id"],
            metadata={"trace_id": trace_id, "filename": file.filename, "error": str(exc)},
            commit=True,
        )
        raise HTTPException(status_code=503, detail=str(exc))
    except MalwareDetected as exc:
        write_security_event(
            db,
            event_type="malware_detected",
            severity="critical",
            source="audio_transcription",
            household_id=household_id,
            organization_id=organization_id,
            user_id=user["user_id"],
            metadata={"trace_id": trace_id, "filename": file.filename, "reason": str(exc)},
            commit=True,
        )
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        result = transcribe_audio_file(target, filename=file.filename or target.name, content_type=file.content_type, language=language)
    except VoiceProviderError as exc:
        write_audit_log(
            db,
            action="audio_transcription_failed",
            resource_type="voice_audio",
            household_id=household_id,
            organization_id=organization_id,
            user_id=user["user_id"],
            resource_id=trace_id,
            metadata={"source": source, "provider_event_id": provider_event_id, "filename": file.filename, "size": size, "error": str(exc)},
        )
        db.commit()
        raise HTTPException(status_code=503, detail=str(exc))

    audit_id = write_audit_log(
        db,
        action="audio_transcribed",
        resource_type="voice_audio",
        household_id=household_id,
        organization_id=organization_id,
        user_id=user["user_id"],
        resource_id=trace_id,
        metadata={
            "trace_id": trace_id,
            "source": source,
            "provider_event_id": provider_event_id,
            "filename": file.filename,
            "size": size,
            "provider": result["provider"],
            "model": result["model"],
        },
    )
    assistant_action_id = write_assistant_action_log(
        db,
        household_id=household_id,
        organization_id=organization_id,
        user_id=user["user_id"],
        tool_name="voice_transcribe",
        arguments={"trace_id": trace_id, "source": source, "provider_event_id": provider_event_id},
        result={"text": result["text"][:1000], "provider": result["provider"], "model": result["model"], "audit_id": audit_id},
        status="success",
    )
    db.commit()
    return {
        "trace_id": trace_id,
        "audit_id": audit_id,
        "assistant_action_id": assistant_action_id,
        "provider": result["provider"],
        "model": result["model"],
        "text": result["text"],
        "source": source,
    }


@router.post("/speech")
def create_speech(req: SpeechRequest, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], req.household_id, "member")
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text required")
    organization_id = get_household_organization_id(db, req.household_id)
    trace_id = "trace_voice_" + str(uuid.uuid4())
    try:
        result = synthesize_speech(req.text, voice=req.voice)
    except VoiceProviderError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    audit_id = write_audit_log(
        db,
        action="speech_synthesized",
        resource_type="voice_audio",
        household_id=req.household_id,
        organization_id=organization_id,
        user_id=user["user_id"],
        resource_id=trace_id,
        metadata={"trace_id": trace_id, "provider": result["provider"], "model": result["model"], "voice": result["voice"]},
    )
    assistant_action_id = write_assistant_action_log(
        db,
        household_id=req.household_id,
        organization_id=organization_id,
        user_id=user["user_id"],
        tool_name="voice_speech",
        arguments={"trace_id": trace_id, "voice": result["voice"]},
        result={"provider": result["provider"], "model": result["model"], "audit_id": audit_id},
        status="success",
    )
    db.commit()
    return {
        "trace_id": trace_id,
        "audit_id": audit_id,
        "assistant_action_id": assistant_action_id,
        "provider": result["provider"],
        "model": result["model"],
        "voice": result["voice"],
        "mime_type": result["mime_type"],
        "audio_base64": result["audio_base64"],
    }
