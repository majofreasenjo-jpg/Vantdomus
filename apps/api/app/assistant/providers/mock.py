"""
MockProvider — proveedor determinista por defecto (MIN-3.1).

Sin red, sin key, sin llamada externa. Mapea la intención del usuario a:
- una NEGATIVA SEGURA si cae en algo prohibido (medicación, dinero, compra,
  diagnóstico, mensajes externos, URLs);
- una o más PROPUESTAS de escritura (compras / estudio / aviso familiar) que
  luego requieren confirmación humana;
- o una respuesta de LECTURA (usa el resumen ya calculado por el orquestador,
  vía `context["summary_text"]`, que proviene de las reglas honestas de Domi).

Es intencionalmente simple y predecible: el objetivo de MIN-3.1 es el FLUJO
seguro (propone → confirma → ejecuta), no la sofisticación del lenguaje.
"""

import re

from .base import Provider, ProposedAction, ProviderResult


# Frases que caen en herramientas prohibidas → negativa segura, sin propuesta.
_BLOCK_PATTERNS = [
    (r"\b(ya tom[oó]|tom[oó] (la|el|su)|registr[ao] (la|el) (toma|dosis)|marca(r)? .*medic)", "medication_intake"),
    (r"\b(transfier|transferir|p[aá]gale|paga la cuenta|manda plata|env[ií]a dinero|mueve el dinero)", "move_money"),
    (r"\b(c[oó]mprame|compra (por m[ií]|esto|ahora)|haz la compra|paga y compra)", "make_purchase"),
    (r"\b(qu[eé] enfermedad|diagn[oó]stic|es cáncer|tiene covid|qu[eé] tiene mi|receta un remedio)", "diagnose"),
    (r"\b(env[ií]a (un )?(whatsapp|correo|mail|mensaje) a|mándale un mensaje a)", "send_external"),
    (r"\b(abre|lee) (https?://|el link|la url)", "fetch_url"),
]

_BLOCK_MESSAGES = {
    "medication_intake": "Registrar que alguien tomó su medicamento necesita confirmación humana en Cuidado. Yo puedo recordarlo, pero no lo marco solo. 🛡️",
    "move_money": "No muevo dinero ni hago transferencias. Eso siempre lo haces tú directamente.",
    "make_purchase": "No puedo comprar por ti. Lo que sí puedo es proponer agregar el producto a la lista de compras. ¿Lo agrego?",
    "diagnose": "No diagnostico ni doy indicaciones médicas. Para eso, lo mejor es un profesional de salud. Puedo ayudarte a organizar recordatorios y documentos.",
    "send_external": "No envío mensajes reales fuera de la app. Puedo proponer un aviso en el Mural familiar para que lo revises.",
    "fetch_url": "No abro enlaces de internet. Solo puedo leer documentos que ya cargaste en la Bandeja Inteligente.",
}


def _first_name(name: str) -> str:
    return (name or "").strip().split()[0] if name else ""


def _match_person(message: str, persons: list[dict]) -> str | None:
    ml = message.lower()
    for p in persons or []:
        fn = _first_name(p.get("name", "")).lower()
        if fn and fn in ml:
            return p.get("id")
    return None


def _extract_items(message: str) -> list[str]:
    """Extrae productos tras 'agrega/añade ... a la lista'.
    MIN-3.3a: la separación/normalización la hace nl_lists (canónica)."""
    from app.assistant.nl_lists import parse_list_text
    ml = message.lower()
    m = re.search(r"(?:agrega|agregar|añade|anade|a[ñn]adir|pon|agr[ée]game)\s+(.*)", ml)
    tail = m.group(1) if m else ml
    # Cortar en "a la lista / a compras / al carro"
    tail = re.split(r"\s+a\s+(la\s+lista|compras|el\s+carro|la\s+feria|el\s+super)", tail)[0]
    tail = re.sub(r"[^\wáéíóúñ,;\n\s]", "", tail)
    return parse_list_text(tail)


class MockProvider(Provider):
    name = "mock"

    def propose(self, *, user_message: str, context: dict, catalog: list[dict]) -> ProviderResult:
        msg = (user_message or "").strip()
        ml = msg.lower()
        persons = context.get("persons") or []

        # 1) Prohibido → negativa segura (nunca propone)
        for pattern, key in _BLOCK_PATTERNS:
            if re.search(pattern, ml):
                return ProviderResult(reply=_BLOCK_MESSAGES[key], proposals=[], blocked_reason=key)

        # 2) Escritura → PROPUESTA (requiere confirmación luego)
        # 2a) Compras
        if re.search(r"\b(agrega|agregar|añade|anade|a[ñn]adir|compr[ae]?r?|falta|lista de compras|al carro)\b", ml) \
           and re.search(r"\b(lista|compra|carro|super|feria|leche|pan|fruta|verdura|agrega|añade)\b", ml):
            items = _extract_items(msg)
            if items:
                return ProviderResult(
                    reply="Domi propone esto. Tú decides si se ejecuta. 👇",
                    proposals=[ProposedAction(
                        tool_name="propose_shopping_item",
                        category="shopping",
                        title=f"Agregar a la lista: {', '.join(items)}",
                        summary=f"Agregar {len(items)} producto(s) a la lista de compras del hogar.",
                        payload={"items": items, "store_type": "supermarket"},
                    )],
                )

        # 2b) Estudio
        if re.search(r"\b(estudi|tarea|matem[aá]t|prueba|examen|colegio|prepara(r)?\s+(el|la)\s+(estudio|tarea))\b", ml):
            pid = _match_person(msg, persons)
            titulo = "Compromiso de estudio"
            mt = re.search(r"(?:de|sobre)\s+([\wáéíóúñ\s]{3,30})", ml)
            if mt:
                titulo = f"Estudiar {mt.group(1).strip()}"
            return ProviderResult(
                reply="Domi propone esto. Tú decides si se ejecuta. 👇",
                proposals=[ProposedAction(
                    tool_name="propose_study_task",
                    category="study",
                    title=titulo,
                    summary="Crear una tarea de estudio para un integrante del hogar.",
                    payload={"title": titulo},
                    person_id=pid,
                )],
            )

        # 2c) Aviso familiar
        if re.search(r"\b(avisa|aviso|publica|mural|av[ií]sale a todos|comparte con la familia)\b", ml):
            cuerpo = msg
            return ProviderResult(
                reply="Domi propone publicar este aviso. Tú decides si se publica. 👇",
                proposals=[ProposedAction(
                    tool_name="propose_family_notice",
                    category="family",
                    title="Aviso para la familia",
                    summary="Publicar un aviso en el Mural familiar (no se envía automáticamente).",
                    payload={"title": "Aviso para la familia", "body": cuerpo},
                )],
            )

        # 3) Calma no clínica (lectura/acompañamiento, sin side-effects)
        if re.search(r"\b(relaj|c[aá]lma|respir|ansiedad|estr[eé]s|nervios|abrumad)", ml):
            return ProviderResult(
                reply=("Hagamos una pausa breve: inhala 4 segundos, sostén 4, exhala 6. "
                       "Repítelo unas veces. Estoy contigo. (Esto es acompañamiento, no un consejo médico.)"),
                proposals=[],
            )

        # 4) Lectura general → resumen honesto ya calculado por el orquestador
        return ProviderResult(reply=context.get("summary_text") or
                              "Puedo contarte del hogar: integrantes, compras, actividades, avisos y un resumen.",
                              proposals=[])
