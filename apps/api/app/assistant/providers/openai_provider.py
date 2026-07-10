"""
CP1c-FUNC-MIN-3.3b — Adapter OpenAI PROPOSE-ONLY (único proveedor real de este
checkpoint). SOLO se usa a través del shadow harness del gateway; el chat
normal sigue en MockProvider.

El adapter:
- NUNCA ejecuta tools, NUNCA escribe DB, NUNCA decide permisos;
- NUNCA selecciona household/user/person (los IDs del modelo se rechazan);
- solo devuelve reply + propuestas estructuradas {tool, payload};
- exige JSON ESTRICTO (sin Markdown, sin texto alrededor, sin campos extra);
- su salida pasa por el MISMO schema/registry del gateway (MIN-3.3a);
- la key se lee del entorno LOCAL en el momento de la llamada; jamás se
  imprime, loguea, commitea ni viaja en el reporte.

Sin los flags duros del gateway (`is_available()` abajo) este adapter no está
disponible y `propose()` nunca se invoca — cero llamadas de red.
"""

import json
import os
import urllib.request

from .base import Provider, ProposedAction, ProviderResult


# Precios aproximados por 1M tokens (USD) para ESTIMAR costo del checkpoint.
# Solo referencial para el reporte; no es facturación.
_APPROX_PRICES_PER_1M = {
    "gpt-4.1-mini": {"in": 0.40, "out": 1.60},
    "gpt-4.1": {"in": 2.00, "out": 8.00},
    "gpt-4o-mini": {"in": 0.15, "out": 0.60},
}

_JSON_CONTRACT = (
    "Responde EXCLUSIVAMENTE un objeto JSON valido, sin Markdown, sin bloques "
    "de codigo, sin texto antes ni despues. Forma EXACTA: "
    '{"reply": "<texto breve y calido en espanol>", '
    '"proposals": [{"tool": "<nombre EXACTO de una tool del catalogo>", '
    '"payload": {<solo campos del input_schema de esa tool>}}], '
    '"blocked": null o "<motivo>"} '
    "Reglas duras: maximo UNA propuesta; solo tools del catalogo; PROHIBIDO "
    "inventar campos, IDs, personas, hogares o usuarios; si la peticion es "
    "sensible (medicamentos, dinero, diagnostico, mensajes externos, URLs) "
    "devuelve proposals=[] y explica en reply que requiere confirmacion humana. "
    "TU SOLO PROPONES; nunca ejecutas."
)


