"""
OPS-2 M3 — Tests del contrato de respuesta de Domi (puro, sin red).

Invariante clave: una conversación (sin propuestas) NO es accionable; una
respuesta con propuestas es accion_pendiente_de_confirmacion (nunca ejecutada en
el chat). Ejecutar: python -m pytest tests/test_response_contract.py -q
"""
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.assistant import response_contract as rc  # noqa: E402


def test_conversation_is_not_actionable():
    t = rc.classify_chat_response(blocked=None, proposals_count=0)
    assert t == rc.CONVERSATION
    assert rc.is_actionable(t) is False


def test_proposals_are_action_pending():
    t = rc.classify_chat_response(blocked=None, proposals_count=1)
    assert t == rc.ACTION_PENDING
    assert rc.is_actionable(t) is True


def test_blocked_is_information_not_action():
    t = rc.classify_chat_response(blocked="petición sensible", proposals_count=0)
    assert t == rc.INFORMATION
    assert rc.is_actionable(t) is False


def test_read_answer_is_information():
    t = rc.classify_chat_response(blocked=None, proposals_count=0, had_read_answer=True)
    assert t == rc.INFORMATION


def test_executed_type_is_actionable_but_only_after_confirm():
    # accion_ejecutada solo la emite el endpoint de confirmación, no el chat.
    assert rc.is_actionable(rc.ACTION_EXECUTED) is True
    assert rc.ACTION_EXECUTED not in {
        rc.classify_chat_response(blocked=None, proposals_count=n) for n in (0, 1, 3)
    }


def test_all_types_known():
    for t in (rc.CONVERSATION, rc.INFORMATION, rc.SUGGESTION, rc.PROPOSAL,
              rc.ACTION_PENDING, rc.ACTION_EXECUTED, rc.EXTERNAL_RESULT):
        assert t in rc.ALL_TYPES
