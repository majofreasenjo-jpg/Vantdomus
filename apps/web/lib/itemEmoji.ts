/**
 * Emoji por producto de compras (estilo Bring!): reconocible de un vistazo.
 * Heurística por palabras clave en español. Si no calza, ícono genérico.
 */
const MAP: Array<[RegExp, string]> = [
  [/leche|yogur|yoghurt|queso|mantequilla|cream/i, "🥛"],
  [/pan|marraqueta|hallulla|baguette/i, "🍞"],
  [/huevo/i, "🥚"],
  [/arroz/i, "🍚"],
  [/fideo|pasta|ravioli|tallarin/i, "🍝"],
  [/manzana|fruta|pera|durazno/i, "🍎"],
  [/platano|banana/i, "🍌"],
  [/naranja|mandarina|limon/i, "🍊"],
  [/tomate/i, "🍅"],
  [/papa|papas|patata/i, "🥔"],
  [/zanahoria|verdura|lechuga|ensalada/i, "🥬"],
  [/palta|aguacate/i, "🥑"],
  [/carne|vacuno|posta|asado/i, "🥩"],
  [/pollo/i, "🍗"],
  [/pescado|salmon|merluza|atun/i, "🐟"],
  [/cafe|café/i, "☕"],
  [/te |té|hierba/i, "🍵"],
  [/azucar|azúcar/i, "🧂"],
  [/aceite/i, "🫒"],
  [/agua|bebida|jugo|gaseosa/i, "🧃"],
  [/cerveza|vino|trago/i, "🍷"],
  [/detergente|jabon|jabón|limpieza|cloro|lavaloza/i, "🧴"],
  [/papel|confort|servilleta|toalla/i, "🧻"],
  [/pañal|panal|bebe|bebé/i, "🍼"],
  [/mascota|perro|gato|alimento de/i, "🐾"],
  [/cartulina|lapiz|lápiz|cuaderno|colegio|goma|regla/i, "✏️"],
  [/paracetamol|ibuprofeno|remedio|medicamento|farmacia|pastilla/i, "💊"],
  [/gas |balon de gas|gas$/i, "🔥"],
];

export function itemEmoji(name: string): string {
  const n = name || "";
  for (const [re, emoji] of MAP) {
    if (re.test(n)) return emoji;
  }
  return "🛒";
}
