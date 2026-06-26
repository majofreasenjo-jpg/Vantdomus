/**
 * DomiStateBadge — pill que muestra el estado emocional actual de Domi.
 */
import React from "react";
import type { DomiState } from "./DomiOrb";

const META: Record<DomiState, { label: string; color: string }> = {
  sereno: { label: "Sereno", color: "#C28A2E" },
  motivado: { label: "Motivado", color: "#E07B1A" },
  atento: { label: "Atento", color: "#5B7CFF" },
  "cariñoso": { label: "Cariñoso", color: "#E8845C" },
  protector: { label: "Protector", color: "#6A5BFF" },
  pensando: { label: "Pensando", color: "#8A7BD8" },
  logro: { label: "¡Logro!", color: "#2E9E6B" },
  organizando: { label: "Organizando", color: "#C28A2E" },
};

export default function DomiStateBadge({ state }: { state: DomiState }) {
  const m = META[state] || META.sereno;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
        color: m.color, border: `1px solid ${m.color}55`,
        background: `${m.color}14`,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: m.color, flex: "0 0 auto" }} />
      Domi · {m.label}
    </span>
  );
}
