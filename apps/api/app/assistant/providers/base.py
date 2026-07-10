"""
Interfaz única de proveedor: `propose()`.

Un proveedor recibe el mensaje del usuario + un contexto MÍNIMO (ya scoped y sin
PII innecesaria) + el catálogo público de tools, y devuelve un ProviderResult:
un texto para Domi y CERO o más ProposedAction. **El proveedor NUNCA ejecuta
nada** — solo propone. La ejecución la hace el orquestador tras confirmación.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ProposedAction:
    """Una acción propuesta (aún NO ejecutada)."""
    tool_name: str
    category: str
    title: str
    summary: str
    payload: dict = field(default_factory=dict)
    person_id: str | None = None


@dataclass
class ProviderResult:
    """Resultado de una vuelta de propuesta."""
    reply: str                                  # texto cálido de Domi
    proposals: list[ProposedAction] = field(default_factory=list)
    blocked_reason: str | None = None           # si la intención cae en algo prohibido


class Provider(ABC):
    name: str = "base"

    @abstractmethod
    def propose(self, *, user_message: str, context: dict, catalog: list[dict]) -> ProviderResult:
        """Genera respuesta + propuestas. No ejecuta ni toca la DB."""
        raise NotImplementedError

    def is_available(self) -> bool:  # pragma: no cover - trivial
        return True
