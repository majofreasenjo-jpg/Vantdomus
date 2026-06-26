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
        <span className="aoHalo" />
        <span className="aoSpecular" />
        <span className="aoRings">
          <span className="aoRing aoRing1" />
          <span className="aoRing aoRing2" />
        </span>
        <span className="aoFace">
          <svg className="aoSvg" viewBox="0 0 100 64" width="100%" height="100%">
            <g className="aoEyes">
              <ellipse className="aoEyeBall aoEyeBallLeft" cx="32" cy="30" rx="7" ry="9" />
              <ellipse className="aoEyeBall aoEyeBallRight" cx="68" cy="30" rx="7" ry="9" />
              <path className="aoEyeHappy aoEyeHappyLeft" d="M22 30 Q32 19 42 30" />
              <path className="aoEyeHappy aoEyeHappyRight" d="M58 30 Q68 19 78 30" />
              <path className="aoMouth" d="M40 44 Q50 52 60 44" />
            </g>
          </svg>
        </span>
        <span className="aoDots"><i></i><i></i><i></i></span>
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
