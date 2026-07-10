import json
import os
import urllib.request

from app.assistant.tools import TOOL_DEFINITIONS, execute_tool_call


class AssistantProviderError(RuntimeError):
    pass


def _legacy_direct_exec_enabled() -> bool:
    """
    CP1c-FUNC-MIN-3.1 — El camino legacy que ejecuta tools DIRECTAMENTE vía
    OpenAI (sin confirmación humana) queda NEUTRALIZADO por defecto. Solo puede
    reactivarse con ASSISTANT_LEGACY_DIRECT_EXEC=1 (dev flag), que NO se activa
    en este checkpoint. El flujo vivo es el orquestador propose-first.
    """
    return os.getenv("ASSISTANT_LEGACY_DIRECT_EXEC", "").strip().lower() in ("1", "true", "yes")


def run_agentic_chat(messages: list[dict], model: str, temperature: float, db, household_id: str, user_id: str | None = None) -> str:
    # Legacy safety wrapper: sin el flag explícito, este camino NO corre. Así
    # ningún proveedor externo ejecuta acciones sin permiso humano.
    if not _legacy_direct_exec_enabled():
        raise AssistantProviderError("legacy direct-exec disabled (propose-first orchestrator active)")
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise AssistantProviderError("OPENAI_API_KEY missing")

    base = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    url = base.rstrip("/") + "/chat/completions"
    current_messages = list(messages)

    for _ in range(3):
        payload = {
            "model": model,
            "temperature": temperature,
            "messages": current_messages,
            "tools": TOOL_DEFINITIONS,
            "tool_choice": "auto",
        }
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
            method="POST",
        )

        with urllib.request.urlopen(request, timeout=40) as response:
            output = json.loads(response.read().decode("utf-8"))

        message = output["choices"][0]["message"]
        clean_message = {"role": message["role"]}
        if message.get("content"):
            clean_message["content"] = message["content"]
        if message.get("tool_calls"):
            clean_message["tool_calls"] = message["tool_calls"]
        current_messages.append(clean_message)

        if not message.get("tool_calls"):
            return clean_message.get("content", "")

        for tool_call in message["tool_calls"]:
            name = tool_call["function"]["name"]
            try:
                args = json.loads(tool_call["function"].get("arguments") or "{}")
                result = execute_tool_call(db, household_id, name, args, user_id=user_id)
            except Exception as exc:
                result = str(exc)

            current_messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "name": name,
                    "content": result,
                }
            )

    return current_messages[-1].get("content", "Error: agent loop limit reached.")
