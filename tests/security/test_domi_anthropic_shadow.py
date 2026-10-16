"""R55 offline security regression for the Claude synthetic-only adapter."""
from __future__ import annotations
import sys
from pathlib import Path
import pytest

ROOT=Path(__file__).resolve().parents[2]/"apps/api"
sys.path.insert(0,str(ROOT))
from app.assistant.providers.anthropic_shadow import (
    AnthropicShadowProvider,is_exact_synthetic_fixture,_CONTEXT,_PROMPT
)
from app.assistant.gateway import GatewayRequest,validate_provider_output
from app.assistant.registry import public_catalog


@pytest.fixture
def enabled(monkeypatch):
    for k,v in {
        "APP_ENV":"local","ASSISTANT_PROVIDER_MODE":"anthropic",
        "ASSISTANT_REAL_PROVIDER_ENABLED":"true",
        "ASSISTANT_EXTERNAL_CALLS_ALLOWED":"true",
        "ASSISTANT_SHADOW_MODE":"true",
        "DOMI_ANTHROPIC_PROMO_ONE_SHOT":"1",
        "ANTHROPIC_API_KEY":"fake-never-valid-ci",
    }.items():
        monkeypatch.setenv(k,v)
    return monkeypatch


def request(synthetic=True):
    return GatewayRequest(
        household_id="hogar-sintetico-prueba",
        user_id="usuario-sintetico-prueba",
        user_message=_PROMPT,home_context=dict(_CONTEXT),synthetic=synthetic,
    )


def good(action="propose_shopping_item",items=None,confirm=True):
    import json
    if items is None:items=["pan sintético","leche sintética"]
    return {"stop_reason":"end_turn",
        "content":[{"type":"text","text":json.dumps({
            "reply":"Puedo proponerlo, si confirmas.", "action":action,
            "items":items,"requires_confirmation":confirm})}],
        "usage":{"input_tokens":80,"output_tokens":40}}


def test_no_flags_no_network(monkeypatch):
    for k in ("ANTHROPIC_API_KEY","DOMI_ANTHROPIC_PROMO_ONE_SHOT",
              "ASSISTANT_REAL_PROVIDER_ENABLED","ASSISTANT_EXTERNAL_CALLS_ALLOWED"):
        monkeypatch.delenv(k,raising=False)
    adapter=AnthropicShadowProvider()
    monkeypatch.setattr(adapter,"_transport",
        lambda *_a,**_k: (_ for _ in ()).throw(AssertionError("network called")))
    with pytest.raises(RuntimeError,match="CLOSED"):
        adapter.propose(user_message=_PROMPT,context=_CONTEXT,catalog=public_catalog())


def test_only_exact_fixture_accepted(enabled,monkeypatch):
    adapter=AnthropicShadowProvider()
    monkeypatch.setattr(adapter,"_transport",
        lambda *_a,**_k: (_ for _ in ()).throw(AssertionError("network called")))
    for message,context in [
        ("texto de una familia real",_CONTEXT),
        (_PROMPT,{"memories":["private"]}),
    ]:
        with pytest.raises(RuntimeError,match="FIXTURE_ONLY"):
            adapter.propose(user_message=message,context=context,catalog=public_catalog())
    assert is_exact_synthetic_fixture(request())
    assert not is_exact_synthetic_fixture(request(False))
    bad=request();bad.documents_excerpt="datos personales"
    assert not is_exact_synthetic_fixture(bad)


def test_valid_proposal_uses_gateway_no_write(enabled,monkeypatch):
    adapter=AnthropicShadowProvider()
    calls=[]
    monkeypatch.setattr(adapter,"_transport",
        lambda payload,timeout:(calls.append(payload),good())[1])
    result=adapter.propose(user_message=_PROMPT,context=_CONTEXT,
                           catalog=public_catalog())
    reply,proposals,blocked=validate_provider_output(result,request())
    assert reply and blocked is None
    assert len(proposals)==1 and proposals[0].tool_name=="propose_shopping_item"
    assert proposals[0].payload["items"]==["pan sintético","leche sintética"]
    assert len(calls)==1 and calls[0]["max_tokens"]==256
    assert adapter.last_usage["total_tokens"]==120
    assert adapter.estimated_cost_usd()==0.00028
    assert "fake-never-valid-ci" not in str(calls[0])


@pytest.mark.parametrize("response",[
    good(items=["secreto"]),
    good(confirm=False),
    good(action="none",items=["pan sintético"],confirm=False),
    good(action="propose_shopping_item",items=[],confirm=True),
    {"stop_reason":"max_tokens","content":[],"usage":{}},
])
def test_untrusted_model_response_fails_closed(response):
    with pytest.raises(ValueError):
        AnthropicShadowProvider()._parse_strict(response)


def test_no_external_production_or_family_live(enabled):
    adapter=AnthropicShadowProvider()
    enabled.setenv("APP_ENV","family-live")
    assert not adapter.is_available()
    enabled.setenv("APP_ENV","production")
    assert not adapter.is_available()
