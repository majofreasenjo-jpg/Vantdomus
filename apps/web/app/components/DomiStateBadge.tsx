/**
 * DomiStateBadge — pill que muestra el estado emocional actual de Domi.
 */
import React from "react";
import type { DomiState } from "./DomiOrb";

// Acentos del canon "Constelación" (mismos que el halo del orbe).
const META: Record<DomiState, { label: string; color: string }> = {
  sereno: { label: "Sereno", color: "#5E9079" },
  motivado: { label: "Motivado", color: "#C98A2E" },
  atento: { label: "Atento", color: "#5E86C2" },
  "cariñoso": { label: "Cariñoso", color: "#D9745C" },
  protector: { label: "Protector", color: "#7C6BC4" },
  pensando: { label: "Pensando", color: "#8A7BD8" },
  logro: { label: "¡Logro!", color: "#3E9E73" },
  organizando: { label: "Organizando", color: "#C98A2E" },
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
