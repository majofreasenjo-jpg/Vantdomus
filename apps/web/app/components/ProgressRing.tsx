/**
 * ProgressRing — anillo de progreso (CSS conic-gradient). Para "completado hoy"
 * por integrante / hogar. Server o Client (sin hooks).
 */
import React from "react";

export default function ProgressRing({
  value,
  size = 40,
  color = "#4A7A6B",
  label,
}: {
  value: number; // 0..100
  size?: number;
  color?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const thickness = Math.max(3, Math.round(size * 0.12));
  return (
    <span
      role="img"
      aria-label={label || `${pct}% completado`}
      title={label || `${pct}%`}
      style={{
        width: size, height: size, borderRadius: "50%", flex: "0 0 auto",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: `conic-gradient(${color} ${pct * 3.6}deg, color-mix(in srgb, ${color} 16%, transparent) 0deg)`,
      }}
    >
      <span
        style={{
          width: size - thickness * 2, height: size - thickness * 2, borderRadius: "50%",
          background: "var(--card, #fff)", display: "inline-flex", alignItems: "center",
          justifyContent: "center", fontSize: Math.round(size * 0.26), fontWeight: 800, color,
        }}
      >
        {pct}%
      </span>
    </span>
  );
}
