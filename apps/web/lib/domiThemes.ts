/**
 * domiThemes — temas dinámicos del ambiente (no de Domi).
 * "Un mismo Domi. Cada momento, tu ambiente."
 *
 * dawn / day / sunset / night → cada uno define variables CSS (--vd-*) que la UI
 * consume. Domi mantiene su identidad ámbar; el tema cambia el ENTORNO.
 * Solo CSS (gradients/overlays). Sin imágenes pesadas ni servicios externos.
 */
export type ThemeKey = "dawn" | "day" | "sunset" | "night";

export const THEME_ORDER: ThemeKey[] = ["dawn", "day", "sunset", "night"];

export const THEME_LABEL: Record<ThemeKey, string> = {
  dawn: "Amanecer", day: "Día", sunset: "Atardecer", night: "Noche",
};

/** Tema automático según la hora local. */
export function themeForHour(h: number): ThemeKey {
  if (h >= 5 && h < 11) return "dawn";
  if (h >= 11 && h < 17) return "day";
  if (h >= 17 && h < 21) return "sunset";
  return "night";
}

/** Saludo coherente con el momento del día. */
export const THEME_GREETING: Record<ThemeKey, string> = {
  dawn: "Buenos días",
  day: "Buenas tardes",
  sunset: "Buenas noches",
  night: "Estoy aquí si necesitas compañía",
};

/** Variables CSS por tema (se aplican en el shell). */
export const THEMES: Record<ThemeKey, Record<string, string>> = {
  // AMANECER — azul profundo con horizonte cálido, sensación de despertar
  dawn: {
    "--vd-bg": "radial-gradient(120% 80% at 50% 120%, rgba(214,128,58,.55) 0%, rgba(150,86,82,.25) 35%, transparent 60%), linear-gradient(180deg, #16213f 0%, #243456 45%, #3c3a54 72%, #6b4a4a 100%)",
    "--vd-stage": "linear-gradient(180deg, rgba(22,33,63,.86) 60%, rgba(22,33,63,0))",
    "--vd-surface": "rgba(28,40,70,.55)",
    "--vd-card": "rgba(30,43,74,.62)",
    "--vd-card-border": "rgba(255,225,180,.14)",
    "--vd-text": "#F6EFE3",
    "--vd-muted": "#C3C9DC",
    "--vd-glow": "#F2A93B",
    "--vd-nav": "rgba(22,33,63,.55)",
    "--vd-input": "rgba(34,48,82,.72)",
    "--vd-shadow": "0 14px 40px rgba(0,0,0,.35)",
  },
  // DÍA — claro premium (no beige plano): blanco cálido, azul muy suave, dorado leve
  day: {
    "--vd-bg": "radial-gradient(80% 50% at 50% -6%, rgba(232,176,75,.14), transparent 60%), radial-gradient(90% 60% at 50% 110%, rgba(110,151,218,.12), transparent 70%), linear-gradient(180deg, #FCFDFF 0%, #F3F7FD 55%, #EEF0F7 100%)",
    "--vd-stage": "linear-gradient(180deg, rgba(252,253,255,.82) 60%, rgba(252,253,255,0))",
    "--vd-surface": "rgba(255,255,255,.7)",
    "--vd-card": "rgba(255,255,255,.86)",
    "--vd-card-border": "rgba(40,60,95,.10)",
    "--vd-text": "#2B3140",
    "--vd-muted": "#69728A",
    "--vd-glow": "#E8B04B",
    "--vd-nav": "rgba(255,255,255,.72)",
    "--vd-input": "rgba(255,255,255,.92)",
    "--vd-shadow": "0 12px 34px rgba(90,110,140,.16)",
  },
  // ATARDECER — cálido, interior/hogar, naranja profundo
  sunset: {
    "--vd-bg": "radial-gradient(120% 80% at 50% 120%, rgba(224,140,62,.6) 0%, rgba(150,70,46,.3) 38%, transparent 62%), linear-gradient(180deg, #2c1d2e 0%, #5c3330 45%, #94512c 78%, #c47a3a 100%)",
    "--vd-stage": "linear-gradient(180deg, rgba(44,29,46,.86) 60%, rgba(44,29,46,0))",
    "--vd-surface": "rgba(60,34,40,.5)",
    "--vd-card": "rgba(66,38,42,.6)",
    "--vd-card-border": "rgba(255,210,165,.16)",
    "--vd-text": "#FBEFE2",
    "--vd-muted": "#E2C7B3",
    "--vd-glow": "#F0853C",
    "--vd-nav": "rgba(44,29,46,.55)",
    "--vd-input": "rgba(74,42,42,.72)",
    "--vd-shadow": "0 14px 40px rgba(0,0,0,.4)",
  },
  // NOCHE — azul noche / índigo / violeta, profundidad cinematográfica
  night: {
    "--vd-bg": "radial-gradient(90% 60% at 50% 0%, rgba(139,109,255,.18), transparent 55%), radial-gradient(100% 70% at 50% 120%, rgba(232,176,75,.12), transparent 60%), linear-gradient(180deg, #0d1230 0%, #161b40 50%, #241a46 100%)",
    "--vd-stage": "linear-gradient(180deg, rgba(13,18,48,.86) 60%, rgba(13,18,48,0))",
    "--vd-surface": "rgba(26,31,68,.55)",
    "--vd-card": "rgba(28,33,72,.62)",
    "--vd-card-border": "rgba(180,160,255,.16)",
    "--vd-text": "#EEEBF8",
    "--vd-muted": "#AEB2D4",
    "--vd-glow": "#8B6DFF",
    "--vd-nav": "rgba(13,18,48,.55)",
    "--vd-input": "rgba(30,36,80,.72)",
    "--vd-shadow": "0 16px 44px rgba(0,0,0,.5)",
  },
};
