/**
 * DomiCore — "Tu compañía IA": presencia cálida y viva del hogar (no mascota).
 *
 * Núcleo de vidrio con luz + halo + órbitas 3D + chips sutiles + rostro mínimo.
 * El color/expresión/movimiento vienen de los tokens emocionales
 * (lib/domiStateTokens) — una sola fuente de verdad. 100% CSS/SVG, sin foto.
 */
import React from "react";
import DomiIcon, { ModuleKey, MODULE_COLOR } from "./domiIcons";
import { DOMI_TOKENS, type DomiState } from "../../lib/domiStateTokens";

export type { DomiState };

const CHIPS: ModuleKey[] = ["home", "health", "shopping", "message", "users", "shield"];

export default function DomiCore({
  state = "atento",
  size = 160,
  label,
  constellation = true,
}: {
  state?: DomiState;
  size?: number;
  label?: string;
  constellation?: boolean;
}) {
  const tk = DOMI_TOKENS[state] || DOMI_TOKENS.atento;
  const rich = constellation && size >= 110;
  const cx = size / 2;
  const chipR = size * 0.52;
  const chipSize = Math.max(20, Math.round(size * 0.17));

  return (
    <div
      className={`dcore dcore--${state}${rich ? " dcore--rich" : ""}`}
      style={{
        width: size, height: size,
        ["--dc-accent" as any]: tk.accent,
        ["--dc-core" as any]: tk.core,
        ["--dc-hi" as any]: tk.coreLight,
        ["--dc-halo" as any]: tk.halo,
      }}
      role="img"
      aria-label={label || `Domi (${tk.label}): ${tk.shortMessage}`}
    >
      <span className="dcoreAura" aria-hidden="true" />

      {rich ? (
        <span className="dcoreOrbits" aria-hidden="true">
          <span className="dcoreRing dcoreRing1"><i /></span>
          <span className="dcoreRing dcoreRing2"><i /></span>
          <span className="dcoreRing dcoreRing3"><i /></span>
        </span>
      ) : null}

      {/* anillo escudo (protector) / ondas (escuchando) — decorativo por estado */}
      <span className="dcoreFx" aria-hidden="true" />

      <span className="dcoreNucleus" aria-hidden="true">
        <span className="dcoreStars" />
        <span className="dcoreGloss" />
        <svg className="dcoreFace" viewBox="0 0 100 64">
          <ellipse className="dCheek" cx="29" cy="41" rx="6.5" ry="3.8" />
          <ellipse className="dCheek" cx="71" cy="41" rx="6.5" ry="3.8" />
          <ellipse className="dEye" cx="37" cy="30" rx="4.7" ry="5.8" />
          <ellipse className="dEye" cx="63" cy="30" rx="4.7" ry="5.8" />
          <circle className="dShine" cx="38.9" cy="27.6" r="1.8" />
          <circle className="dShine" cx="64.9" cy="27.6" r="1.8" />
          <circle className="dShine dShineSm" cx="35.6" cy="31.6" r="0.9" />
          <circle className="dShine dShineSm" cx="61.6" cy="31.6" r="0.9" />
          <path className="dEyeClosed" d="M31 30 Q37 35 43 30" />
          <path className="dEyeClosed" d="M57 30 Q63 35 69 30" />
          <path className="dMouth" d="M41 42 Q50 49 59 42" />
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
