"""
OPS-1.D — OCR de imágenes/fotos para la Bandeja de Documentos.

Antes, una foto de boleta/circular quedaba en "revisión manual" (sin lectura).
Con IA real (family-live + flags + key) transcribimos el texto de la imagen por
visión y lo entregamos al MISMO clasificador por reglas + confirmación humana.

Fail-closed: sin IA, imagen no soportada, o cualquier fallo → devuelve None y el
flujo cae al comportamiento previo (pendiente de revisión manual). El OCR SOLO
transcribe; no clasifica, no decide rutas, no escribe DB.
"""

from __future__ import annotations

import base64
import logging
import os

logger = logging.getLogger(__name__)

# Formatos de imagen que enviamos a visión. HEIC/otros: no soportados → None.
_IMAGE_MIME = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "gif": "image/gif",
}
_MAX_IMAGE_BYTES = 8 * 1024 * 1024  # límite defensivo para la carga a visión
_MIN_TEXT_LEN = 8                   # menos que esto = OCR sin contenido útil


def image_mime_for(filename: str) -> str | None:
    suffix = os.path.splitext(filename or "")[1].lower().lstrip(".")
    return _IMAGE_MIME.get(suffix)


def ocr_available() -> bool:
    """¿Hay proveedor real alcanzable? Reusa el gate del gateway + is_available."""
    try:
        from .gateway import real_provider_permitted
        if not real_provider_permitted():
            return False
        from .providers.openai_provider import OpenAIProvider
        return OpenAIProvider().is_available()
    except Exception:  # pragma: no cover - fail-closed
        return False


def ocr_image_text(data: bytes, filename: str) -> str | None:
    """
    Devuelve el texto transcrito de una imagen, o None si no aplica/falla.
    None ⇒ el caller mantiene el comportamiento de "revisión manual".
    """
    mime = image_mime_for(filename)
    if not mime:
        return None  # no es una imagen soportada
    if not data or len(data) > _MAX_IMAGE_BYTES:
        return None
    if not ocr_available():
        return None
    try:
        from .providers.openai_provider import OpenAIProvider
        provider = OpenAIProvider()
        image_b64 = base64.b64encode(data).decode("ascii")
        text = provider.vision_extract_text(image_b64=image_b64, mime=mime)
        text = (text or "").strip()
        if len(text) < _MIN_TEXT_LEN:
            return None
        return text
    except Exception as exc:
        logger.warning("document_ocr: OCR no utilizable (%s)", str(exc)[:120])
        return None
