/**
 * DomiCore — Domi vivo, la INTERFAZ del hogar (companion-first).
 *
 * 100% CSS/SVG, sin foto ni raster. Núcleo ámbar cálido siempre; el ESTADO
 * cambia el acento del halo + el gesto del rostro. Sin dependencias ni assets.
 * Respeta prefers-reduced-motion (ver globals.css, bloque .dcore).
 */
import React from "react";

export type DomiState =
  | "listo" | "escuchando" | "pensando" | "acompanando"
  | "proponiendo" | "esperando" | "calma" | "alerta";

export default function DomiCore({
  state = "listo",
  size = 180,
  label,
}: {
  state?: DomiState;
  size?: number;
  label?: string;
}) {
  const withOrbits = size >= 92;
  return (
    <div
      className={`dcore dcore--${state}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label || `Domi, asistente del hogar (${state})`}
    >
      <span className="dcoreHalo" aria-hidden="true" />
      {withOrbits ? (
        <svg className="dcoreOrbits" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
          <ellipse className="dcoreOrbit o1" cx="50" cy="50" rx="47" ry="30" />
          <ellipse className="dcoreOrbit o2" cx="50" cy="50" rx="36" ry="47" />
          <circle className="dcoreDot" cx="93" cy="50" r="1.8" />
          <circle className="dcoreDot" cx="12" cy="42" r="1.6" />
          <circle className="dcoreDot" cx="62" cy="6" r="1.5" />
        </svg>
      ) : null}
      <span className="dcoreBall" aria-hidden="true">
        <span className="dcoreStars" />
        <span className="dcoreSpecular" />
        <svg className="dcoreFace" viewBox="0 0 100 70">
          <g className="dcoreEyes">
            {/* ojos felices (cerrados) — por defecto */}
            <path className="eyeHappy" d="M27 35 Q37 27 47 35" />
            <path className="eyeHappy" d="M53 35 Q63 27 73 35" />
            {/* ojos redondos (escucha/pensando/alerta) */}
            <circle className="eyeBall" cx="37" cy="34" r="5.2" />
            <circle className="eyeBall" cx="63" cy="34" r="5.2" />
          </g>
          <path className="dcoreMouth" d="M40 48 Q50 56 60 48" />
        </svg>
        <span className="dcoreThinkDots"><i /><i /><i /></span>
      </span>
    </div>
  );
}
