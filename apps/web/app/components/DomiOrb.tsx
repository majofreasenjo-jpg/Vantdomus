/**
 * DomiOrb — "Constelación inteligente del hogar" (dirección visual canónica).
 *
 * Núcleo luminoso cálido + rostro amable + halo + órbitas + chips de contexto
 * orbitando. Puro CSS/SVG (sin Lottie/Rive), liviano, responsive y reusable.
 * Server o Client Component (sin hooks).
 *
 * Estados emocionales: sereno · motivado · atento · cariñoso · protector
 * (+ comportamientos: pensando, logro, organizando).
 *   - sereno     → dorado, respiración suave del núcleo
 *   - motivado   → dorado intenso, energía
 *   - atento     → acento azul, detecta señales
 *   - cariñoso   → coral, pulso suave
 *   - protector  → violeta/azul, escudo activo
 *   - pensando   → órbitas giran
 *   - logro      → halo se expande y destella
 *   - organizando→ chips se alinean
 */
import React from "react";

export type DomiState =
  | "sereno" | "motivado" | "atento" | "cariñoso" | "protector"
  | "pensando" | "logro" | "organizando";

export type DomiChip = { icon: string; label: string; active?: boolean };

const DEFAULT_CHIPS: DomiChip[] = [
  { icon: "🏠", label: "Hogar" },
  { icon: "❤️", label: "Salud" },
  { icon: "🛒", label: "Compras" },
  { icon: "✉️", label: "Mensajes" },
  { icon: "👨‍👩‍👧", label: "Familia" },
  { icon: "🛡️", label: "Seguridad" },
];

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
  const radius = size * 0.62; // distancia del chip al centro
  const showShield = state === "protector";

  return (
    <div
      className={`domiOrb domi-${state}`}
      style={{ ["--domi-size" as any]: `${size}px`, ["--domi-radius" as any]: `${radius}px` }}
      role="img"
      aria-label={label || `Domi, asistente del hogar (${state})`}
    >
      <span className="domiHalo" aria-hidden="true" />
      {showChips ? (
        <>
          <span className="domiRing domiRing1" aria-hidden="true" />
          <span className="domiRing domiRing2" aria-hidden="true" />
          {list.map((c, i) => {
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
          })}
        </>
      ) : null}
      <span className="domiCore" aria-hidden="true">
        <svg className="domiFace" viewBox="0 0 100 64" width="62%" height="62%">
          {/* Ojos: abiertos (atento), curvos felices (logro/idle), pupila con mirada */}
          <g className="domiEyes">
            <ellipse className="domiEyeBall l" cx="32" cy="30" rx="7" ry="9" />
            <ellipse className="domiEyeBall r" cx="68" cy="30" rx="7" ry="9" />
            <path className="domiEyeHappy l" d="M22 30 Q32 19 42 30" />
            <path className="domiEyeHappy r" d="M58 30 Q68 19 78 30" />
            <path className="domiMouth" d="M40 44 Q50 52 60 44" />
          </g>
        </svg>
        {/* Puntos de "pensando" */}
        <span className="domiDots" aria-hidden="true"><i></i><i></i><i></i></span>
        {showShield ? <span className="domiShield" aria-hidden="true">🛡️</span> : null}
      </span>
    </div>
  );
}
