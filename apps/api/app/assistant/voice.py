"""
OPS-2 M4 — Voz (STT). Transcribe el audio que la familia le habla a Domi.

Con IA real (family-live + flags + key) usamos Whisper de OpenAI en NUESTRO
backend: el audio se transcribe y NO se guarda; solo devolvemos el texto para que
el usuario lo revise/corrija antes de enviarlo a Domi. Sin biometría de voz: la
identidad viene de la sesión, no del reconocimiento vocal.

Fail-closed: sin IA, formato no soportado, audio muy grande o cualquier fallo →
None (el frontend cae a texto). El TTS (Domi hablando) es del navegador, gratis.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# Formatos de audio soportados por Whisper (los comunes del navegador).
_AUDIO_MIME = {
    "webm": "audio/webm", "ogg": "audio/ogg", "oga": "audio/ogg",
    "mp3": "audio/mpeg", "m4a": "audio/mp4", "mp4": "audio/mp4",
    "wav": "audio/wav", "flac": "audio/flac",
}
_MAX_AUDIO_BYTES = 20 * 1024 * 1024  # 20 MB (Whisper admite hasta 25 MB)
_MIN_TEXT_LEN = 1


def audio_mime_for(filename: str, fallback_mime: str | None = None) -> str | None:
    import os
    suffix = os.path.splitext(filename or "")[1].lower().lstrip(".")
    return _AUDIO_MIME.get(suffix) or (fallback_mime if fallback_mime in _AUDIO_MIME.values() else None)


def stt_available() -> bool:
    try:
        from .gateway import real_provider_permitted
        if not real_provider_permitted():
            return False
        from .providers.openai_provider import OpenAIProvider
        return OpenAIProvider().is_available()
    except Exception:  # pragma: no cover - fail-closed
        return False


def transcribe(audio_bytes: bytes, filename: str, mime: str | None = None) -> str | None:
    """Devuelve el texto transcrito, o None si no aplica/falla."""
    real_mime = audio_mime_for(filename, mime)
    if not real_mime:
        return None
    if not audio_bytes or len(audio_bytes) > _MAX_AUDIO_BYTES:
        return None
    if not stt_available():
        return None
    try:
        from .providers.openai_provider import OpenAIProvider
        provider = OpenAIProvider()
        text = provider.transcribe_audio(audio_bytes=audio_bytes, filename=filename, mime=real_mime)
        text = (text or "").strip()
        if len(text) < _MIN_TEXT_LEN:
            return None
        return text
    except Exception as exc:
        logger.warning("voice: STT no utilizable (%s)", str(exc)[:120])
        return None
