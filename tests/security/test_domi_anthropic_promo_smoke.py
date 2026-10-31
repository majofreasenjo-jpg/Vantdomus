"""R52 zero-network verification of Anthropic promotional one-shot."""
from __future__ import annotations
import importlib.util
from pathlib import Path
from datetime import date

FILE=Path(__file__).resolve().parents[2]/"tools/domi_anthropic_promo_smoke.py"
spec=importlib.util.spec_from_file_location("domi_promo",FILE)
promo=importlib.util.module_from_spec(spec)
spec.loader.exec_module(promo)


def test_default_cannot_make_external_calls(monkeypatch):
    monkeypatch.delenv("DOMI_ANTHROPIC_PROMO_ONE_SHOT",raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY",raising=False)
    monkeypatch.setattr(promo,"_transport",lambda *_: (_ for _ in ()).throw(
        AssertionError("network was called")))
    assert promo.run_once()["status"]=="DRY_RUN_NO_EXTERNAL_REQUEST"


def test_expired_or_wrong_env_blocks(monkeypatch):
    monkeypatch.setenv("APP_ENV","local")
    monkeypatch.setenv("ANTHROPIC_API_KEY","fake-ci-only-value")
    monkeypatch.setenv("DOMI_ANTHROPIC_PROMO_ONE_SHOT","1")
    assert promo._is_enabled(utc_today=date(2026,11,14)) is False
    monkeypatch.setenv("APP_ENV","production")
    assert promo._is_enabled(utc_today=date(2026,10,16)) is False


def test_payload_is_synthetic_and_bounded(monkeypatch):
    monkeypatch.delenv("DOMI_ANTHROPIC_PROMO_MODEL",raising=False)
    payload=promo._request_payload()
    assert payload["max_tokens"]<=256
    assert payload["model"] in promo.MODELS
    assert "api" not in str(payload).lower()
    assert len(payload["messages"])==1


def test_mock_transport_sanitizes_usage(monkeypatch):
    monkeypatch.setenv("APP_ENV","local")
    monkeypatch.setenv("ANTHROPIC_API_KEY","fake-ci-only-value")
    monkeypatch.setenv("DOMI_ANTHROPIC_PROMO_ONE_SHOT","1")
    monkeypatch.setattr(promo,"_transport",lambda _: {
        "stop_reason":"end_turn",
        "content":[{"type":"text","text":(
            '{"reply":"Puedo proponerlo.",'
            '"proposed_action":"add_shopping_item",'
            '"requires_confirmation":true}')}],
        "usage":{"input_tokens":31,"output_tokens":20},
    })
    result=promo.run_once()
    assert result["status"]=="COMPLETE_SYNTHETIC_ONLY"
    assert result["actions_executed"]==0
    assert result["personal_data_sent"] is False
    assert "reply" not in result


def test_invalid_or_unauthorized_output_fails_closed():
    import pytest
    with pytest.raises(ValueError):
        promo._sanitize_response({
            "stop_reason":"end_turn",
            "content":[{"type":"text","text":(
                '{"reply":"Listo, lo guardé",'
                '"proposed_action":"add_shopping_item",'
                '"requires_confirmation":false}')}],
            "usage":{"input_tokens":12,"output_tokens":30}},promo.MODELS[0])
