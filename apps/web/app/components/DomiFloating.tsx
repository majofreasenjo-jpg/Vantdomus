"use client";

/**
 * DomiFloating — presencia constante de Domi que "flota y te acompaña".
 *
 * Burbuja fija (position:fixed) abajo a la derecha, presente en toda la app
 * (montada en el layout, modo familia). Flota con un bob suave y, al tocarla,
 * abre un mini-panel con accesos rápidos. No invade el contenido ni molesta
 * (patrón Finch: presencia cálida, no naggy). Respeta prefers-reduced-motion.
 */

import { useState } from "react";
import DomiOrb from "./DomiOrb";

export default function DomiFloating({ hid }: { hid: string }) {
  const [open, setOpen] = useState(false);

  const actions = [
    { icon: "🏠", label: "Inicio", href: `/hogar/${hid}` },
    { icon: "📣", label: "Mural", href: `/avisos/${hid}` },
    { icon: "🛒", label: "Compras", href: `/compras/${hid}` },
    { icon: "🌞", label: "Actividades", href: `/actividades/${hid}` },
    { icon: "🧑‍🤝‍🧑", label: "Perfiles", href: `/perfiles/${hid}` },
  ];

  return (
    <div className="domiFloat" aria-live="polite">
      {open ? (
        <div className="domiFloatCard" role="dialog" aria-label="Domi — accesos rápidos">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <DomiOrb state="cariñoso" size={40} showChips={false} />
            <div>
              <div style={{ fontWeight: 800 }}>Hola, soy Domi 👋</div>
              <div className="small" style={{ color: "var(--muted)" }}>¿A dónde vamos?</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {actions.map((a) => (
              <a key={a.label} href={a.href} className="btn" style={{ justifyContent: "flex-start", gap: 8 }} onClick={() => setOpen(false)}>
                <span aria-hidden="true">{a.icon}</span> {a.label}
              </a>
            ))}
          </div>
          <div className="small" style={{ marginTop: 10, color: "var(--muted)", fontStyle: "italic" }}>
            Estoy contigo en todo el hogar. Las decisiones importantes las confirmas tú.
          </div>
        </div>
      ) : null}

      <button
        className="domiFloatBtn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Cerrar Domi" : "Abrir Domi"}
        title="Domi"
      >
        <DomiOrb state={open ? "atento" : "sereno"} size={58} showChips={false} />
      </button>
    </div>
  );
}
