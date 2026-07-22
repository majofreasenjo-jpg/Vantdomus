"""
OPS-2 M4 — Tests del STT de voz (sin red).

Cubre: sin IA → None; formato no-audio → None; audio + IA (transporte multipart
falso) → texto; audio sobredimensionado → None; family-pilot nunca transcribe.
Ejecutar: python -m pytest tests/test_domi_voice.py -q
"""
import sys
from pathlib import Path

import pytest

API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

_AUDIO = b"\x1aE\xdf\xa3" + b"\x00" * 128  # bytes de audio simulados (basta el sufijo)


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


def _fake_multipart(text):
    def _t(self, path, fields, **kw):
        assert path.endswith("/audio/transcriptions")
        assert fields.get("model")
        assert kw.get("file_bytes")  # se envió el audio
        return {"text": text}
    return _t


def test_no_ai_returns_none(monkeypatch):
    _set_app_env(monkeypatch, "family-live")  # sin flags
    from app.assistant.voice import transcribe, stt_available
    assert stt_available() is False
    assert transcribe(_AUDIO, "nota.webm") is None


def test_non_audio_returns_none(monkeypatch):
    _enable_real_ai(monkeypatch)
    from app.assistant.voice import transcribe
    assert transcribe(b"...", "documento.pdf") is None


def test_audio_with_ai_returns_text(monkeypatch):
    _enable_real_ai(monkeypatch)
    from app.assistant.providers import openai_provider as op
    monkeypatch.setattr(op.OpenAIProvider, "_transport_multipart", _fake_multipart("agrega leche a la lista"))
    from app.assistant.voice import transcribe, stt_available
    assert stt_available() is True
    text = transcribe(_AUDIO, "nota.webm", "audio/webm")
    assert text == "agrega leche a la lista"


def test_empty_transcription_returns_none(monkeypatch):
    _enable_real_ai(monkeypatch)
    from app.assistant.providers import openai_provider as op
    monkeypatch.setattr(op.OpenAIProvider, "_transport_multipart", _fake_multipart("   "))
    from app.assistant.voice import transcribe
    assert transcribe(_AUDIO, "nota.webm") is None


def test_oversize_audio_returns_none(monkeypatch):
    _enable_real_ai(monkeypatch)
    from app.assistant.voice import transcribe
    big = b"\x00" * (21 * 1024 * 1024)  # > 20 MB
    assert transcribe(big, "larga.webm") is None


def test_family_pilot_never_transcribes(monkeypatch):
    _enable_real_ai(monkeypatch, env="family-pilot")
    from app.assistant.voice import stt_available
    assert stt_available() is False
