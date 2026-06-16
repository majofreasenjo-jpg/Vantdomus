import base64
import json
import mimetypes
import os
import uuid
from pathlib import Path
from urllib import request
from urllib.error import HTTPError, URLError


class VoiceProviderError(RuntimeError):
    pass


def _openai_key() -> str:
    return os.getenv("OPENAI_API_KEY", "").strip()


def _stt_model() -> str:
    return os.getenv("VANTDOMUS_STT_MODEL", "gpt-4o-mini-transcribe").strip()


def _tts_model() -> str:
    return os.getenv("VANTDOMUS_TTS_MODEL", "gpt-4o-mini-tts").strip()


def _tts_voice() -> str:
    return os.getenv("VANTDOMUS_TTS_VOICE", "alloy").strip()


def _boundary() -> str:
    return "----VantDomusVoice" + uuid.uuid4().hex


def _multipart_body(fields: dict[str, str], file_field: str, file_path: Path, filename: str, content_type: str | None) -> tuple[bytes, str]:
    boundary = _boundary()
    chunks: list[bytes] = []
    for key, value in fields.items():
        chunks.append(f"--{boundary}\r\n".encode("utf-8"))
        chunks.append(f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode("utf-8"))
        chunks.append(str(value).encode("utf-8"))
        chunks.append(b"\r\n")

    mime = content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    chunks.append(f"--{boundary}\r\n".encode("utf-8"))
    chunks.append(
        f'Content-Disposition: form-data; name="{file_field}"; filename="{filename}"\r\n'
        f"Content-Type: {mime}\r\n\r\n"
        .encode("utf-8")
    )
    chunks.append(file_path.read_bytes())
    chunks.append(b"\r\n")
    chunks.append(f"--{boundary}--\r\n".encode("utf-8"))
    return b"".join(chunks), boundary


def _read_error(exc: Exception) -> str:
    if isinstance(exc, HTTPError):
        try:
            return exc.read().decode("utf-8", errors="replace")
        except Exception:
            return str(exc)
    return str(exc)


def transcribe_audio_file(file_path: Path, *, filename: str, content_type: str | None = None, language: str = "es") -> dict:
    api_key = _openai_key()
    if not api_key:
        raise VoiceProviderError("OPENAI_API_KEY no esta configurada para transcripcion STT.")

    body, boundary = _multipart_body(
        {
            "model": _stt_model(),
            "language": language,
            "response_format": "json",
        },
        "file",
        file_path,
        filename,
        content_type,
    )
    req = request.Request(
        "https://api.openai.com/v1/audio/transcriptions",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=90) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError) as exc:
        raise VoiceProviderError(f"Fallo STT OpenAI: {_read_error(exc)}") from exc

    return {
        "provider": "openai",
        "model": _stt_model(),
        "text": payload.get("text", ""),
        "raw": payload,
    }


def synthesize_speech(text: str, *, voice: str | None = None) -> dict:
    api_key = _openai_key()
    if not api_key:
        raise VoiceProviderError("OPENAI_API_KEY no esta configurada para voz TTS.")

    payload = json.dumps(
        {
            "model": _tts_model(),
            "voice": voice or _tts_voice(),
            "input": text[:4000],
            "response_format": "mp3",
        }
    ).encode("utf-8")
    req = request.Request(
        "https://api.openai.com/v1/audio/speech",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=90) as resp:
            audio = resp.read()
    except (HTTPError, URLError, TimeoutError) as exc:
        raise VoiceProviderError(f"Fallo TTS OpenAI: {_read_error(exc)}") from exc

    return {
        "provider": "openai",
        "model": _tts_model(),
        "voice": voice or _tts_voice(),
        "mime_type": "audio/mpeg",
        "audio_base64": base64.b64encode(audio).decode("ascii"),
    }
