/**
 * domiIcons — set de iconos SVG PROPIOS (sin emojis, sin dependencias externas).
 * Estilo lineal tipo "lucide", dibujados a mano (paths originales) para no
 * arrastrar ninguna librería ni asset con licencia dudosa.
 *
 * Cada módulo del hogar tiene su icono + color de acento (paleta cálida del canon
 * "Constelación inteligente del hogar").
 */
import React from "react";

export type ModuleKey =
  | "home" | "health" | "shopping" | "calendar" | "message"
  | "shield" | "users" | "clipboard" | "guide" | "book" | "file";

// Color de acento por módulo (vidrio/halo del chip)
export const MODULE_COLOR: Record<ModuleKey, string> = {
  home: "#C79A5B",      // arena dorada
  health: "#E8917E",    // coral
  shopping: "#7FB49C",  // verde salvia
  calendar: "#8FB3E0",  // azul niebla
  message: "#E0B770",   // champagne
  shield: "#9B8CD4",    // violeta protector
  users: "#D79BA8",     // rosa cálido
  clipboard: "#B79B78", // grafito cálido
  guide: "#9CB07F",     // oliva suave
  book: "#C9A26B",      // arena
  file: "#A8B0BC",      // gris niebla
};

export const MODULE_LABEL: Record<ModuleKey, string> = {
  home: "Hogar", health: "Salud", shopping: "Compras", calendar: "Agenda",
  message: "Mensajes", shield: "Seguridad", users: "Familia", clipboard: "Tareas",
  guide: "Guía", book: "Biblioteca", file: "Documentos",
};

const PATHS: Record<ModuleKey, React.ReactNode> = {
  home: (<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></>),
  health: (<><path d="M12 20.5C7 16.8 3.2 13.3 3.2 9.3A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8.8 2.3c0 1.7-.7 3.2-1.8 4.6" /><path d="M11 13h2.2l1.2-2.2 1.6 4 1-1.8H20" /></>),
  shopping: (<><circle cx="9.5" cy="20" r="1.2" /><circle cx="18" cy="20" r="1.2" /><path d="M2.5 3.5h2.2l2.3 12a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20.5 7H6" /></>),
  calendar: (<><rect x="3.2" y="4.5" width="17.6" height="16" rx="2.2" /><path d="M3.2 9.2h17.6M8 2.5v4M16 2.5v4M9 14.5l2 2 4-4" /></>),
  message: (<path d="M21 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.6A8 8 0 1 1 21 11.5z" />),
  shield: (<><path d="M12 3 19 6v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></>),
  users: (<><circle cx="9" cy="8" r="3.2" /><path d="M3.6 20a5.5 5.5 0 0 1 10.8 0" /><path d="M15.8 5.2a3.2 3.2 0 0 1 0 6.2M16.6 14.2a5.5 5.5 0 0 1 4.2 5.8" /></>),
  clipboard: (<><rect x="5" y="4.5" width="14" height="16" rx="2" /><path d="M9 4.5V3.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M9 13l2 2 4-4" /></>),
  guide: (<><circle cx="12" cy="12" r="9" /><path d="M16 8l-2.6 5.4L8 16l2.6-5.4z" /></>),
  book: (<><path d="M12 6.2C10.5 5 8 4.2 6 4.2H3v13h3c2 0 4.5.8 6 2 1.5-1.2 4-2 6-2h3v-13h-3c-2 0-4.5.8-6 2z" /><path d="M12 6.2v13" /></>),
  file: (<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>),
};

export default function DomiIcon({
  name, size = 18, color = "currentColor", strokeWidth = 2,
}: { name: ModuleKey; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
