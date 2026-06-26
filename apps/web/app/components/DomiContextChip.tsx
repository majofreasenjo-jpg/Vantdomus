/**
 * DomiContextChip — chip de contexto (módulo del hogar) con icono + etiqueta y
 * un contador/estado opcional. Para filas de resumen bajo Domi.
 */
import React from "react";
import DomiIcon, { ModuleKey, MODULE_COLOR } from "./domiIcons";

export default function DomiContextChip({
  icon,
  label,
  hint,
  href,
  active = false,
}: {
  icon: ModuleKey;
  label: string;
  hint?: string;
  href?: string;
  active?: boolean;
}) {
  const color = MODULE_COLOR[icon] || "#C79A5B";
  const inner = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span
        aria-hidden="true"
        style={{
          width: 30, height: 30, borderRadius: 10, display: "inline-flex",
          alignItems: "center", justifyContent: "center", flex: "0 0 auto",
          background: `color-mix(in srgb, ${color} ${active ? 26 : 14}%, var(--bg))`,
          border: `1px solid color-mix(in srgb, ${color} ${active ? 70 : 45}%, transparent)`,
        }}
      ><DomiIcon name={icon} size={17} color={color} strokeWidth={2.1} /></span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 700, fontSize: 13, lineHeight: 1.1 }}>{label}</span>
        {hint ? <span className="small" style={{ color: "var(--muted)" }}>{hint}</span> : null}
      </span>
    </span>
  );
  const style: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", padding: "8px 12px",
    borderRadius: 12, border: "1px solid var(--line)", background: "var(--card, #fff)",
    textDecoration: "none", color: "inherit",
  };
  return href ? <a href={href} style={style}>{inner}</a> : <span style={style}>{inner}</span>;
}
