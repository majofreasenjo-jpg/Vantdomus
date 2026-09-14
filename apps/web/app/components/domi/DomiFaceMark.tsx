/**
 * DomiFaceMark — marca compacta de Domi (esfera glossy + caparazón + rostro
 * feliz) para superficies fuera de la home: login, loader de /hogar, etc.
 * Server-safe (solo SVG, sin hooks). Busca parecerse al Domi grande de la home
 * (núcleo cálido, brillo, cachetes suaves, ojos separados, sonrisa abierta).
 */
export default function DomiFaceMark({ size = 84 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden="true"
      style={{ display: "block", filter: "drop-shadow(0 12px 26px rgba(229,138,31,.38))" }}
    >
      <defs>
        <radialGradient id="domiCore" cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FFF6DE" />
          <stop offset="46%" stopColor="#F8B84E" />
          <stop offset="100%" stopColor="#E5851C" />
        </radialGradient>
        <radialGradient id="domiShell" cx="50%" cy="42%" r="60%">
          <stop offset="70%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(255,255,255,.5)" />
        </radialGradient>
      </defs>

      {/* caparazón de vidrio */}
      <circle cx="60" cy="60" r="57" fill="rgba(255,255,255,.14)" />
      <circle cx="60" cy="60" r="57" fill="url(#domiShell)" />
      {/* núcleo cálido */}
      <circle cx="60" cy="60" r="45" fill="url(#domiCore)" />
      {/* brillo superior */}
      <ellipse cx="45" cy="41" rx="13" ry="9" fill="rgba(255,255,255,.9)" />
      <circle cx="78" cy="40" r="3.5" fill="rgba(255,255,255,.6)" />
      {/* cachetes */}
      <ellipse cx="41" cy="72" rx="8" ry="5.2" fill="#FF8FA3" opacity="0.5" />
      <ellipse cx="79" cy="72" rx="8" ry="5.2" fill="#FF8FA3" opacity="0.5" />
      {/* ojos (separados) */}
      <ellipse cx="46" cy="61" rx="6" ry="7.6" fill="#3a2408" />
      <ellipse cx="74" cy="61" rx="6" ry="7.6" fill="#3a2408" />
      <circle cx="43.8" cy="57.6" r="1.9" fill="#fff" />
      <circle cx="71.8" cy="57.6" r="1.9" fill="#fff" />
      {/* sonrisa feliz abierta */}
      <path d="M50 73 Q60 86 70 73 Q60 79 50 73 Z" fill="#3a2408" />
    </svg>
  );
}
