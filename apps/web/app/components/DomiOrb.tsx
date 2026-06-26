/**
 * DomiOrb / DomiConstellation — "Constelación inteligente del hogar".
 *
 * Núcleo ámbar cálido SIEMPRE (identidad), con halo modular vivo cuyo ACENTO
 * cambia por estado (sereno=salvia, motivado=dorado, atento=azul, cariñoso=coral,
 * protector=violeta). Alrededor orbitan chips de vidrio con iconos SVG propios
 * (sin emojis) de los módulos del hogar, órbitas finas y puntos de luz.
 *
 * Construido solo con divs + gradientes + SVG + animaciones CSS. Sin assets ni
 * dependencias externas. API estable (state/size/chips/showChips/label).
 */
import React from "react";
import DomiIcon, { ModuleKey, MODULE_COLOR, MODULE_LABEL } from "./domiIcons";
import DomiCoreImage from "./DomiCoreImage";

export type DomiState =
  | "sereno" | "motivado" | "atento" | "cariñoso" | "protector"
  | "pensando" | "logro" | "organizando";

export type DomiChip = { icon: ModuleKey; label?: string; active?: boolean };

const DEFAULT_CHIPS: DomiChip[] = [
  { icon: "home" }, { icon: "health" }, { icon: "shopping" },
  { icon: "message" }, { icon: "users" }, { icon: "shield" },
];

export { MODULE_LABEL };

export default function DomiOrb({
  state = "atento",
  size = 150,
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
  const list = (chips ?? DEFAULT_CHIPS).slice(0, 7);
  const withOrbits = showChips && size >= 96;       // órbitas/puntos solo en tamaño protagonista
  const cx = size / 2;
  const chipR = size * 0.46;
  const chipSize = Math.max(22, Math.round(size * 0.26));
  const coreSize = Math.round(size * (withOrbits ? 0.5 : 0.78));

  // puntos de luz a lo largo de la órbita (decorativos)
  const dots = withOrbits ? [18, 130, 250, 312] : [];

  return (
    <div
      className={`domiC domiC--${state}`}
      style={{ position: "relative", width: size, height: size, flex: "0 0 auto" }}
      role="img"
      aria-label={label || `Domi, núcleo del hogar (${state})`}
    >
      {/* halo de acento que respira detrás del núcleo */}
      <span className="domiCglow" />

      {/* órbitas finas + puntos de luz (SVG nítido) */}
      {withOrbits ? (
        <svg className="domiCorbits" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
          <ellipse className="domiCorbit o1" cx="50" cy="50" rx="46" ry="30" />
          <ellipse className="domiCorbit o2" cx="50" cy="50" rx="38" ry="46" />
          {dots.map((deg, i) => {
            const a = (deg * Math.PI) / 180;
            return <circle key={i} className="domiCdot" cx={50 + Math.cos(a) * 44} cy={50 + Math.sin(a) * 40} r="1.6" />;
          })}
        </svg>
      ) : null}

      {/* núcleo ámbar glossy con rostro sutil */}
      <span className="domiCcore" style={{ width: coreSize, height: coreSize }}>
        <svg className="domiCface" viewBox="0 0 60 40" width="62%" height="62%" aria-hidden="true">
          <path className="domiCeye" d="M19 19 Q23 14 27 19" />
          <path className="domiCeye" d="M33 19 Q37 14 41 19" />
          <path className="domiCmouth" d="M24 26 Q30 31 36 26" />
        </svg>
        {/* Si existe el PNG del render en /public/assistant/domi/, lo usa como núcleo */}
        <DomiCoreImage state={state} />
      </span>

      {/* chips modulares orbitando, con vidrio + icono SVG */}
      {showChips
        ? list.map((c, i) => {
            const angle = (-90 + i * (360 / list.length)) * (Math.PI / 180);
            const x = cx + Math.cos(angle) * chipR;
            const y = cx + Math.sin(angle) * chipR * 0.82;
            const color = MODULE_COLOR[c.icon] || "#C79A5B";
            return (
              <span
                key={c.label || c.icon}
                className={`domiCchip${c.active ? " active" : ""}`}
                title={c.label || MODULE_LABEL[c.icon]}
                aria-hidden="true"
                style={{
                  left: x, top: y, width: chipSize, height: chipSize,
                  ["--chip" as any]: color,
                }}
              >
                <DomiIcon name={c.icon} size={Math.round(chipSize * 0.5)} color={color} strokeWidth={2.1} />
              </span>
            );
          })
        : null}
    </div>
  );
}
