"""
Data-fetching + orchestration layer for the VantUnit assistant.

Prompt *strings* live in `prompts.py` (side-effect free). This module
glues those builders to the database and computed features so the chat
flow has a single entry point: `build_chat_messages`.
"""

import json
import logging

from app.features import compute_features_sqlite
from app.taxonomy import get_taxonomy

from . import prompts

logger = logging.getLogger(__name__)


def load_household_context(db, household_id: str) -> tuple[dict, dict, str]:
    row = db.execute("SELECT meta FROM households WHERE id=?", (household_id,)).fetchone()
    meta: dict = {}
    if row and row["meta"]:
        try:
            meta = json.loads(row["meta"])
        except Exception:
            # Malformed JSON in the household meta column: degrade gracefully
            # to an empty meta dict rather than fail the whole chat call.
            logger.warning("household %s has unparseable meta JSON", household_id)
            meta = {}

    industry = meta.get("industry_preset", "default")
    taxonomy = get_taxonomy(industry)
    mode = meta.get("mode", "home")
    return meta, taxonomy, mode


def build_local_context(db, household_id: str, taxonomy: dict) -> str:
    try:
        features = compute_features_sqlite(db, household_id)
        return "\n".join(prompts.local_context_lines(features, taxonomy))
    except Exception as exc:
        logger.exception("Assistant local context error: %s", exc)
        return prompts.local_context_fallback(taxonomy)


def build_pnl_context(user: dict, db, taxonomy: dict) -> str:
    try:
        from app.routes.ceo import get_ceo_dashboard

        ceo_data = get_ceo_dashboard(user=user, db=db)
        return prompts.pnl_context(ceo_data, taxonomy)
    except Exception as exc:
        logger.exception("Assistant P&L context error: %s", exc)
        return ""


def build_chat_messages(payload, user: dict, db) -> tuple[list[dict], dict, str]:
    meta, taxonomy, mode = load_household_context(db, payload.household_id)
    industry = meta.get("industry_preset", "default")
    system = prompts.system_prompt(taxonomy, industry, mode, meta.get("agent_settings") or {})
    pnl_block = build_pnl_context(user, db, taxonomy)
    local_block = build_local_context(db, payload.household_id, taxonomy)

    messages = [
        {
            "role": "system",
            "content": system + pnl_block + "\n\nLocal Department Context:\n" + local_block,
        }
    ]
    messages += [{"role": msg.role, "content": msg.content} for msg in payload.messages]
    return messages, taxonomy, local_block
