"""R59 reminder proposal contract; no real DB, network, or Anthropic API."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "apps/api"))

import pytest
from app.assistant.registry import get_contract, public_catalog
from app.assistant.gateway import GatewayRequest, validate_provider_output, OutputInvalid
from app.assistant.providers.base import ProviderResult, ProposedAction


def _request():
    return GatewayRequest(household_id="synthetic-h1", user_id="synthetic-u1",
                          user_message="recordatorio ficticio", synthetic=True)


def _proposal(payload):
    return ProviderResult(reply="¿Confirmas este recordatorio ficticio?",
        proposals=[ProposedAction(
            tool_name="propose_family_reminder", category="family",
            title="Reunión ficticia", summary="Pendiente de aprobación",
            payload=payload,
        )])


def test_reminder_requires_human_confirmation_and_member_role():
    contract=get_contract("propose_family_reminder")
    assert contract.kind=="write"
    assert contract.required_role=="member"
    assert contract.requires_confirmation is True
    assert contract.sensitive is True
    assert contract.writes_memory is False
    assert "family_reminders" in contract.side_effects
    assert "remind_at" in contract.input_schema["required"]
    assert "propose_family_reminder" in {item["name"] for item in public_catalog()}


def test_reminder_proposal_only_no_execution():
    result=_proposal({"title":"Reunión ficticia",
        "remind_at":"2026-11-10T19:00:00-03:00"})
    _, proposals, blocked=validate_provider_output(result,_request())
    assert blocked is None
    assert len(proposals)==1
    assert proposals[0].payload["remind_at"].endswith("-03:00")


@pytest.mark.parametrize("payload",[
    {"title":"Ejemplo", "remind_at":"2026-11-10T19:00:00-03:00",
     "household_id":"other"},
    {"title":"Ejemplo", "remind_at":123},
    {"title":"Ejemplo", "remind_at":"2026-11-10T19:00:00-03:00",
     "unknown_field":"bad"},
])
def test_invalid_payloads_blocked_by_existing_gateway(payload):
    with pytest.raises(OutputInvalid):
        validate_provider_output(_proposal(payload),_request())
