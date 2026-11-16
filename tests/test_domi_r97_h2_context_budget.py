"""DOMI R97 H2: verify the four-thousand-character household-context budget.

Only local, synthetic GatewayRequest data. No calls to any provider or database.
Run: python -m pytest tests/test_domi_r97_h2_context_budget.py -q
"""
import json
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.assistant.gateway import (  # noqa: E402
    GatewayRequest, build_provider_payload, MAX_CONTEXT_CHARS,
    MAX_USER_CHARS, MAX_DOC_CHARS,
)


def _request(home_context, *, user_message="hola", documents_excerpt=""):
    return GatewayRequest(
        household_id="hogar-sintetico", user_id="usuario-sintetico",
        user_message=user_message, home_context=home_context,
        documents_excerpt=documents_excerpt,
    )


def _context(request):
    return build_provider_payload(request)["household_data"]


def _serialized_chars(ctx):
    # Transport over JSON. Escape sequences must also count against the budget.
    return len(json.dumps(ctx, ensure_ascii=True, separators=(",", ":")))


def test_budget_at_exact_boundary_is_preserved():
    base = {"summary_text": ""}
    remaining = MAX_CONTEXT_CHARS - _serialized_chars(base)
    ctx = _context(_request({"summary_text": "X" * remaining}))
    assert ctx["summary_text"] == "X" * remaining
    assert _serialized_chars(ctx) <= MAX_CONTEXT_CHARS


def test_overfilled_memories_drop_tail_and_keep_high_priority():
    memories = [
        {"about": f"Persona{i}", "note": "dato" + "A" * 180, "type": "preference"}
        for i in range(45)
    ]
    ctx = _context(_request({
        "persons": [{"id": "p", "name": "Persona"}],
        "summary_text": "Resumen seguro",
        "memories": memories,
    }))
    assert 0 < len(ctx["memories"]) < len(memories)
    assert ctx["memories"][0] == memories[0]
    assert ctx["memories"] == memories[:len(ctx["memories"])]
    assert ctx["summary_text"] == "Resumen seguro"
    assert _serialized_chars(ctx) <= MAX_CONTEXT_CHARS


def test_oversized_summary_reduced_after_memories_and_does_not_escape_budget():
    ctx = _context(_request({
        "persons": [{"id": "p", "name": "Ana"}],
        "memories": [{"about": "Ana", "note": "dato", "type": "preference"}],
        "summary_text": "S" * (MAX_CONTEXT_CHARS + 500),
    }))
    assert 0 < len(ctx["summary_text"]) < MAX_CONTEXT_CHARS + 500
    assert ctx["summary_text"].startswith("S")
    assert ctx.get("memories") == []
    assert _serialized_chars(ctx) <= MAX_CONTEXT_CHARS


def test_massive_person_list_is_trimmed_and_no_unknown_fields_leak():
    persons = [{"id": str(i), "name": "N" * 100} for i in range(100)]
    ctx = _context(_request({
        "persons": persons,
        "summary_text": "",
        "secret_token": "NEVER_TRANSMIT_ME",
    }))
    assert ctx["persons"] == persons[:len(ctx["persons"])]
    assert len(ctx["persons"]) < len(persons)
    assert "secret_token" not in ctx
    assert _serialized_chars(ctx) <= MAX_CONTEXT_CHARS


def test_single_extreme_item_causes_fail_closed_fallback():
    ctx = _context(_request({
        "persons": [{"id": "p", "name": "X" * 10000}],
        "summary_text": "",
    }))
    assert "X" * 10000 not in str(ctx)
    assert _serialized_chars(ctx) <= MAX_CONTEXT_CHARS


def test_json_escaping_does_not_exceed_actual_transport_budget():
    # Old len(str(dict)) check undercounts JSON escaping of Unicode accents.
    ctx = _context(_request({"summary_text": "á" * 1500}))
    assert _serialized_chars(ctx) <= MAX_CONTEXT_CHARS


def test_documents_and_user_have_separate_limits_and_are_not_in_household_data():
    payload = build_provider_payload(_request(
        {"summary_text": "resumen", "untrusted_secret": "DO_NOT_INCLUDE"},
        user_message="U" * 5000, documents_excerpt="D" * 5000,
    ))
    assert len(payload["user_message"]) == MAX_USER_CHARS
    assert len(payload["documents_untrusted"]) == MAX_DOC_CHARS
    assert payload["household_data"] == {"summary_text": "resumen"}
    assert _serialized_chars(payload["household_data"]) <= MAX_CONTEXT_CHARS
    # H2 is a context limit, not a total serialized provider-payload limit.
    assert len(json.dumps(payload, ensure_ascii=True)) > MAX_CONTEXT_CHARS
