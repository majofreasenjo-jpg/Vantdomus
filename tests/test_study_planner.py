"""
OPS-1.C — Tests del planificador de estudio (sin red).

Cubre: modo plantilla determinista, modo IA con transporte falso, fallback
seguro ante salida inválida del modelo, y que family-pilot NUNCA alcanza la IA.
Ejecutar: python -m pytest tests/test_study_planner.py -q
"""
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest


def _future(days: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d")

API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    for k in (
        "ASSISTANT_PROVIDER_MODE", "ASSISTANT_REAL_PROVIDER_ENABLED",
        "ASSISTANT_EXTERNAL_CALLS_ALLOWED", "ASSISTANT_SHADOW_MODE", "OPENAI_API_KEY",
    ):
        monkeypatch.delenv(k, raising=False)
    yield


def _set_app_env(monkeypatch, env):
    """Fija APP_ENV tanto en el proceso como en el objeto settings ya importado
    (que cachea APP_ENV al construirse)."""
    monkeypatch.setenv("APP_ENV", env)
    import app.config as cfg
    monkeypatch.setattr(cfg.settings, "APP_ENV", env)


def _enable_real_ai(monkeypatch, env="family-live"):
    _set_app_env(monkeypatch, env)
    monkeypatch.setenv("ASSISTANT_PROVIDER_MODE", "openai")
    monkeypatch.setenv("ASSISTANT_REAL_PROVIDER_ENABLED", "true")
    monkeypatch.setenv("ASSISTANT_EXTERNAL_CALLS_ALLOWED", "true")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-TESTPLACEHOLDER-not-real")


def _fake_transport(content: str):
    def _t(self, payload, timeout):
        return {
            "usage": {"prompt_tokens": 100, "completion_tokens": 80},
            "choices": [{"message": {"content": content}}],
        }
    return _t


def test_template_mode_without_ai(monkeypatch):
    _set_app_env(monkeypatch, "family-live")  # sin flags de IA → plantilla
    from app.assistant.study_planner import build_study_steps, study_ai_available
    assert study_ai_available() is False
    steps, mode = build_study_steps(
        source_text="Prueba de Álgebra el 15/09",
        subject="Álgebra", student="Diego", due_date="", evaluation_title="Prueba", notes="",
    )
    assert mode == "template"
    assert len(steps) == 5
    assert all(s["priority"] in ("low", "medium", "high") for s in steps)
    assert all("estudio" in s["tags"] for s in steps)


def test_ai_mode_with_fake_transport(monkeypatch):
    _enable_real_ai(monkeypatch)
    from app.assistant.providers import openai_provider as op
    content = (
        '{"subjects": ["Álgebra", "Historia"], "steps": ['
        f'{{"title": "Diagnóstico Álgebra", "date": "{_future(20)}", "priority": "medium", "tag": "diagnostico"}},'
        f'{{"title": "Práctica guiada", "date": "{_future(27)}", "priority": "high", "tag": "practica"}},'
        f'{{"title": "Ensayo Historia", "date": "{_future(33)}", "priority": "medium", "tag": "resumen"}}]}}'
    )
    monkeypatch.setattr(op.OpenAIProvider, "_transport", _fake_transport(content))
    from app.assistant.study_planner import build_study_steps, study_ai_available
    assert study_ai_available() is True
    steps, mode = build_study_steps(
        source_text="Prueba Álgebra 15/09; ensayo Historia 20/09",
        subject="Álgebra", student="Diego", due_date="", evaluation_title="Prueba", notes="",
    )
    assert mode == "ai"
    assert len(steps) == 3
    assert steps[0]["title"].startswith("Diagnóstico")


def test_ai_invalid_output_falls_back_to_template(monkeypatch):
    _enable_real_ai(monkeypatch)
    from app.assistant.providers import openai_provider as op
    # Salida basura del modelo (no JSON estricto) → fallback a plantilla.
    monkeypatch.setattr(op.OpenAIProvider, "_transport", _fake_transport("lo siento, no puedo"))
    from app.assistant.study_planner import build_study_steps
    steps, mode = build_study_steps(
        source_text="Prueba el 10/10", subject="Química", student="Ana",
        due_date="", evaluation_title="Prueba", notes="",
    )
    assert mode == "template"
    assert len(steps) >= 1


def test_ai_empty_steps_falls_back(monkeypatch):
    _enable_real_ai(monkeypatch)
    from app.assistant.providers import openai_provider as op
    monkeypatch.setattr(op.OpenAIProvider, "_transport",
                        _fake_transport('{"subjects": [], "steps": []}'))
    from app.assistant.study_planner import build_study_steps
    _steps, mode = build_study_steps(
        source_text="sin fechas", subject="", student="", due_date="2099-11-01",
        evaluation_title="Entrega", notes="",
    )
    assert mode == "template"


def test_ai_past_and_out_of_range_dates_dropped(monkeypatch):
    _enable_real_ai(monkeypatch)
    from app.assistant.providers import openai_provider as op
    content = (
        '{"subjects": ["Bio"], "steps": ['
        '{"title": "Paso pasado", "date": "1999-01-01", "priority": "low", "tag": "otro"},'
        f'{{"title": "Paso lejano", "date": "{_future(500)}", "priority": "low", "tag": "otro"}},'
        f'{{"title": "Paso válido", "date": "{_future(30)}", "priority": "high", "tag": "practica"}}]}}'
    )
    monkeypatch.setattr(op.OpenAIProvider, "_transport", _fake_transport(content))
    from app.assistant.study_planner import build_study_steps
    steps, mode = build_study_steps(
        source_text="x", subject="Biología", student="Leo", due_date="",
        evaluation_title="Prueba", notes="",
    )
    # Solo el paso válido sobrevive → sigue siendo modo IA (>=1 válido).
    assert mode == "ai"
    assert len(steps) == 1
    assert steps[0]["title"] == "Paso válido"


def test_family_pilot_never_uses_ai(monkeypatch):
    # Aunque estuvieran los flags, family-pilot no permite el proveedor real.
    _enable_real_ai(monkeypatch, env="family-pilot")
    from app.assistant.study_planner import study_ai_available
    assert study_ai_available() is False
