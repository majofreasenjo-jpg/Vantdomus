/**
 * domiModeTokens — "Selector de Domi" (PREPARACIÓN, no feature profunda aún).
 *
 * Un MISMO Domi con modos visuales/relacionales: no son bots distintos.
 * Domi conserva identidad única; cada modo adapta paleta/halo/expresión/ritmo/
 * microcopy/acciones/nivel de detalle/tipo de tarjetas, por persona, contexto y
 * momento.
 *
 * Esto sólo deja TOKENS + ESTRUCTURA + NAMING listos. NO se cablea a la UI hasta
 * que la home premium esté aprobada. Reutiliza estados emocionales (domiStateTokens)
 * y temas de ambiente (domiThemes). Ubicación futura: Ajustes de Domi, onboarding
 * familiar, perfil por integrante, selector rápido desde la home.
 */
import type { DomiState } from "./domiStateTokens";
import type { ThemeKey } from "./domiThemes";
import type { ModuleKey } from "../app/components/domiIcons";

export type DomiMode =
  | "clasico" | "calma" | "senior" | "estudio" | "protector" | "noche";

export type DomiModeToken = {
  label: string;
  tagline: string;                       // microcopy corto del modo
  icon: ModuleKey;
  defaultState: DomiState;               // estado emocional base
  suggestedTheme: ThemeKey;              // ambiente sugerido (no obligatorio)
  motion: "lenta" | "calma" | "normal" | "alerta"; // ritmo de animación
  detail: "alto" | "medio" | "bajo";     // densidad / nivel de detalle
  cardStyle: "full" | "large" | "glance"; // tipo de tarjetas
  suggested: string[];                   // acciones sugeridas (frases para Domi)
};

export const DOMI_MODES: DomiMode[] = ["clasico", "calma", "senior", "estudio", "protector", "noche"];

export const DOMI_MODE_TOKENS: Record<DomiMode, DomiModeToken> = {
  clasico: {
    label: "Domi Clásico", tagline: "Tu hogar, en orden.", icon: "home",
    defaultState: "atento", suggestedTheme: "day", motion: "normal", detail: "alto", cardStyle: "full",
    suggested: ["ordenar mi día", "qué falta hoy", "agrega leche, pan y paracetamol"],
  },
  calma: {
    label: "Domi Calma", tagline: "Respira. Estoy contigo.", icon: "calm",
    defaultState: "sereno", suggestedTheme: "sunset", motion: "calma", detail: "bajo", cardStyle: "large",
    suggested: ["respiración", "pon música tranquila"],
  },
  senior: {
    label: "Domi Senior", tagline: "Estoy aquí para acompañarte.", icon: "users",
    defaultState: "cercano", suggestedTheme: "day", motion: "lenta", detail: "bajo", cardStyle: "large",
    suggested: ["cómo amaneciste", "medicamento de Elena", "avisar a la familia", "pon música tranquila"],
  },
  estudio: {
    label: "Domi Estudio", tagline: "Vamos con el estudio.", icon: "clipboard",
    defaultState: "atento", suggestedTheme: "day", motion: "normal", detail: "medio", cardStyle: "full",
    suggested: ["prepara estudio para Diego", "qué hay hoy"],
  },
  protector: {
    label: "Domi Protector", tagline: "Cuido lo importante.", icon: "shield",
    defaultState: "protector", suggestedTheme: "night", motion: "alerta", detail: "medio", cardStyle: "full",
    suggested: ["medicamento de Elena", "qué documentos faltan revisar"],
  },
  noche: {
    label: "Domi Noche", tagline: "Cerremos el día con calma.", icon: "calm",
    defaultState: "sereno", suggestedTheme: "night", motion: "lenta", detail: "bajo", cardStyle: "glance",
    suggested: ["resumen del día", "respiración", "pon música tranquila"],
  },
};

/** Resolver un modo desde string (futuro: ?domiMode= / perfil / ajustes). */
export function toMode(s: string | undefined | null): DomiMode {
  return s && (DOMI_MODES as string[]).includes(s) ? (s as DomiMode) : "clasico";
}
