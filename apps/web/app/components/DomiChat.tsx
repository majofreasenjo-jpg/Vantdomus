"use client";

/**
 * DomiChat — escribirle a Domi como un chat / copilot.
 *
 * Llama a /assistant/chat: si hay API key de IA configurada, responde el LLM;
 * si no, responde el copilot por reglas (sobre los datos reales del hogar).
 * Honesto: Domi ordena y resume tus datos; no inventa.
 */

import { useEffect, useRef, useState } from "react";
import { assistantChat, domiConfirmProposal, domiRejectProposal } from "../../lib/api";
import DomiOrb from "./DomiOrb";

// CP1c-FUNC-MIN-3.1 — una propuesta pendiente del orquestador (aún NO ejecutada).
type Proposal = {
  id: string;
  tool_name: string;
  category: string;
  title: string;
  summary: string;
  status: string;
  sensitive: boolean;
};
type Msg = { role: "user" | "assistant"; content: string; proposals?: Proposal[] };

const SUGGESTIONS = ["¿Qué falta comprar?", "Agrega leche y pan a la lista", "Prepara el estudio de Diego", "Resumen del día"];

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
      const proposals: Proposal[] = Array.isArray(resp?.proposals) ? resp.proposals : [];
      setMessages((prev) => [...prev, { role: "assistant", content: reply, proposals }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Tuve un problema para responder. Intenta de nuevo." }]);
    } finally {
      setBusy(false);
    }
  }

  // Confirmar/Rechazar una propuesta. Solo AQUÍ, con acción humana, se ejecuta.
  async function decide(msgIdx: number, propId: string, accept: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      if (accept) await domiConfirmProposal(propId);
      else await domiRejectProposal(propId);
      // Reflejar la decisión en la propuesta mostrada.
      setMessages((prev) => prev.map((m, i) => i !== msgIdx || !m.proposals ? m : {
        ...m,
        proposals: m.proposals.map((p) => p.id === propId ? { ...p, status: accept ? "executed" : "rejected" } : p),
      }));
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: accept ? "Listo, lo dejé hecho. ✅" : "De acuerdo, no lo hago. 👍",
      }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "No pude aplicar la decisión. Intenta de nuevo." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 380, maxHeight: "70vh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 8, borderBottom: "1px solid var(--line)" }}>
        <DomiOrb state={busy ? "pensando" : (input.trim() ? "atento" : "sereno")} size={40} showChips={false} />
        <div>
          <div style={{ fontWeight: 800 }}>Domi</div>
          <div className="small" style={{ color: "var(--muted)" }}>{busy ? "pensando…" : (input.trim() ? "te escucho…" : "tu copilot del hogar")}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 2px", display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "86%", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{
              padding: "8px 11px", borderRadius: 14, fontSize: 13.5, lineHeight: 1.4,
              background: m.role === "user" ? "var(--primary, #4A7A6B)" : "var(--bg)",
              color: m.role === "user" ? "#fff" : "inherit",
              border: m.role === "user" ? "none" : "1px solid var(--line)",
              borderBottomRightRadius: m.role === "user" ? 4 : 14,
              borderBottomLeftRadius: m.role === "user" ? 14 : 4,
            }}>{m.content}</div>

            {/* CP1c-FUNC-MIN-3.1 — propuestas: Domi propone, tú decides. */}
            {(m.proposals || []).map((p) => (
              <div key={p.id} style={{
                border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px",
                background: "var(--bg)", boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span aria-hidden style={{ fontSize: 14 }}>💡</span>
                  <strong style={{ fontSize: 13 }}>{p.title}</strong>
                  {p.sensitive ? <span className="pill" style={{ fontSize: 10 }}>requiere tu OK</span> : null}
                </div>
                <div className="small" style={{ color: "var(--muted)", marginBottom: 8 }}>
                  {p.summary} <span style={{ opacity: 0.8 }}>· Domi propone esto. Tú decides si se ejecuta.</span>
                </div>
                {p.status === "pending" ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btnPrimary" style={{ cursor: "pointer", padding: "5px 12px", fontSize: 12.5 }}
                      disabled={busy} onClick={() => decide(i, p.id, true)}>Confirmar</button>
                    <button className="btn" style={{ cursor: "pointer", padding: "5px 12px", fontSize: 12.5 }}
                      disabled={busy} onClick={() => decide(i, p.id, false)}>Rechazar</button>
                  </div>
                ) : (
                  <div className="small" style={{ color: "var(--muted)", fontWeight: 700 }}>
                    {p.status === "executed" ? "✅ Confirmado y hecho" : p.status === "rejected" ? "🚫 Rechazado" : p.status}
                  </div>
                )}
              </div>
            ))}
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
