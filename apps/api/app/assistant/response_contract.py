"""
OPS-2 M3 — Contrato de respuesta de Domi.

Cada respuesta de Domi declara su TIPO canónico. Esto hace EXPLÍCITA y auditable
la invariante del canon: una conversación casual NUNCA ejecuta acciones ni
modifica el hogar. La UI puede así distinguir claramente "esto es solo charla" de
"esto es una acción que espera tu confirmación".

Tipos (canon §1):
  conversacion                      — charla/acompañamiento, sin acción ni dato.
  informacion                       — Domi respondió un dato/lectura (no ejecuta).
  sugerencia                        — recomendación blanda, sin propuesta formal.
  propuesta                         — propuesta formada (aún no pendiente en store).
  accion_pendiente_de_confirmacion  — propuesta creada; espera confirmación humana.
  accion_ejecutada                  — acción ya ejecutada tras confirmación humana.
  resultado_integracion_externa     — resultado de una integración externa.
"""

from __future__ import annotations

CONVERSATION = "conversacion"
INFORMATION = "informacion"
SUGGESTION = "sugerencia"
PROPOSAL = "propuesta"
ACTION_PENDING = "accion_pendiente_de_confirmacion"
ACTION_EXECUTED = "accion_ejecutada"
EXTERNAL_RESULT = "resultado_integracion_externa"

ALL_TYPES = {
    CONVERSATION, INFORMATION, SUGGESTION, PROPOSAL,
    ACTION_PENDING, ACTION_EXECUTED, EXTERNAL_RESULT,
}

# Tipos que representan (o llevan a) una modificación del hogar.
_ACTION_TYPES = {PROPOSAL, ACTION_PENDING, ACTION_EXECUTED}


def is_actionable(response_type: str) -> bool:
    """True si el tipo implica una acción sobre el hogar (nunca conversación)."""
    return response_type in _ACTION_TYPES


def classify_chat_response(*, blocked: str | None, proposals_count: int,
                           had_read_answer: bool = False) -> str:
    """
    Clasifica la respuesta del CHAT (endpoint propose-first):
      - hay propuestas creadas → accion_pendiente_de_confirmacion;
      - bloqueada (petición sensible) → informacion (Domi explica, no ejecuta);
      - respondió una lectura/dato → informacion;
      - si no → conversacion.
    NOTA: el chat NUNCA ejecuta (por diseño propose-first); accion_ejecutada solo
    ocurre en el endpoint de confirmación.
    """
    if proposals_count > 0:
        return ACTION_PENDING
    if blocked:
        return INFORMATION
    if had_read_answer:
        return INFORMATION
    return CONVERSATION
