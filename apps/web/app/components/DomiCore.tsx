/**
 * DomiCore — presencia tecnológica cálida del hogar (no mascota).
 *
 * Núcleo de vidrio con luz ámbar + halo ambiental emocional + órbitas 3D con
 * puntos de energía + rostro MÍNIMO y elegante + chips de módulo sutiles.
 * 100% CSS/SVG, sin foto ni assets. El estado cambia el acento de la luz y el
 * gesto. Respeta prefers-reduced-motion (ver globals.css, bloque .dcore).
 */
import React from "react";
import DomiIcon, { ModuleKey, MODULE_COLOR } from "./domiIcons";

export type DomiState =
  | "listo" | "escuchando" | "pensando" | "acompanando"
  | "proponiendo" | "esperando" | "calma" | "alerta";

const CHIPS: ModuleKey[] = ["home", "health", "shopping", "message", "users", "shield"];

export default function DomiCore({
  state = "listo",
  size = 160,
  label,
  constellation = true,
}: {
  state?: DomiState;
  size?: number;
  label?: string;
  constellation?: boolean;
}) {
  const rich = constellation && size >= 110; // órbitas + chips solo en tamaño protagonista
  const cx = size / 2;
  const chipR = size * 0.52;
  const chipSize = Math.max(20, Math.round(size * 0.17));

  return (
    <div
      className={`dcore dcore--${state}${rich ? " dcore--rich" : ""}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label || `Domi, núcleo del hogar (${state})`}
    >
      <span className="dcoreAura" aria-hidden="true" />

      {rich ? (
        <span className="dcoreOrbits" aria-hidden="true">
          <span className="dcoreRing dcoreRing1"><i /></span>
          <span className="dcoreRing dcoreRing2"><i /></span>
          <span className="dcoreRing dcoreRing3"><i /></span>
        </span>
      ) : null}

      <span className="dcoreNucleus" aria-hidden="true">
        <span className="dcoreStars" />
        <span className="dcoreGloss" />
        <svg className="dcoreFace" viewBox="0 0 100 60">
          <circle className="dEye" cx="38" cy="29" r="3.6" />
          <circle className="dEye" cx="62" cy="29" r="3.6" />
          <circle className="dShine" cx="39.2" cy="27.6" r="1.1" />
          <circle className="dShine" cx="63.2" cy="27.6" r="1.1" />
          <path className="dMouth" d="M42 39 Q50 44 58 39" />
        </svg>
      </span>

      {rich ? (
        <span className="dcoreChips" aria-hidden="true">
          {CHIPS.map((c, i) => {
            const a = (-90 + i * (360 / CHIPS.length)) * (Math.PI / 180);
            const x = cx + Math.cos(a) * chipR;
            const y = cx + Math.sin(a) * chipR * 0.92;
            return (
              <span key={c} className="dcoreChip" style={{ left: x, top: y, width: chipSize, height: chipSize, ["--chip" as any]: MODULE_COLOR[c] }}>
                <DomiIcon name={c} size={Math.round(chipSize * 0.5)} color={MODULE_COLOR[c]} strokeWidth={2} />
              </span>
            );
          })}
        </span>
      ) : null}
    </div>
  );
}
