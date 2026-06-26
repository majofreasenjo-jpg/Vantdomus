/**
 * AssistantOrb — "Domi", el asistente vivo original de VantDomus Hogar.
 *
 * MVP en CSS (sin dependencias ni assets con licencia). Animación liviana que
 * respeta prefers-reduced-motion (ver globals.css, bloque .assistantOrb) y tiene
 * fallback estático. Reemplazable luego por Lottie/Rive (ver
 * apps/web/public/assistant/README.md y docs/ASSISTANT_DOMI_CONCEPT.md).
 *
 * Sin hooks ni handlers: funciona como Server o Client Component.
 */
import React from "react";

export type OrbState = "idle" | "thinking" | "success" | "alert" | "calm" | "listening";

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
  const orb = (
    <span
      className={`assistantOrb ao-${state}${compact ? " compact" : ""}`}
      role="img"
      aria-label={`Domi, asistente de VantDomus${text ? `: ${text}` : ""}`}
    >
      {/* Cara de Domi: ojos que parpadean + boca que cambia según el estado.
          Puro CSS/markup, sin assets externos. */}
      <span className="aoFace" aria-hidden="true">
        <span className="aoEye l" />
        <span className="aoEye r" />
        <span className="aoMouth" />
      </span>
    </span>
  );
  if (!showLabel || !text) return orb;
  return (
    <span className="assistantOrbWrap">
      {orb}
      <span className="aoLabel">{text}</span>
    </span>
  );
}
