# VantDomus v0.4 Planning Assistant (Heuristic + ML-ready base)

import json
import uuid
from datetime import datetime, timezone

def utcnow_iso():
    return datetime.now(timezone.utc).isoformat()

def generate_simple_recommendation(household_id):
    return {
        "id": str(uuid.uuid4()),
        "household_id": household_id,
        "created_at": utcnow_iso(),
        "status": "open",
        "kind": "stability",
        "title": "Review Household Stability",
        "rationale": "HSI below optimal threshold. Recommend reviewing tasks, health adherence, and finances.",
        "impact": 80,
        "payload": json.dumps({
            "actions": [
                {"type": "create_task", "title": "Recovery Planning Session (30 min)", "priority": "high"},
                {"type": "create_task", "title": "Review Weekly Budget", "priority": "medium"}
            ]
        })
    }
