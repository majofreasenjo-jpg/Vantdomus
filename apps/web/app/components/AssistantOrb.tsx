/**
 * AssistantOrb — "Domi", el asistente vivo de VantDomus Hogar.
 *
 * Diseño 3D en CSS (esfera glossy con degradado radial + dos anillos orbitales
 * en perspectiva 3D + rostro animado por estado). Sin dependencias ni assets.
 * Respeta prefers-reduced-motion (ver globals.css, bloque .assistantOrb).
 * Aporte de diseño integrado desde Google Antigravity y unificado en este repo.
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
      <span className="aoInner">
        <span className="aoRings">
          <span className="aoRing aoRing1" />
          <span className="aoRing aoRing2" />
        </span>
        <span className="aoFace">
          <span className="aoEye aoEyeLeft" />
          <span className="aoEye aoEyeRight" />
          <span className="aoMouth" />
        </span>
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
