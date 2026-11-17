"""DOMI R102: fully offline Anthropic family adapter gates and causal safeguards."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "apps" / "api"))

from app.assistant.providers.anthropic_provider import AnthropicFamilyProvider
from app.assistant.gateway import GatewayRequest, select_provider, validate_provider_output
from app.assistant.providers.mock import MockProvider
from app.assistant.registry import public_catalog

BASE = {
    "stop_reason": "end_turn",
    "content": [{"type": "text", "text": json.dumps({
        "reply": "Puedo ayudarte a organizarlo.",
        "tool": "",
        "payload_json": "{}",
        "blocked_reason": "",
    })}],
    "usage": {"input_tokens": 25, "output_tokens": 12},
}


@pytest.fixture
def enabled(monkeypatch):
    import app.config as cfg
    monkeypatch.setattr(cfg.settings, "APP_ENV", "family-live")
    for k, v in {
        "ASSISTANT_PROVIDER_MODE": "anthropic",
        "ASSISTANT_REAL_PROVIDER_ENABLED": "true",
        "ASSISTANT_EXTERNAL_CALLS_ALLOWED": "true",
        "DOMI_ANTHROPIC_FAMILY_OPT_IN": "true",
        "ANTHROPIC_API_KEY": "fake-never-valid-ci",
        "ANTHROPIC_MODEL": "claude-sonnet-4-6",
    }.items():
        monkeypatch.setenv(k, v)
    yield monkeypatch


def test_closed_without_flags_and_key(monkeypatch):
    import app.config as cfg
    monkeypatch.setattr(cfg.settings, "APP_ENV", "family-live")
    for k in ("ASSISTANT_PROVIDER_MODE", "ASSISTANT_REAL_PROVIDER_ENABLED",
              "ASSISTANT_EXTERNAL_CALLS_ALLOWED", "DOMI_ANTHROPIC_FAMILY_OPT_IN",
              "ANTHROPIC_API_KEY"):
        monkeypatch.delenv(k, raising=False)
    provider = AnthropicFamilyProvider()
    assert not provider.is_available()
    assert isinstance(select_provider(), MockProvider)
    with pytest.raises(RuntimeError, match="DISABLED"):
        provider.propose(user_message="hola", context={}, catalog=[])


def test_family_pilot_never_calls_real(enabled):
    import app.config as cfg
    enabled.setattr(cfg.settings, "APP_ENV", "family-pilot")
    assert isinstance(select_provider(), MockProvider)
    assert not AnthropicFamilyProvider().is_available()


def test_gated_selected_only_with_opt_in(enabled):
    assert isinstance(select_provider(), AnthropicFamilyProvider)
    enabled.delenv("DOMI_ANTHROPIC_FAMILY_OPT_IN")
    assert isinstance(select_provider(), MockProvider)


def test_valid_reply_no_action_no_network(enabled):
    provider = AnthropicFamilyProvider()
    captured = []
    provider._transport = lambda body, timeout: (captured.append(body), BASE)[1]
    out = provider.propose(
        user_message="hola",
        context={"persons": [], "summary_text": "ejemplo", "memories": []},
        catalog=public_catalog(),
    )
    assert out.reply == "Puedo ayudarte a organizarlo."
    assert out.proposals == []
    assert captured[0]["messages"][0]["role"] == "user"
    assert captured[0]["output_config"]["format"]["type"] == "json_schema"
    assert "fake-never-valid-ci" not in json.dumps(captured)


def test_proposed_action_requires_gateway_validation(enabled):
    provider = AnthropicFamilyProvider()
    raw = dict(BASE)
    raw["content"] = [{"type": "text", "text": json.dumps({
        "reply": "Te propongo agregarlo, previa confirmacion.",
        "tool": "propose_shopping_item",
        "payload_json": json.dumps({"items": ["pan"]}),
        "blocked_reason": "",
    })}]
    provider._transport = lambda *_a, **_k: raw
    out = provider.propose(user_message="agrega pan", context={"persons": []},
                           catalog=public_catalog())
    req = GatewayRequest(household_id="h", user_id="u", user_message="agrega pan",
                         home_context={"persons": []})
    _, props, _ = validate_provider_output(out, req)
    assert len(props) == 1
    assert props[0].tool_name == "propose_shopping_item"


@pytest.mark.parametrize("raw", [
    {"stop_reason": "max_tokens", "content": [], "usage": {}},
    dict(BASE, content=[{"type": "text", "text": "not-json"}]),
    dict(BASE, content=[{"type": "text", "text": json.dumps({
        "reply": "OK", "tool": "unknown_tool", "payload_json": "{}",
        "blocked_reason": "",
    })}]),
    dict(BASE, content=[{"type": "text", "text": json.dumps({
        "reply": "OK", "tool": "", "payload_json": "{\"secret\":\"x\"}",
        "blocked_reason": "",
    })}]),
])
def test_invalid_model_output_fails_closed(raw):
    with pytest.raises(ValueError):
        AnthropicFamilyProvider()._parse(raw, {
            x["name"]: x for x in public_catalog() if x.get("kind") == "write"
        })


def test_context_budget_must_be_server_enforced(enabled):
    provider = AnthropicFamilyProvider()
    provider._transport = lambda *_a, **_k: (_ for _ in ()).throw(
        AssertionError("network should not be attempted")
    )
    with pytest.raises(ValueError, match="CONTEXT_TOO_LARGE"):
        provider.propose(user_message="hola", context={"summary_text": "x" * 5000},
                         catalog=public_catalog())
