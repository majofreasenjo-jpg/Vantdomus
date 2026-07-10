"""
Tests for the assistant tool dispatcher in apps/api/app/assistant/tools.py.

The previous version used consecutive `if` statements instead of `elif`,
which meant that if a future contributor added side-effect-producing
checks they would all run for every call. It also depended on `result`
being set by exactly one branch, which made the function brittle: an
unknown tool name would leave `result` unbound when the audit-log call
referenced it.

The fix:
  * each branch uses `elif` (mutually exclusive)
  * `result` is pre-declared to the unknown-tool error
  * the audit log path always sees a defined `result`
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest


API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"


@pytest.fixture
def tools_module(monkeypatch, tmp_path):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "dispatcher.db"))
    monkeypatch.setenv("JWT_SECRET", "dispatcher-test-secret-32-chars-long")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "dispatcher-test-mfa-secret-32-chars")
    # CP1c-FUNC-MIN-3.1 — la ejecución directa legacy quedó neutralizada por
    # defecto. Estos tests validan la CORRECCIÓN INTERNA de ese dispatcher
    # (mutua exclusión, result nunca sin asignar), así que habilitamos el dev
    # flag explícitamente para ejercitar la máquina legacy que sigue existiendo.
    monkeypatch.setenv("ASSISTANT_LEGACY_DIRECT_EXEC", "1")
    sys.path.insert(0, str(API_ROOT))
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]
    return importlib.import_module("app.assistant.tools")


class _FakeDb:
    """Minimal DB stand-in: execute_tool_call only uses it to write the audit log."""

    def execute(self, *_args, **_kwargs):
        class _Cur:
            def fetchone(self_inner):
                return None
        return _Cur()

    def commit(self):
        pass


def test_unknown_tool_returns_error_without_unbound_result(tools_module, monkeypatch):
    # Patch the audit-log writer so we don't try to touch a real DB. If the
    # dispatcher leaves `result` unbound (the previous bug), the audit-log
    # call would raise UnboundLocalError BEFORE we get a chance to assert.
    monkeypatch.setattr(
        tools_module, "write_assistant_action_log", lambda *a, **_kw: None
    )
    result = tools_module.execute_tool_call(
        db=_FakeDb(),
        household_id="hh-test",
        tool_name="this_tool_does_not_exist",
        args={},
        user_id="user-test",
    )
    assert isinstance(result, str)
    assert "not implemented" in result.lower() or "invalid" in result.lower()


def test_known_tool_branches_are_mutually_exclusive(tools_module, monkeypatch):
    """If `elif` is in place, only one inner handler runs per call.

    We patch each inner handler to record invocation and call the
    dispatcher with one specific tool name; only that handler should
    have been called.
    """
    calls: list[str] = []

    monkeypatch.setattr(
        tools_module,
        "_create_operational_task",
        lambda *a, **kw: (calls.append("task"), "SUCCESS: task")[-1],
    )
    monkeypatch.setattr(
        tools_module,
        "_register_financial_expense",
        lambda *a, **kw: (calls.append("expense"), "SUCCESS: expense")[-1],
    )
    monkeypatch.setattr(
        tools_module,
        "_generate_claim_report",
        lambda *a, **kw: (calls.append("claim"), "SUCCESS: claim")[-1],
    )
    monkeypatch.setattr(
        tools_module,
        "_generate_formal_letter",
        lambda *a, **kw: (calls.append("letter"), "SUCCESS: letter")[-1],
    )
    monkeypatch.setattr(
        tools_module, "write_assistant_action_log", lambda *a, **_kw: None
    )

    out = tools_module.execute_tool_call(
        db=_FakeDb(),
        household_id="hh",
        tool_name="register_financial_expense",
        args={},
        user_id="u",
    )
    assert out.startswith("SUCCESS")
    assert calls == ["expense"], f"Other handlers ran too: {calls}"


def test_inner_handler_exception_does_not_leave_result_unbound(tools_module, monkeypatch):
    """A raising handler should produce a structured error, not crash the audit log."""

    def _boom(*_a, **_kw):
        raise RuntimeError("simulated failure")

    monkeypatch.setattr(tools_module, "_create_operational_task", _boom)
    monkeypatch.setattr(
        tools_module, "write_assistant_action_log", lambda *a, **_kw: None
    )

    out = tools_module.execute_tool_call(
        db=_FakeDb(),
        household_id="hh",
        tool_name="create_operational_task",
        args={"title": "doomed"},
        user_id="u",
    )
    assert isinstance(out, str)
    assert out.upper().startswith("ERROR")
    assert "simulated failure" in out.lower()
