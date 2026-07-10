"""
OpenAIProvider — STUB APAGADO en MIN-3.1.

Existe para dejar el adapter listo, pero NO se activa en este checkpoint. Aun
cuando se encienda en el futuro (MIN-3.2+, con autorización explícita), su
contrato será idéntico: **solo propone, nunca ejecuta**. Mientras no haya key,
`is_available()` es False y `get_provider()` cae de forma segura al MockProvider.

No hay ninguna llamada de red en este archivo. La integración real del modelo
en modo propose-only se implementará recién cuando se autorice.
"""

import os

from .base import Provider, ProviderResult


class OpenAIProvider(Provider):
    name = "openai"

    def is_available(self) -> bool:
        # Requiere opt-in explícito (flag) + key. En MIN-3.1 ambas condiciones
        # NO se cumplen por diseño → siempre False → se usa MockProvider.
        flag_on = os.getenv("ASSISTANT_PROVIDER", "mock").strip().lower() in ("openai", "gemini", "llm")
        has_key = bool(os.getenv("OPENAI_API_KEY", "").strip())
        return flag_on and has_key

    def propose(self, *, user_message: str, context: dict, catalog: list[dict]) -> ProviderResult:
        # Deliberadamente NO implementado en MIN-3.1. Si alguien fuerza este
        # camino sin la implementación propose-only autorizada, fallamos de
        # forma segura y explícita en vez de ejecutar cualquier cosa.
        raise NotImplementedError(
            "OpenAIProvider está apagado en MIN-3.1. La integración propose-only "
            "del modelo se implementará solo con autorización (MIN-3.2+)."
        )
