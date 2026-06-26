/**
 * DomiPanel — cabecera "constelación" del hogar: DomiOrb (con chips orbitando)
 * + saludo/resumen narrado + badge de estado + chips de contexto con accesos.
 * Server Component (sin hooks).
 */
import React from "react";
import DomiOrb, { DomiState, DomiChip } from "./DomiOrb";
import DomiStateBadge from "./DomiStateBadge";
import DomiContextChip from "./DomiContextChip";

export default function DomiPanel({
  state = "sereno",
  familyName,
  headline,
  lines = [],
  note,
  orbitChips,
  contextChips = [],
}: {
  state?: DomiState;
  familyName: string;
  headline: string;
  lines?: string[];
  note?: string;
  orbitChips?: DomiChip[];
  contextChips?: { icon: string; label: string; hint?: string; href?: string; active?: boolean }[];
}) {
  return (
    <div className="card" style={{ marginBottom: 18, padding: 22, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 40, alignItems: "center", flexWrap: "wrap" }}>
        {/* Ancho reservado mayor que el orbe (150) para que los chips de la
            constelación no queden pegados al texto. */}
        <div style={{ flex: "0 0 auto", display: "flex", justifyContent: "center", minWidth: 196 }}>
          <DomiOrb state={state} size={150} chips={orbitChips} />
        </div>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div className="row" style={{ justifyContent: "flex-start", gap: 10, marginBottom: 4 }}>
            <span className="small" style={{ color: "var(--muted)" }}>{familyName}</span>
            <DomiStateBadge state={state} />
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.25 }}>{headline}</div>
          {lines.length > 0 ? (
            <ul style={{ margin: "10px 0 0 0", paddingLeft: 20, color: "var(--muted)", lineHeight: 1.7 }}>
              {lines.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          ) : null}
          {note ? (
            <div className="small" style={{ marginTop: 8, color: "var(--muted)", fontStyle: "italic" }}>{note}</div>
          ) : null}
        </div>
      </div>

      {contextChips.length > 0 ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          {contextChips.map((c) => (
            <DomiContextChip key={c.label} icon={c.icon} label={c.label} hint={c.hint} href={c.href} active={c.active} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
