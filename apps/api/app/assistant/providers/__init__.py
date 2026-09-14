"""
Proveedores de propuestas para el AI Orchestrator de Domi.

Selección del proveedor (MIN-3.1):
- Default = MockProvider determinista (sin red, sin key, sin llamada externa).
- El proveedor externo (OpenAI/Gemini/LLM) queda APAGADO en MIN-3.1: solo se
  puede activar con `ASSISTANT_PROVIDER=openai` Y una key presente, y aún así
  el modelo SOLO propone (nunca ejecuta). No se activa en este checkpoint.
"""

import os

from .base import Provider, ProposedAction, ProviderResult
from .mock import MockProvider

__all__ = ["Provider", "ProposedAction", "ProviderResult", "MockProvider", "get_provider"]


def get_provider() -> Provider:
    """
    Devuelve el proveedor activo. MockProvider por defecto y SIEMPRE en MIN-3.1.
    El externo requiere opt-in explícito (flag) + key; mientras no exista, se
    cae de forma segura al mock.
    """
    choice = os.getenv("ASSISTANT_PROVIDER", "mock").strip().lower()
    if choice in ("openai", "gemini", "llm"):
        # Import diferido: si alguien enciende el flag sin key, el propio
        # provider se degrada a mock de forma segura (ver openai_provider.py).
        from .openai_provider import OpenAIProvider

        provider = OpenAIProvider()
        if provider.is_available():
            return provider
    return MockProvider()
