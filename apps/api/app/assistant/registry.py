"""
CP1c-FUNC-MIN-3.1 — Tool Registry del AI Orchestrator seguro de Domi.

Contrato EXPLÍCITO de cada herramienta que Domi puede proponer. El modelo (o el
MockProvider) SOLO ve `name` + `description` + `input_schema` para PROPONER; la
ejecución la hace el orquestador tras el gate de permisos y la confirmación
humana. Nada aquí ejecuta por sí mismo.

Reglas de oro:
- `kind="read"`  → puede responder sin confirmación (no toca DB).
- `kind="write"` → SIEMPRE genera una propuesta y requiere confirmación humana.
- Categorías sensibles (salud/medicación/finanzas/seguridad/familia/compras) →
  `requires_confirmation=True` obligatorio.
- Lo que está en BLOCKED_TOOLS nunca se propone ni se ejecuta.
"""

from dataclasses import dataclass, field, asdict


# Categorías que exigen confirmación humana obligatoria (canon VantDomus).
SENSITIVE_CATEGORIES = {"health", "medication", "finance", "security", "family", "shopping"}


@dataclass(frozen=True)
class ToolContract:
    name: str
    description: str
    kind: str                       # "read" | "write"
    category: str                   # shopping|study|family|calm|household|documents|finance|health
    required_role: str              # viewer|member|admin|owner
    required_modules: list          # módulos que deben estar visibles (vacío = ninguno)
    sensitive: bool
    requires_confirmation: bool
    side_effects: list              # tablas que toca al ejecutar (vacío en read)
    writes_evidence: bool = False
    writes_memory: bool = False
    input_schema: dict = field(default_factory=dict)
    # MIN-3.2 — edición segura: SOLO estos campos del payload pueden modificarse
    # al confirmar (overrides). tool/household/user NUNCA son editables desde el
    # cliente; cualquier otra clave se rechaza.
    editable_fields: list = field(default_factory=list)

    def public(self) -> dict:
        """Lo que ve el proveedor/UI para proponer (sin lógica interna)."""
        return {
            "name": self.name,
            "description": self.description,
            "kind": self.kind,
            "category": self.category,
            "sensitive": self.sensitive,
            "requires_confirmation": self.requires_confirmation,
            "input_schema": self.input_schema,
        }

    def as_dict(self) -> dict:
        return asdict(self)


