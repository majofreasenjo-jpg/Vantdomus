"""DOMI R57: private one-shot Claude shadow test (Windows/Linux/macOS).

Default: OFFLINE dry run with no credential or network access.
An actual Claude API call requires --execute, an interactive confirmation,
and a secret supplied through an invisible terminal prompt. The key is never
stored in a .env file, GitHub, logs, or the filesystem.

No family database, HTTP route, deployment, real household, or task execution
is involved. This is a *local* prototype control, not a billing guarantee.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone, date
import getpass
import json
import os
from pathlib import Path
import sys

_API = Path(__file__).resolve().parents[1] / "apps" / "api"
_EXPIRY = date(2026, 11, 13)
_CONFIRM = "CONFIRMO CREDITO PROMOCIONAL"
_TEST_FLAGS = {
    "APP_ENV": "local",
    "ASSISTANT_PROVIDER_MODE": "anthropic",
    "ASSISTANT_REAL_PROVIDER_ENABLED": "true",
    "ASSISTANT_EXTERNAL_CALLS_ALLOWED": "true",
    "ASSISTANT_SHADOW_MODE": "true",
    "DOMI_ANTHROPIC_PROMO_ONE_SHOT": "1",
}


def _marker() -> Path:
    """Local history marker, no credentials, only prevents accidental repeat."""
    return Path.home() / ".vantdomus" / "domi-claude-20261016-once.attempted"


def _dry() -> dict:
    # No imports of the app, no key lookup, no API call.
    return {
        "status": "DRY_RUN",
        "external_call_attempted": False,
        "data": "fixed_synthetic_fixture_only",
        "actions_executed": 0,
        "personal_data_transmitted": False,
        "model": "claude-haiku-4-5-20251001",
        "credential_requested": False,
    }


def _reserve_marker(path: Path) -> bool:
    """O_EXCL local reservation BEFORE the attempted API request.

    Each *machine* reserves one request; not a cross-device billing cap.
    """
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    try:
        fd = os.open(str(path), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        return False
    with os.fdopen(fd, "w", encoding="utf-8") as file:
        file.write("DOMI R57: one test attempt reserved; no secret stored.\n")
    return True


def run(execute: bool = False, *, confirmation: str = "",
        key: str = "", today: date | None = None,
        marker_path: Path | None = None) -> dict:
    """Accept explicit inputs only. Default and invalid attempts are no-network."""
    if not execute:
        return _dry()
    today = today or datetime.now(timezone.utc).date()
    if today > _EXPIRY:
        return {"status": "BLOCKED", "gate": "promotional_credit_expired"}
    if os.environ.get("APP_ENV", "local").lower() != "local":
        return {"status": "BLOCKED", "gate": "local_environment_only"}
    if confirmation != _CONFIRM:
        return {"status": "BLOCKED", "gate": "explicit_credit_confirmation_required"}
    if not isinstance(key, str) or not key.strip():
        return {"status": "BLOCKED", "gate": "private_key_required"}
    marker_path = marker_path or _marker()
    # Fail early on unavailable dependencies without reserving a test attempt.
    if str(_API) not in sys.path:
        sys.path.insert(0, str(_API))
    from app.assistant.anthropic_shadow_bridge import (
        make_synthetic_claude_request, compare_synthetic_claude,
    )

    if not _reserve_marker(marker_path):
        return {"status": "BLOCKED", "gate": "local_one_shot_already_reserved"}

    old_env = {name: os.environ.get(name)
               for name in (*_TEST_FLAGS, "ANTHROPIC_API_KEY")}
    try:
        os.environ.update(_TEST_FLAGS)
        os.environ["ANTHROPIC_API_KEY"] = key.strip()
        # No db parameter exists; validation only, zero proposal execution.
        report = compare_synthetic_claude(make_synthetic_claude_request())
        # Sanitize even though the bridge only returns allowlisted metadata.
        allowed = (
            "provider", "mode", "status", "gate",
            "external_call_attempted", "schema_valid", "model",
            "proposed_actions", "mock_proposed_actions", "same_tool",
            "blocked_by_model", "input_tokens", "output_tokens",
            "estimated_list_cost_usd", "actions_executed",
            "proposals_persisted", "personal_data_transmitted",
        )
        return {k: report[k] for k in allowed if k in report}
    finally:
        for name, previous in old_env.items():
            if previous is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = previous


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="DOMI Claude synthetic-only smoke test; DRY RUN by default"
    )
    parser.add_argument("--execute", action="store_true",
                        help="one explicit Anthropic API attempt with hidden key prompt")
    args = parser.parse_args(argv)
    if not args.execute:
        print(json.dumps(run(), sort_keys=True))
        return 0

    if not sys.stdin.isatty():
        print(json.dumps({"status": "BLOCKED", "gate": "interactive_terminal_required"}))
        return 2
    print("DOMI: one Claude API request with FIXED, SYNTHETIC inputs.")
    print("Check the Anthropic Console promotional balance and disable auto-recharge")
    print("before continuing; a promo balance is NOT a provider-enforced cost cap.")
    print("This test can be billable; nothing will be stored in the family app.")
    try:
        confirmation = input("Type exactly CONFIRMO CREDITO PROMOCIONAL: ").strip()
        if confirmation != _CONFIRM:
            print(json.dumps({"status": "BLOCKED", "gate": "confirmation_required"}))
            return 2
        private_key = getpass.getpass("Anthropic API key (hidden): ")
        try:
            result = run(execute=True, confirmation=confirmation, key=private_key)
        finally:
            private_key = ""
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0 if result.get("status") == "COMPLETE" else 2
    except Exception:
        # Never include stack traces, HTTP response bodies or secret-bearing env.
        print(json.dumps({"status": "FAILED_CLOSED", "gate": "internal_error"}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
