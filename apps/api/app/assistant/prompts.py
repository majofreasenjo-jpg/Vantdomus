"""
Pure prompt-builder functions for the VantUnit assistant.

This module is intentionally side-effect free: every function takes plain
Python data (dicts, strings) and returns a string. Database / feature
fetching lives in `context.py`. Splitting prompts out here makes prompt
audits trivial (one file, no hidden state) — see the "Siguiente mejora
recomendada" note in the project README.
"""

from __future__ import annotations


def agent_settings_prompt(agent_settings: dict, industry: str) -> str:
    """Render the workspace-rules block appended to the system prompt."""
    if not agent_settings:
        return ""

    level = agent_settings.get("user_level", "basic")
    autonomy = agent_settings.get("autonomy_mode", "consult")
    active_agents = ", ".join(agent_settings.get("active_agents") or [])
    approval = (
        "require explicit user approval before executing actions"
        if agent_settings.get("approval_required", True)
        else "may execute approved in-platform actions when the task is clear"
    )

    audio = []
    if agent_settings.get("audio_input_enabled", True):
        audio.append("voice input")
    if agent_settings.get("audio_output_enabled", True):
        audio.append("spoken summaries")

    imported_context = (agent_settings.get("imported_context") or "").strip()
    family_scope = (
        "For VantDomus Familiar, school planning is part of the family domain: agendas, tests, "
        "assignments, reminders, study progress, documents, budget and wellbeing."
        if industry == "family"
        else ""
    )
    context_block = (
        f"\nImported user agent configuration:\n{imported_context}"
        if imported_context
        else ""
    )

    return (
        "\n\n--- VANTDOMUS AGENT WORKSPACE RULES ---\n"
        f"User level: {level}. Autonomy mode: {autonomy}. "
        f"Active agents: {active_agents or 'default orchestrator'}.\n"
        f"Execution policy: {approval}.\n"
        f"Audio capability: {', '.join(audio) if audio else 'disabled'}.\n"
        "Operate like a bounded agentic workspace: clarify, plan, use only VantDomus "
        "context/tools, create traceable outputs, and avoid pretending access to external "
        "private memories. "
        "If the user references Codex, Claude, Cursor, Gemini or another platform, mirror only "
        "the explicit configuration they provided inside VantDomus.\n"
        f"{family_scope}{context_block}"
    )


def system_prompt(
    taxonomy: dict,
    industry: str,
    mode: str,
    agent_settings: dict | None = None,
) -> str:
    """Top-level system prompt sent as the first chat message."""
    base_role = taxonomy["ai_role"]
    if industry == "corporate":
        if mode == "team":
            base_role += (
                " CURRENT MODE: TEAM. Act as a wellness facilitator. Translate adaptive tension "
                "into human empathy, pacing and workload guidance."
            )
        else:
            base_role += (
                " CURRENT MODE: EXECUTIVE. Act as a C-level advisor. Cross-reference adaptive "
                "tension with CAPEX/OPEX execution, ROI, systemic stability and macro-risks."
            )

    base = (
        f"You are VantUnit, {base_role}. You are an operational assistant with auditable tools. "
        "When the user asks to register a cost, supply, expense, operation, repair or task, "
        "use the provided tools. Be concise, specific and action-oriented. "
        f"Use the user's terminology: '{taxonomy['finance']}' for expenses and "
        f"'{taxonomy['tasks']}' for tasks."
    )
    return base + agent_settings_prompt(agent_settings or {}, industry)


def local_context_lines(features: dict, taxonomy: dict) -> list[str]:
    """
    Build the per-household status lines from computed features.

    Pure function over `features` (no DB access) — separated from `context.py`
    so prompt-auditing tests can feed synthetic features and assert output.
    """
    parts = [
        (
            f"Estado de {taxonomy['unit']} Alpha: OSI={features.get('hsi', 0)} "
            f"({taxonomy['health']} {features.get('health_score', 0)}; "
            f"{taxonomy['tasks']} {features.get('task_score', 0)}; "
            f"{taxonomy['finance']} {features.get('finance_score', 0)})"
        )
    ]
    if features.get("missed_7d", 0) > 0:
        parts.append(
            f"Alerta de {taxonomy['health']}: {features['missed_7d']} fallos registrados "
            "en los ultimos 7 dias."
        )
    if features.get("tasks_overdue", 0) > 0:
        parts.append(
            f"Alerta operativa: {features['tasks_overdue']} {taxonomy['tasks'].lower()} "
            "criticos vencidos."
        )
    parts.append("Sugiere acciones concretas para estabilizar el OSI y reducir riesgo operacional.")
    return parts


def local_context_fallback(taxonomy: dict) -> str:
    """Used when feature computation fails so the assistant still has a greeting."""
    return f"Hola. Soy VantUnit. Listo para asistir en el control de su {taxonomy['unit']}."


def pnl_context(ceo_data: dict, taxonomy: dict) -> str:
    """Render the CEO-level P&L block appended to the system prompt."""
    pnl = ceo_data.get("pnl", {})
    return (
        "\n\n--- FINANCIAL & OPERATIONAL P&L (CEO LEVEL) ---\n"
        f"Global Production ({taxonomy.get('macro_kpis', {}).get('capacity', 'Capacity')}): "
        f"{ceo_data.get('global_osi', 0)}% | EBITDA Margin: {ceo_data.get('ebitda_margin', 0)}%\n"
        f"Revenue: ${pnl.get('revenue', 0)}M | COGS: ${pnl.get('cogs', 0)}M | "
        f"SG&A: ${pnl.get('sga', 0)}M\n"
        f"EBITDA: ${pnl.get('ebitda', 0)}M | Fines/Depreciation: ${pnl.get('fines_da', 0)}M | "
        f"Net Income: ${pnl.get('net_income', 0)}M\n"
        f"Global Health Score: {ceo_data.get('global_health', 0)}% | "
        f"Global Task Score: {ceo_data.get('global_task', 0)}% | "
        f"Global ESG Score: {ceo_data.get('global_esg', 0)}%\n"
        "If the user asks why profitability moved, explain the link between operational "
        "bottlenecks, task backlog, health/safety issues, ESG non-compliance, revenue, SG&A "
        "and fines."
    )
