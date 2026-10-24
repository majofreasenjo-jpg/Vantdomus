"""R56 offline one-shot bridge security tests, no Anthropic network."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"apps/api"))
import pytest
from app.assistant import anthropic_shadow_bridge as bridge
from app.assistant.providers.anthropic_shadow import AnthropicShadowProvider
from app.assistant.providers.base import ProviderResult, ProposedAction


@pytest.fixture(autouse=True)
def reset(monkeypatch):
    monkeypatch.setattr(bridge,"_attempted",False)
    monkeypatch.setattr(AnthropicShadowProvider,"is_available",lambda self: True)


def synthetic():
    return bridge.make_synthetic_claude_request()


def test_invalid_request_never_calls_provider(monkeypatch):
    request=synthetic()
    request.documents_excerpt="actual family data"
    monkeypatch.setattr(AnthropicShadowProvider,"propose",
        lambda self,**kw: (_ for _ in ()).throw(AssertionError("provider called")))
    result=bridge.compare_synthetic_claude(request)
    assert result["status"]=="BLOCKED"
    assert result["external_call_attempted"] is False


def test_disabled_provider_never_calls(monkeypatch):
    monkeypatch.setattr(AnthropicShadowProvider,"is_available",lambda self: False)
    result=bridge.compare_synthetic_claude(synthetic())
    assert result["status"]=="BLOCKED"
    assert result["gate"]=="local_provider_flags_required"


def test_single_valid_result_passes_gateway_without_persisting(monkeypatch):
    calls=[]
    def fake(self,**kwargs):
        calls.append(kwargs)
        self.last_usage={"prompt_tokens":50,"completion_tokens":30}
        return ProviderResult(
            reply="¿Confirmas los productos?",
            proposals=[ProposedAction(tool_name="propose_shopping_item",
                category="shopping",title="Prueba",summary="Propuesta",
                payload={"items":["pan sintético","leche sintética"]})])
    monkeypatch.setattr(AnthropicShadowProvider,"propose",fake)
    report=bridge.compare_synthetic_claude(synthetic())
    assert report["status"]=="COMPLETE"
    assert report["schema_valid"] is True
    assert report["proposed_actions"]==1
    assert report["actions_executed"]==0
    assert report["proposals_persisted"]==0
    assert report["personal_data_transmitted"] is False
    assert len(calls)==1
    assert bridge.compare_synthetic_claude(synthetic())["gate"]=="one_shot_already_attempted"


def test_bad_tool_fails_closed_and_consumes_allowance(monkeypatch):
    monkeypatch.setattr(AnthropicShadowProvider,"propose",
        lambda self,**kw: ProviderResult(reply="ok",proposals=[
            ProposedAction(tool_name="delete_all",category="shopping",
                title="fake",summary="fake",payload={})]))
    report=bridge.compare_synthetic_claude(synthetic())
    assert report["status"]=="FAILED_CLOSED"
    assert bridge.compare_synthetic_claude(synthetic())["gate"]=="one_shot_already_attempted"


def test_transport_failure_is_not_retried(monkeypatch):
    calls=[]
    def failed(self,**kw):
        calls.append(True)
        raise RuntimeError("mock-secret-will-not-appear")
    monkeypatch.setattr(AnthropicShadowProvider,"propose",failed)
    report=bridge.compare_synthetic_claude(synthetic())
    assert report["status"]=="FAILED_CLOSED"
    assert "secret" not in str(report)
    assert len(calls)==1
