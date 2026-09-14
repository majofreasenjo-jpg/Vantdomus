/**
 * CP1c-FUNC-MIN-3.3a — Espejo del parser CANÓNICO de listas en lenguaje natural.
 *
 * La regla de verdad vive en el backend (`apps/api/app/assistant/nl_lists.py`)
 * y se aplica SIEMPRE en el servidor (validate_overrides + ejecución). Este
 * mirror existe solo para que el editor muestre al usuario la misma separación
 * que hará el servidor. Mantener las reglas idénticas al backend.
 *
 * Separadores: coma · punto y coma · salto de línea · " y " / " e " (palabra
 * completa). Colapsa espacios, elimina vacíos y duplicados (case-insensitive),
 * máx 20 elementos de 60 caracteres.
 */

const SEPARATORS = /,|;|\n|\r|\s+y\s+|\s+e\s+/i;
const MAX_ITEMS = 20;
const MAX_ITEM_LEN = 60;

export function parseListText(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(SEPARATORS)) {
    const item = (raw || "").trim().replace(/\s+/g, " ");
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.slice(0, MAX_ITEM_LEN));
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}
