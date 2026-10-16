"""DOMI R52: one-shot Anthropic API promo smoke test, synthetic data only.

Never called from a live route or deployment. Uses Claude Console promotional
API credits only when the operator explicitly enables the one-shot and supplies
their API key through a private environment variable. No user/family data.

Default is DRY RUN (zero requests, zero credits consumed).
"""
from __future__ import annotations

from datetime import date, datetime, timezone
import json
import os
import sys
import urllib.request

API_URL = "https://api.anthropic.com/v1/messages"
EXPIRES_UTC = date(2026, 11, 13)
MODELS = ("claude-haiku-4-5-20251001",)
MAX_OUTPUT_TOKENS = 256

# This exact fixture contains no real people, households, memories or files.
FIXTURE = (
    "Simulacion ficticia de un organizador del hogar. "
    "Una persona adulta pide: 'Anota pan ficticio y leche ficticia en "
    "la lista de compras'. Solo propón; nunca ejecutes."
)
SYSTEM = (
    "Eres DOMI, un asistente familiar bajo prueba con DATOS FICTICIOS. "
    "Responde de manera breve en espanol. No ejecutes acciones, "
    "no afirmes haber guardado datos y exige confirmacion humana "
    "para cualquier cambio. Responde unicamente al esquema JSON."
)
SCHEMA = {
    "type": "object",
    "properties": {
        "reply": {"type": "string"},
        "proposed_action": {
            "type": "string",
            "enum": ["none", "add_shopping_item"],
        },
        "requires_confirmation": {"type": "boolean"},
    },
    "required": ["reply", "proposed_action", "requires_confirmation"],
    "additionalProperties": False,
}


def _model() -> str:
    candidate = os.getenv("DOMI_ANTHROPIC_PROMO_MODEL", MODELS[0]).strip()
    if candidate not in MODELS:
        raise RuntimeError("PROMO_MODEL_NOT_ALLOWLISTED")
    return candidate


def _request_payload() -> dict:
    return {
        "model": _model(),
        "max_tokens": MAX_OUTPUT_TOKENS,
        "system": SYSTEM,
        "messages": [{"role": "user", "content": FIXTURE}],
        "output_config": {
            "format": {"type": "json_schema", "schema": SCHEMA},
        },
    }


def _is_enabled(*, utc_today: date | None = None) -> bool:
    utc_today = utc_today or datetime.now(timezone.utc).date()
    return (
        utc_today <= EXPIRES_UTC
        and os.getenv("APP_ENV", "local").strip().lower() == "local"
        and os.getenv("DOMI_ANTHROPIC_PROMO_ONE_SHOT", "") == "1"
        and bool(os.getenv("ANTHROPIC_API_KEY", "").strip())
    )


def _transport(payload: dict) -> dict:
    api_key = os.environ["ANTHROPIC_API_KEY"].strip()
    request_headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers=request_headers,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as response:
        # 80 KiB response limit, no arbitrary redirection or custom host.
        raw = response.read(81921)
    if len(raw) > 81920:
        raise RuntimeError("PROMO_RESPONSE_TOO_LARGE")
    return json.loads(raw.decode("utf-8"))


def _sanitize_response(response: dict, model: str) -> dict:
    if not isinstance(response, dict) or response.get("stop_reason") != "end_turn":
        raise ValueError("PROMO_INCOMPLETE_RESPONSE")
    blocks = response.get("content")
    if not isinstance(blocks, list) or len(blocks) != 1:
        raise ValueError("PROMO_UNEXPECTED_BLOCKS")
    block = blocks[0]
    if not isinstance(block, dict) or block.get("type") != "text":
        raise ValueError("PROMO_UNEXPECTED_BLOCK")
    data = json.loads(block.get("text", ""))
    if not isinstance(data, dict) or set(data) != set(SCHEMA["required"]):
        raise ValueError("PROMO_BAD_JSON_FIELDS")
    if (
        not isinstance(data["reply"], str)
        or not 1 <= len(data["reply"].strip()) <= 400
        or data["proposed_action"] not in ("none", "add_shopping_item")
        or data["requires_confirmation"] is not True
    ):
        raise ValueError("PROMO_BAD_JSON_VALUES")
    usage = response.get("usage") or {}
    tokens_in, tokens_out = usage.get("input_tokens"), usage.get("output_tokens")
    if (
        not isinstance(tokens_in, int)
        or not isinstance(tokens_out, int)
        or tokens_in < 0 or tokens_out < 0
    ):
        raise ValueError("PROMO_MISSING_USAGE")
    # No raw prompts, identifiers, credentials, hidden reasoning or token dumps.
    return {
        "status": "COMPLETE_SYNTHETIC_ONLY",
        "model": model,
        "input_tokens": tokens_in,
        "output_tokens": tokens_out,
        "proposed_action": data["proposed_action"],
        "requires_confirmation": True,
        "actions_executed": 0,
        "personal_data_sent": False,
    }


def run_once() -> dict:
    payload = _request_payload()
    if not _is_enabled():
        return {
            "status": "DRY_RUN_NO_EXTERNAL_REQUEST",
            "model": payload["model"],
            "actions_executed": 0,
            "personal_data_sent": False,
            "credits_spent_by_this_execution": 0,
        }
    # ONE HTTP call, no automatic retries, no background loop.
    return _sanitize_response(_transport(payload), payload["model"])


def main() -> int:
    try:
        result = run_once()
    except Exception:
        # Do not leak HTTP error bodies or authorization metadata.
        print(json.dumps({"status": "FAIL_CLOSED", "error": "PROMO_REQUEST_FAILED"}))
        return 1
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
