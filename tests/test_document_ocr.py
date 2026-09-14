"""
OPS-1.D — Tests del OCR de documentos por visión (sin red).

Cubre: sin IA → None; archivo no-imagen → None; imagen + IA (transporte de
visión falso) → texto; salida vacía/corta → None; family-pilot nunca OCR.
Ejecutar: python -m pytest tests/test_document_ocr.py -q
"""
import sys
from pathlib import Path

import pytest

API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64  # bytes de imagen simulados (basta el sufijo)


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    for k in ("ASSISTANT_PROVIDER_MODE", "ASSISTANT_REAL_PROVIDER_ENABLED",
              "ASSISTANT_EXTERNAL_CALLS_ALLOWED", "OPENAI_API_KEY"):
        monkeypatch.delenv(k, raising=False)
    yield


def _set_app_env(monkeypatch, env):
    monkeypatch.setenv("APP_ENV", env)
    import app.config as cfg
    monkeypatch.setattr(cfg.settings, "APP_ENV", env)


def _enable_real_ai(monkeypatch, env="family-live"):
    _set_app_env(monkeypatch, env)
    monkeypatch.setenv("ASSISTANT_PROVIDER_MODE", "openai")
    monkeypatch.setenv("ASSISTANT_REAL_PROVIDER_ENABLED", "true")
    monkeypatch.setenv("ASSISTANT_EXTERNAL_CALLS_ALLOWED", "true")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-TESTPLACEHOLDER-not-real")


def _fake_vision(text: str):
    def _t(self, payload, timeout):
        # Verifica que se envió una imagen data-uri (contrato de visión).
        msgs = payload.get("messages", [])
        assert any(
            isinstance(m.get("content"), list)
            and any(part.get("type") == "image_url" for part in m["content"])
            for m in msgs
        ), "el payload de visión debe incluir image_url"
        return {"usage": {"prompt_tokens": 50, "completion_tokens": 40},
                "choices": [{"message": {"content": text}}]}
    return _t


def test_no_ai_returns_none(monkeypatch):
    _set_app_env(monkeypatch, "family-live")  # sin flags
    from app.assistant.document_ocr import ocr_image_text, ocr_available
    assert ocr_available() is False
    assert ocr_image_text(_PNG, "boleta.png") is None


def test_non_image_returns_none(monkeypatch):
    _enable_real_ai(monkeypatch)
    from app.assistant.document_ocr import ocr_image_text
    # PDF/otros no pasan por OCR de visión (los maneja _extract_text).
    assert ocr_image_text(b"%PDF-1.4 ...", "circular.pdf") is None
    assert ocr_image_text(b"algo", "notas.txt") is None


def test_image_with_ai_returns_text(monkeypatch):
    _enable_real_ai(monkeypatch)
    from app.assistant.providers import openai_provider as op
    monkeypatch.setattr(op.OpenAIProvider, "_transport",
                        _fake_vision("LIDER\nLeche 1.290\nTOTAL 1.290"))
    from app.assistant.document_ocr import ocr_image_text, ocr_available
    assert ocr_available() is True
    text = ocr_image_text(_PNG, "boleta_foto.jpg")
    assert text is not None
    assert "Leche" in text


def test_image_empty_ocr_returns_none(monkeypatch):
    _enable_real_ai(monkeypatch)
    from app.assistant.providers import openai_provider as op
    monkeypatch.setattr(op.OpenAIProvider, "_transport", _fake_vision("   "))
    from app.assistant.document_ocr import ocr_image_text
    assert ocr_image_text(_PNG, "vacia.png") is None


def test_oversize_image_returns_none(monkeypatch):
    _enable_real_ai(monkeypatch)
    from app.assistant.document_ocr import ocr_image_text
    big = b"\x00" * (9 * 1024 * 1024)  # > 8 MB
    assert ocr_image_text(big, "grande.png") is None


def test_family_pilot_never_ocr(monkeypatch):
    _enable_real_ai(monkeypatch, env="family-pilot")
    from app.assistant.document_ocr import ocr_available
    assert ocr_available() is False
