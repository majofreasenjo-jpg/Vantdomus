/**
 * Identidad de color por integrante (patrón Cozi/Skylight).
 *
 * Cada persona del hogar recibe un color estable que la acompaña en toda la app
 * (actividades, compras asignadas, avisos), para que la familia "lea" de un
 * vistazo de quién es cada cosa. Determinístico por id/nombre → sin backend.
 *
 * Paleta cálida y de buen contraste, coherente con el tema "Arena & Salvia".
 */

export type MemberColor = { bg: string; fg: string; soft: string };

// 8 colores diferenciables, todos con texto blanco legible encima (fg).
const PALETTE: MemberColor[] = [
  { bg: "#4A7A6B", fg: "#ffffff", soft: "#E6EFEA" }, // salvia
  { bg: "#C2703D", fg: "#ffffff", soft: "#F6E7DC" }, // terracota
  { bg: "#5B7DA6", fg: "#ffffff", soft: "#E2E9F1" }, // azul polvo
  { bg: "#9C6FA6", fg: "#ffffff", soft: "#EFE6F1" }, // ciruela
  { bg: "#B08A2E", fg: "#ffffff", soft: "#F3EBD5" }, // mostaza
  { bg: "#A85765", fg: "#ffffff", soft: "#F2E2E5" }, // rosa arcilla
  { bg: "#6E8B43", fg: "#ffffff", soft: "#EAEFDD" }, // oliva
  { bg: "#3E8E96", fg: "#ffffff", soft: "#DEEDEE" }, // verde agua
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Color estable para una persona. Usa el id si existe; si no, el nombre. */
export function memberColor(key: string | undefined | null): MemberColor {
  const k = (key || "").trim() || "default";
  return PALETTE[hashString(k) % PALETTE.length];
}

/** Iniciales de un nombre: "María José" → "MJ", "Diego" → "D". */
export function initials(name: string | undefined | null): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
