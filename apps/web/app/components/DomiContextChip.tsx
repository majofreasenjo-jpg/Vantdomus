/**
 * DomiContextChip — chip de contexto (módulo del hogar) con icono + etiqueta y
 * un contador/estado opcional. Para filas de resumen bajo Domi.
 */
import React from "react";

export default function DomiContextChip({
  icon,
  label,
  hint,
  href,
  active = false,
}: {
  icon: string;
  label: string;
  hint?: string;
  href?: string;
  active?: boolean;
}) {
  const inner = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span
        aria-hidden="true"
        style={{
          width: 30, height: 30, borderRadius: 10, display: "inline-flex",
          alignItems: "center", justifyContent: "center", fontSize: 16, flex: "0 0 auto",
          background: active ? "color-mix(in srgb, #FFCD88 35%, transparent)" : "var(--bg)",
          border: `1px solid ${active ? "#E8A23C" : "var(--line)"}`,
        }}
      >{icon}</span>
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
