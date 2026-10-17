"""DOMI R56: a one-shot, synthetic-only Claude -> existing Gateway validation bridge.

No HTTP endpoint calls this function; regular family chat remains unchanged.
The caller cannot supply a different model prompt/household/documents/memory.
Even a failed external attempt exhausts the process-local one-shot allowance.
This is a prototype guard, NOT a billing quota or an inter-process limiter.
"""
from __future__ import annotations

from copy import deepcopy
import threading

from .gateway import GatewayRequest, validate_provider_output
from .providers import MockProvider
from .providers.anthropic_shadow import (
    AnthropicShadowProvider,
    _CONTEXT,
    _PROMPT,
    is_exact_synthetic_fixture,
)
from .registry import public_catalog

_ATTEMPT_LOCK = threading.Lock()
_attempted = False


def make_synthetic_claude_request() -> GatewayRequest:
    """Return the only authorized input for the prototype comparison."""
    return GatewayRequest(
        household_id="hogar-sintetico-prueba",
        user_id="usuario-sintetico-prueba",
        user_message=_PROMPT,
        home_context=deepcopy(_CONTEXT),
        documents_excerpt="",
        synthetic=True,
    )


def _base_report() -> dict:
    return {
        "provider": "anthropic-shadow",
        "mode": "synthetic_gateway_only",
        "external_call_attempted": False,
        "schema_valid": False,
        "actions_executed": 0,
        "proposals_persisted": 0,
        "personal_data_transmitted": False,
    }


def compare_synthetic_claude(request: GatewayRequest) -> dict:
    """Run at most one live call per process through the DOMI proposal schema.

    No DB handle is accepted. This returns sanitized metrics, never the
    model's original text or a credential. Connection errors fail closed.
    """
    global _attempted

    report = _base_report()
    if not is_exact_synthetic_fixture(request):
        report.update(status="BLOCKED", gate="synthetic_fixture_required")
        return report

    adapter = AnthropicShadowProvider()
    if not adapter.is_available():
        report.update(status="BLOCKED", gate="local_provider_flags_required")
        return report

    # This guard is process-local, and does NOT replace a server-side budget.
    # Mark BEFORE the network call. Failures and timeouts are never retried.
    with _ATTEMPT_LOCK:
        if _attempted:
            report.update(status="BLOCKED", gate="one_shot_already_attempted")
            return report
        _attempted = True

    report["external_call_attempted"] = True
    try:
        catalog = public_catalog()
        raw = adapter.propose(
            user_message=_PROMPT, context=deepcopy(_CONTEXT), catalog=catalog,
        )
        _, proposals, blocked = validate_provider_output(raw, request)
        if len(proposals) > 1:
            raise ValueError("SHADOW_MORE_THAN_ONE_PROPOSAL")

        # Local deterministic reference: NO network, NO state mutation.
        mock = MockProvider().propose(
            user_message=_PROMPT, context=deepcopy(_CONTEXT), catalog=catalog,
        )
        _, mock_proposals, _ = validate_provider_output(mock, request)

        report.update(
            status="COMPLETE",
            schema_valid=True,
            proposed_actions=len(proposals),
            mock_proposed_actions=len(mock_proposals),
            same_tool=bool(
                proposals and mock_proposals
                and proposals[0].tool_name == mock_proposals[0].tool_name
            ),
            blocked_by_model=bool(blocked),
            model=adapter.model,
            input_tokens=adapter.last_usage["prompt_tokens"],
            output_tokens=adapter.last_usage["completion_tokens"],
            estimated_list_cost_usd=adapter.estimated_cost_usd(),
        )
    except Exception:
        # Do NOT expose user/model strings, body, URL, key, or raw HTTP errors.
        report.update(status="FAILED_CLOSED", gate="provider_or_schema_error")
    return report
