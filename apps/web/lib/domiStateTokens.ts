/**
 * domiStateTokens — estados emocionales de Domi (referencia canónica del owner).
 * "Tu compañía IA." Tono cálido, atento, siempre cerca.
 *
 * Una sola fuente de verdad para color/expresión/movimiento/copy por estado.
 * No hardcodear colores sueltos en componentes: consumir estos tokens.
 */
export type DomiState =
  | "sereno" | "atento" | "escuchando" | "cercano"
  | "protector" | "alegre" | "pensando" | "esperando_confirmacion";

export type DomiExpression =
  | "eyes-closed" | "eyes-open-soft" | "focused" | "warm-smile"
  | "firm" | "open-smile" | "neutral" | "prudent";

export type DomiMotion =
  | "slow-breathe" | "stable" | "audio-waves" | "hug-pulse"
  | "shield" | "sparkle" | "orbits-align" | "controlled-pulse";

export type DomiToken = {
  core: string; coreLight: string; halo: string; accent: string;
  surface: string; glow: string;
  expression: DomiExpression; motion: DomiMotion;
  label: string; shortMessage: string;
};

export const DOMI_STATES: DomiState[] = [
  "sereno", "atento", "escuchando", "cercano", "protector", "alegre", "pensando", "esperando_confirmacion",
];

export const DOMI_TOKENS: Record<DomiState, DomiToken> = {
  sereno: { core: "#F7C96B", coreLight: "#FFE9B5", halo: "#FFE9B5", accent: "#D7B46A", surface: "#FFF3D8", glow: "#CFA34D", expression: "eyes-closed", motion: "slow-breathe", label: "Sereno", shortMessage: "Estoy en calma contigo." },
  atento: { core: "#FFD56E", coreLight: "#FFF1B8", halo: "#FFF1B8", accent: "#F2A93B", surface: "#FFF7DF", glow: "#E6A33A", expression: "eyes-open-soft", motion: "stable", label: "Atento", shortMessage: "Estoy atento a tu hogar." },
  escuchando: { core: "#FFC857", coreLight: "#FFE7A3", halo: "#FFE7A3", accent: "#5FD6C5", surface: "#EFFFFB", glow: "#2BBFAE", expression: "focused", motion: "audio-waves", label: "Escuchando", shortMessage: "Te escucho. Cuéntame qué necesitas." },
  cercano: { core: "#FFB86B", coreLight: "#FFD7C2", halo: "#FFD7C2", accent: "#FF8FA3", surface: "#FFF0EA", glow: "#EF7C8E", expression: "warm-smile", motion: "hug-pulse", label: "Cercano", shortMessage: "Estoy aquí para acompañarte." },
  protector: { core: "#E9B85E", coreLight: "#FFE6B8", halo: "#DCC7FF", accent: "#8B6DFF", surface: "#F2EEFF", glow: "#7657E8", expression: "firm", motion: "shield", label: "Protector", shortMessage: "Cuidemos esto con calma y seguridad." },
  alegre: { core: "#FFC75A", coreLight: "#FFE8A8", halo: "#FFE8A8", accent: "#FF9F6E", surface: "#FFF4DE", glow: "#FF9F43", expression: "open-smile", motion: "sparkle", label: "Alegre", shortMessage: "Listo. Lo hicimos juntos." },
  pensando: { core: "#F6C45F", coreLight: "#FFE6A8", halo: "#BFD7FF", accent: "#6EA8FF", surface: "#EEF6FF", glow: "#4F8FEA", expression: "neutral", motion: "orbits-align", label: "Pensando", shortMessage: "Estoy ordenando la información." },
  esperando_confirmacion: { core: "#FFC15E", coreLight: "#FFE0A8", halo: "#FFE0A8", accent: "#F06F5F", surface: "#FFF1E8", glow: "#E95F4F", expression: "prudent", motion: "controlled-pulse", label: "Esperando confirmación", shortMessage: "Esto necesita confirmación humana." },
};

/** Mapa de estados operativos/legados → estado emocional. */
export const TO_EMOTION: Record<string, DomiState> = {
  listo: "atento", atento: "atento",
  escuchando: "escuchando", listening: "escuchando",
  pensando: "pensando", thinking: "pensando",
  acompanando: "cercano", cercano: "cercano", calm: "sereno", calma: "sereno", sereno: "sereno",
  proponiendo: "atento",
  esperando: "esperando_confirmacion", esperando_confirmacion: "esperando_confirmacion",
  alerta: "protector", protector: "protector",
  logro: "alegre", alegre: "alegre", success: "alegre",
};

export function toEmotion(s: string | undefined | null): DomiState {
  if (!s) return "atento";
  return TO_EMOTION[s] || (DOMI_STATES.includes(s as DomiState) ? (s as DomiState) : "atento");
}
