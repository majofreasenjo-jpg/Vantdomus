"use client";

/**
 * DomiChat — escribirle a Domi como un chat / copilot.
 *
 * Llama a /assistant/chat: si hay API key de IA configurada, responde el LLM;
 * si no, responde el copilot por reglas (sobre los datos reales del hogar).
 * Honesto: Domi ordena y resume tus datos; no inventa.
 */

import { useEffect, useRef, useState } from "react";
import { assistantChat } from "../../lib/api";
import DomiOrb from "./DomiOrb";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = ["¿Qué falta comprar?", "¿Qué hay hoy?", "¿Qué medicamentos hay?", "Resumen del día"];

export default function DomiChat({ hid }: { hid: string }) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hola, soy Domi 👋 Pregúntame por las compras, las actividades de hoy, los medicamentos o un resumen del hogar." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const resp = await assistantChat(hid, next.map((m) => ({ role: m.role, content: m.content })));
      const reply = resp?.reply || "No pude responder ahora. Intenta de nuevo.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Tuve un problema para responder. Intenta de nuevo." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 380, maxHeight: "70vh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 8, borderBottom: "1px solid var(--line)" }}>
        <DomiOrb state={busy ? "pensando" : "atento"} size={36} showChips={false} />
        <div>
          <div style={{ fontWeight: 800 }}>Domi</div>
          <div className="small" style={{ color: "var(--muted)" }}>{busy ? "pensando…" : "tu copilot del hogar"}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 2px", display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "86%" }}>
            <div style={{
              padding: "8px 11px", borderRadius: 14, fontSize: 13.5, lineHeight: 1.4,
              background: m.role === "user" ? "var(--primary, #4A7A6B)" : "var(--bg)",
              color: m.role === "user" ? "#fff" : "inherit",
              border: m.role === "user" ? "none" : "1px solid var(--line)",
              borderBottomRightRadius: m.role === "user" ? 4 : 14,
              borderBottomLeftRadius: m.role === "user" ? 14 : 4,
            }}>{m.content}</div>
          </div>
        ))}
        {busy ? <div className="small" style={{ color: "var(--muted)" }}>Domi está pensando…</div> : null}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "6px 0" }}>
          {SUGGESTIONS.map((s) => (
            <button key={s} className="pill" style={{ cursor: "pointer" }} onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      ) : null}

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: "1px solid var(--line)" }}
      >
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escríbele a Domi…"
          style={{ flex: 1 }}
          aria-label="Mensaje para Domi"
        />
        <button className="btn btnPrimary" type="submit" disabled={busy || !input.trim()}>Enviar</button>
      </form>
    </div>
  );
}
