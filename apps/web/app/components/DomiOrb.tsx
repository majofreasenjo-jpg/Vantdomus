/**
 * DomiOrb — Domi "Constelación": el orbe 3D (AssistantOrb, aporte de Antigravity)
 * escalado al tamaño pedido + chips de contexto orbitando alrededor.
 *
 * Mantiene la API previa (DomiState/size/chips) para no romper Panel/headers.
 * El orbe base mide 44px; lo escalamos con transform para cualquier `size`.
 */
import React from "react";
import AssistantOrb, { OrbState } from "./AssistantOrb";

export type DomiState =
  | "sereno" | "motivado" | "atento" | "cariñoso" | "protector"
  | "pensando" | "logro" | "organizando";

export type DomiChip = { icon: string; label: string; active?: boolean };

// Estados fieles al canon de la infografía:
//   Sereno/Motivado/Organizando = dorado (reposo) · Atento = AZUL · Cariñoso = CORAL
//   Protector = MORADO/lavanda · Pensando = thinking · Logro = verde éxito.
const STATE_MAP: Record<DomiState, OrbState> = {
  sereno: "idle",
  motivado: "idle",
  organizando: "idle",
  atento: "listening",   // azul — "te escucho / detecto señales"
  cariñoso: "calm",      // coral — cercanía y calidez
  protector: "alert",    // morado/lavanda — cuida y alerta a tiempo
  pensando: "thinking",
  logro: "success",
};

const DEFAULT_CHIPS: DomiChip[] = [
  { icon: "🏠", label: "Hogar" },
  { icon: "❤️", label: "Salud" },
  { icon: "🛒", label: "Compras" },
  { icon: "✉️", label: "Mensajes" },
  { icon: "👨‍👩‍👧", label: "Familia" },
  { icon: "🛡️", label: "Seguridad" },
];

const ORB_BASE = 44; // tamaño natural de AssistantOrb

export default function DomiOrb({
  state = "sereno",
  size = 120,
  chips,
  showChips = true,
  label,
}: {
  state?: DomiState;
  size?: number;
  chips?: DomiChip[];
  showChips?: boolean;
  label?: string;
}) {
  const list = (chips ?? DEFAULT_CHIPS).slice(0, 6);
  const radius = size * 0.62;
  const scale = size / ORB_BASE;

  return (
    <div
      className="domiOrb"
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
        ["--domi-size" as any]: `${size}px`,
        ["--domi-glow" as any]: "#FFCD88",
      }}
      role="img"
      aria-label={label || `Domi, asistente del hogar (${state})`}
    >
      {/* Orbe 3D (Antigravity) escalado al tamaño pedido */}
      <span style={{ transform: `scale(${scale})`, transformOrigin: "center", lineHeight: 0, display: "inline-flex" }}>
        <AssistantOrb state={STATE_MAP[state]} showLabel={false} label={label} />
      </span>

      {/* Chips de contexto orbitando */}
      {showChips
        ? list.map((c, i) => {
            const angle = (-90 + i * (360 / list.length)) * (Math.PI / 180);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            return (
              <span
                key={c.label}
                className={`domiChip${c.active ? " active" : ""}`}
                title={c.label}
                aria-hidden="true"
                style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)` }}
              >
                {c.icon}
              </span>
            );
          })
        : null}
    </div>
  );
}