class OpenAIProvider(Provider):
    name = "openai"

    def __init__(self):
        self.model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
        self.last_usage: dict = {}

    def is_available(self) -> bool:
        """
        Gates DUROS (todos server-side). Sin CUALQUIERA de ellos → no disponible
        → el gateway usa mock y no hay llamada de red aunque exista una key.
        """
        mode_ok = os.getenv("ASSISTANT_PROVIDER_MODE", "mock").strip().lower() in ("openai", "real", "llm")
        real_ok = os.getenv("ASSISTANT_REAL_PROVIDER_ENABLED", "").strip().lower() in ("1", "true", "yes")
        ext_ok = os.getenv("ASSISTANT_EXTERNAL_CALLS_ALLOWED", "").strip().lower() in ("1", "true", "yes")
        has_key = bool(os.getenv("OPENAI_API_KEY", "").strip())
        return mode_ok and real_ok and ext_ok and has_key

    # --- transporte (separado para poder simularlo en tests, SIN red) -------
    def _transport(self, payload: dict, timeout: float) -> dict:
        api_key = os.getenv("OPENAI_API_KEY", "")
        base = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
        req = urllib.request.Request(
            base + "/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def propose(self, *, user_message: str, context: dict, catalog: list[dict]) -> ProviderResult:
        if not self.is_available():
            raise RuntimeError("OpenAIProvider no disponible: faltan gates server-side.")

        # Segmentos SEPARADOS (anti-injection): las instrucciones van en system;
        # los datos del hogar y el mensaje van como DATOS JSON en el user turn.
        tools_public = [
            {"tool": c["name"], "description": c["description"], "input_schema": c["input_schema"]}
            for c in catalog if c.get("kind") == "write"
        ]
        system = (
            "Eres Domi, asistente propose-only de VantDomus Hogar. "
            + _JSON_CONTRACT
            + " Catalogo de tools (usa el nombre EXACTO): "
            + json.dumps(tools_public, ensure_ascii=False)
        )
        user = json.dumps({
            "household_data": context,          # ya minimizado por el gateway
            "user_message": user_message,
        }, ensure_ascii=False)

        raw = self._transport({
            "model": self.model,
            "temperature": 0,
            "max_tokens": 300,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }, timeout=float(os.getenv("ASSISTANT_PROVIDER_TIMEOUT", "10")))

        self.last_usage = raw.get("usage") or {}
        content = (raw.get("choices") or [{}])[0].get("message", {}).get("content", "")
        return self._parse_strict(content)

    def _parse_strict(self, content: str) -> ProviderResult:
        """JSON estricto: sin Markdown, sin texto alrededor, sin campos extra."""
        text = (content or "").strip()
        if not text or text.startswith("```") or not text.startswith("{") or not text.endswith("}"):
            raise ValueError("salida no es JSON estricto (markdown/texto alrededor)")
        data = json.loads(text)  # JSON inválido → ValueError → fallback en el caller

        allowed_top = {"reply", "proposals", "blocked"}
        if set(data.keys()) - allowed_top:
            raise ValueError(f"campos top-level no permitidos: {sorted(set(data.keys()) - allowed_top)}")
        reply = data.get("reply")
        if not isinstance(reply, str) or not reply.strip():
            raise ValueError("reply inválido")

        proposals_raw = data.get("proposals") or []
        if not isinstance(proposals_raw, list) or len(proposals_raw) > 1:
            raise ValueError("proposals debe ser lista de máximo 1 en esta fase")

        proposals: list[ProposedAction] = []
        for p in proposals_raw:
            if not isinstance(p, dict) or set(p.keys()) != {"tool", "payload"}:
                raise ValueError("cada propuesta debe tener EXACTAMENTE {tool, payload}")
            tool = p["tool"]
            payload = p["payload"]
            if not isinstance(tool, str) or not isinstance(payload, dict):
                raise ValueError("tipos inválidos en propuesta")
            # IDs suministrados por el modelo: PROHIBIDOS (el servidor decide).
            for banned in ("person_id", "household_id", "user_id", "id"):
                if banned in payload:
                    raise ValueError(f"el modelo no puede suministrar IDs ({banned})")
            # Título/resumen los genera el SERVIDOR (no se confía en texto libre
            # del modelo para la tarjeta).
            from ..registry import get_contract
            contract = get_contract(tool)
            items = payload.get("items") if isinstance(payload.get("items"), list) else None
            title = (f"Agregar a la lista: {', '.join(map(str, items))}" if items
                     else str(payload.get("title") or "Propuesta de Domi"))[:120]
            proposals.append(ProposedAction(
                tool_name=tool,
                category=(contract.category if contract else "unknown"),
                title=title,
                summary="Propuesta generada por el proveedor externo (shadow). Requiere confirmación humana.",
                payload=payload,
            ))

        blocked = data.get("blocked")
        if blocked is not None and not isinstance(blocked, str):
            raise ValueError("blocked inválido")
        return ProviderResult(reply=reply.strip(), proposals=proposals, blocked_reason=blocked)

    def estimated_cost_usd(self) -> float | None:
        """Costo aproximado de la última llamada (referencial)."""
        u = self.last_usage or {}
        p = _APPROX_PRICES_PER_1M.get(self.model)
        if not p or not u:
            return None
        return round((u.get("prompt_tokens", 0) * p["in"] + u.get("completion_tokens", 0) * p["out"]) / 1_000_000, 6)
