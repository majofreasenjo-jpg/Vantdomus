"""
CP1c-FUNC-MIN-3.3a — Normalización CANÓNICA de listas en lenguaje natural.

ÚNICA función para convertir texto hablado/escrito en una lista de productos.
La usan: MockProvider (entender la frase), validate_overrides (edición del
humano) y la ejecución de la tool. El editor del frontend usa el mirror
`apps/web/lib/nlList.ts` (misma regla, documentado como espejo); la
normalización AUTORITATIVA siempre ocurre aquí, en el servidor.

Soporta:
- "leche, pan, arroz"          → 3 elementos
- "leche y pan"                → 2 elementos
- "leche, pan y arroz"         → 3 elementos
- saltos de línea              → separadores
- espacios repetidos           → colapsados
- MAYÚSCULAS/minúsculas        → dedupe case-insensitive (conserva la 1ª forma)
- duplicados exactos           → eliminados
- elementos vacíos             → eliminados

Evita separaciones incorrectas razonables: solo separa por " y " como palabra
completa entre espacios (no parte "yogurt" ni "leyenda"); "pan y medio" sí se
separa — límite conocido y aceptado del enfoque sin IA (queda para el provider
real en fases futuras).
"""

import re

MAX_ITEMS = 20
MAX_ITEM_LEN = 60

# Separadores canónicos: coma, salto de línea, punto y coma, o " y "/" e " como
# palabra completa (case-insensitive).
_SEPARATORS = re.compile(r",|;|\n|\r|\s+y\s+|\s+e\s+", re.IGNORECASE)
_SPACES = re.compile(r"\s+")


def parse_list_text(text: str) -> list[str]:
    """Texto libre → lista normalizada de productos (canónica)."""
    if not text or not isinstance(text, str):
        return []
    parts = _SEPARATORS.split(text)
    out: list[str] = []
    seen: set[str] = set()
    for raw in parts:
        item = _SPACES.sub(" ", (raw or "").strip())
        if not item:
            continue
        key = item.lower()
        if key in seen:  # duplicado exacto (case-insensitive)
            continue
        seen.add(key)
        out.append(item[:MAX_ITEM_LEN])
        if len(out) >= MAX_ITEMS:
            break
    return out


def normalize_items(items: list) -> list[str]:
    """
    Lista ya separada → lista normalizada con las MISMAS reglas (espacios,
    vacíos, largo, dedupe case-insensitive). Cada elemento se re-parsea por si
    trae separadores adentro ("pan y arroz" como un solo string del cliente).
    """
    if not isinstance(items, list):
        return []
    return parse_list_text(", ".join(str(i) for i in items))
