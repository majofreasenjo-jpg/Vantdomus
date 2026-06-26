/**
 * AssistantOrb — wrapper de compatibilidad sobre DomiOrb.
 *
 * Domi ahora vive en DomiOrb ("Constelación inteligente del hogar"). Este
 * componente mantiene la API previa (state idle/thinking/success/alert/calm/
 * listening + label) que usan avisos/compras/actividades, y delega en DomiOrb
 * con el estado mapeado, en versión compacta (sin chips orbitando).
 */
import React from "react";
import DomiOrb, { DomiState } from "./DomiOrb";

export type OrbState = "idle" | "thinking" | "success" | "alert" | "calm" | "listening";

const STATE_MAP: Record<OrbState, DomiState> = {
  idle: "sereno",
  calm: "sereno",
  thinking: "pensando",
  success: "logro",
  alert: "atento",
  listening: "atento",
};

const DEFAULT_LABELS: Record<OrbState, string> = {
  idle: "Estoy aquí para ayudarte a ordenar el hogar.",
  thinking: "Estoy revisando el documento.",
  success: "Listo, lo dejé organizado.",
  alert: "Encontré algo importante, revísalo antes de activar.",
  calm: "Vamos paso a paso.",
  listening: "Te escucho.",
};

export default function AssistantOrb({
  state = "idle",
  label,
  compact = false,
  showLabel = true,
}: {
  state?: OrbState;
  label?: string;
  compact?: boolean;
  showLabel?: boolean;
}) {
  const text = label !== undefined ? label : DEFAULT_LABELS[state];
  const orb = <DomiOrb state={STATE_MAP[state]} size={compact ? 34 : 48} showChips={false} label={text || undefined} />;
  if (!showLabel || !text) return orb;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {orb}
      <span className="aoLabel" style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.35, maxWidth: 320 }}>{text}</span>
    </span>
  );
}
