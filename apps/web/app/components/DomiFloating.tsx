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
import DomiChat from "./DomiChat";
import DomiIcon, { ModuleKey, MODULE_COLOR } from "./domiIcons";

export default function DomiFloating({ hid }: { hid: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "accesos">("chat");

  const actions: { icon: ModuleKey; label: string; href: string }[] = [
    { icon: "home", label: "Inicio", href: `/hogar/${hid}` },
    { icon: "message", label: "Mural", href: `/avisos/${hid}` },
    { icon: "shopping", label: "Compras", href: `/compras/${hid}` },
    { icon: "calendar", label: "Actividades", href: `/actividades/${hid}` },
    { icon: "users", label: "Perfiles", href: `/perfiles/${hid}` },
  ];

  return (
    <div className="domiFloat" aria-live="polite">
      {open ? (
        <div className="domiFloatCard" role="dialog" aria-label="Domi">
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <button className="pill" style={{ cursor: "pointer", borderColor: tab === "chat" ? "var(--primary,#4A7A6B)" : "var(--line)", fontWeight: tab === "chat" ? 700 : 500 }} onClick={() => setTab("chat")}>💬 Chat</button>
            <button className="pill" style={{ cursor: "pointer", borderColor: tab === "accesos" ? "var(--primary,#4A7A6B)" : "var(--line)", fontWeight: tab === "accesos" ? 700 : 500 }} onClick={() => setTab("accesos")}>⚡ Accesos</button>
            <span style={{ flex: 1 }} />
            <button className="pill" style={{ cursor: "pointer" }} onClick={() => setOpen(false)} aria-label="Cerrar">✕</button>
          </div>

          {tab === "chat" ? (
            <DomiChat hid={hid} />
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {actions.map((a) => (
                  <a key={a.label} href={a.href} className="btn" style={{ justifyContent: "flex-start", gap: 8 }} onClick={() => setOpen(false)}>
                    <DomiIcon name={a.icon} size={17} color={MODULE_COLOR[a.icon]} strokeWidth={2.1} /> {a.label}
                  </a>
                ))}
              </div>
              <div className="small" style={{ marginTop: 10, color: "var(--muted)", fontStyle: "italic" }}>
                Estoy contigo en todo el hogar. Las decisiones importantes las confirmas tú.
              </div>
            </>
          )}
        </div>
      ) : null}

      <button
        className="domiFloatBtn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Cerrar Domi" : "Abrir Domi"}
        title="Domi"
      >
        <DomiOrb state="sereno" size={58} showChips={false} />
      </button>
    </div>
  );
}