# =============================================================================
# HERRAMIENTAS PERMITIDAS EN MIN-3.1 (todas propose-first para las de escritura)
# =============================================================================
TOOL_CONTRACTS: dict[str, ToolContract] = {
    # ---- LECTURA (sin confirmación; no tocan DB) --------------------------
    "read_household_summary": ToolContract(
        name="read_household_summary",
        description="Resume el estado del hogar: integrantes, compras pendientes, actividades de hoy, avisos.",
        kind="read", category="household", required_role="viewer", required_modules=[],
        sensitive=False, requires_confirmation=False, side_effects=[],
        input_schema={"type": "object", "properties": {}},
    ),
    "read_shopping_list": ToolContract(
        name="read_shopping_list",
        description="Lee la lista de compras y el carro tentativo del hogar.",
        kind="read", category="shopping", required_role="viewer", required_modules=[],
        sensitive=False, requires_confirmation=False, side_effects=[],
        input_schema={"type": "object", "properties": {}},
    ),
    "read_classified_documents": ToolContract(
        name="read_classified_documents",
        description="Lee los documentos ya clasificados por la Bandeja Inteligente (sin abrir URLs).",
        kind="read", category="documents", required_role="viewer", required_modules=[],
        sensitive=False, requires_confirmation=False, side_effects=[],
        input_schema={"type": "object", "properties": {}},
    ),
    "explain_receipt_or_circular": ToolContract(
        name="explain_receipt_or_circular",
        description="Explica en palabras simples una boleta o circular ya cargada (montos, ítems, fechas).",
        kind="read", category="documents", required_role="viewer", required_modules=[],
        sensitive=False, requires_confirmation=False, side_effects=[],
        input_schema={"type": "object", "properties": {"document_ref": {"type": "string"}}},
    ),
    "suggest_calm_support": ToolContract(
        name="suggest_calm_support",
        description="Sugiere una pausa/acompañamiento calmo NO clínico (respiración, descanso). Nunca diagnostica.",
        kind="read", category="calm", required_role="viewer", required_modules=[],
        sensitive=False, requires_confirmation=False, side_effects=[],
        input_schema={"type": "object", "properties": {}},
    ),

    # ---- ESCRITURA (SIEMPRE propuesta + confirmación humana) --------------
    "propose_shopping_item": ToolContract(
        name="propose_shopping_item",
        description="Propone agregar uno o más productos a la lista de compras. NO los agrega hasta confirmar.",
        kind="write", category="shopping", required_role="member", required_modules=["shopping"],
        sensitive=True, requires_confirmation=True, side_effects=["household_shopping_items"],
        input_schema={
            "type": "object",
            "properties": {
                "items": {"type": "array", "items": {"type": "string"}},
                "store_type": {"type": "string"},
            },
            "required": ["items"],
        },
        editable_fields=["items", "store_type"],
    ),
    "propose_study_task": ToolContract(
        name="propose_study_task",
        description="Propone una tarea/compromiso de estudio para un integrante. NO la crea hasta confirmar.",
        kind="write", category="study", required_role="member", required_modules=["guide"],
        sensitive=True, requires_confirmation=True, side_effects=["unit_functions"],
        input_schema={
            "type": "object",
            "properties": {
                "person_id": {"type": "string"},
                "title": {"type": "string"},
                "due_at": {"type": "string"},
            },
            "required": ["title"],
        },
        editable_fields=["title", "due_at", "person_id"],
    ),
    "propose_family_notice": ToolContract(
        name="propose_family_notice",
        description="Propone publicar un aviso en el Mural familiar. NO se publica ni se envía hasta confirmar.",
        kind="write", category="family", required_role="member", required_modules=["board"],
        sensitive=True, requires_confirmation=True, side_effects=["family_board_posts"],
        input_schema={
            "type": "object",
            "properties": {"title": {"type": "string"}, "body": {"type": "string"}},
            "required": ["title"],
        },
        editable_fields=["title", "body"],
    ),
}


# =============================================================================
# HERRAMIENTAS PROHIBIDAS — nunca se proponen ni se ejecutan en MIN-3.1
# =============================================================================
# El orquestador, si detecta una intención que caiga aquí, responde con una
# negativa segura y NO crea propuesta.
BLOCKED_TOOLS: dict[str, str] = {
    "confirm_medication_intake": "El registro de toma de medicamentos requiere confirmación humana explícita en Cuidado; Domi no lo hace solo.",
    "diagnose_health": "Domi no diagnostica ni da indicaciones médicas. Consulta a un profesional de salud.",
    "move_money": "Domi nunca mueve dinero ni hace transferencias.",
    "make_purchase": "Domi nunca compra por ti; solo puede proponer agregar algo a la lista.",
    "send_external_message": "Domi no envía mensajes reales fuera de la app.",
    "fetch_url": "Domi no abre URLs reales (solo documentos ya cargados).",
    "write_memory_freeform": "La memoria se guarda con criterio y consentimiento, no de forma libre.",
}


def get_contract(tool_name: str) -> ToolContract | None:
    return TOOL_CONTRACTS.get(tool_name)


def is_blocked(tool_name: str) -> str | None:
    """Devuelve el motivo si la tool está prohibida, o None."""
    return BLOCKED_TOOLS.get(tool_name)


def public_catalog() -> list[dict]:
    """Catálogo que ve el proveedor para proponer (sin internals)."""
    return [c.public() for c in TOOL_CONTRACTS.values()]
