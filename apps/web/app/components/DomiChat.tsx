"use client";

/**
 * DomiChat — escribirle a Domi como un chat / copilot.
 *
 * Llama a /assistant/chat: si hay API key de IA configurada, responde el LLM;
 * si no, responde el copilot por reglas (sobre los datos reales del hogar).
 * Honesto: Domi ordena y resume tus datos; no inventa.
 */

import { useEffect, useRef, useState } from "react";
import { assistantChat, domiConfirmProposal, domiRejectProposal, transcribeAudio, getDailySummary } from "../../lib/api";
import DomiOrb from "./DomiOrb";
import {
  speechSupported, speak, stopSpeaking, recordingSupported, startRecording,
  mimeToFilename, type Recorder,
} from "../../lib/voice";

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
type Msg = { role: "user" | "assistant"; content: string; proposals?: Proposal[]; responseType?: string };

// M3 — etiqueta amigable del tipo de respuesta de Domi (contrato: una charla no
// ejecuta acciones; una propuesta espera tu confirmación).
const RT_LABEL: Record<string, string> = {
  conversacion: "Conversación",
  informacion: "Información",
  sugerencia: "Sugerencia",
  propuesta: "Propuesta",
  accion_pendiente_de_confirmacion: "Propuesta · espera tu OK",
  accion_ejecutada: "Acción hecha",
  resultado_integracion_externa: "Resultado externo",
};

const SUGGESTIONS = ["¿Qué falta comprar?", "Agrega leche y pan a la lista", "Prepara el estudio de Diego", "Resumen del día"];

export default function DomiChat({ hid }: { hid: string }) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hola, soy Domi 👋 Pregúntame por las compras, las actividades de hoy, los medicamentos o un resumen del hogar." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // M4 — voz
  const [recorder, setRecorder] = useState<Recorder | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  const [voiceNote, setVoiceNote] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);
  useEffect(() => () => stopSpeaking(), []); // al desmontar, corta la voz
  // M5 — en modo Senior, Domi lee sus respuestas en voz alta por defecto.
  useEffect(() => {
    if (typeof document !== "undefined" && document.documentElement.getAttribute("data-mode") === "senior" && speechSupported()) {
      setReadAloud(true);
    }
  }, []);

  async function showSummary() {
    if (busy) return;
    setBusy(true);
    try {
      const resp = (await getDailySummary(hid)) as { summary?: string; mode?: string };
      const text = resp?.summary || "No pude armar tu resumen ahora.";
      setMessages((prev) => [...prev, { role: "assistant", content: text, responseType: "informacion" }]);
      if (readAloud) speak(text);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "No pude armar tu resumen ahora. Intenta de nuevo." }]);
    } finally {
      setBusy(false);
    }
  }

  async function toggleMic() {
    if (voiceBusy) return;
    if (recorder) {
      // Detener y transcribir.
      setVoiceBusy(true);
      setVoiceNote("Transcribiendo…");
      try {
        const { blob, mime } = await recorder.stop();
        setRecorder(null);
        const resp = (await transcribeAudio(hid, blob, mimeToFilename(mime))) as { available?: boolean; text?: string };
        if (resp?.available === false) {
          setVoiceNote("La voz para hablarle a Domi necesita la IA encendida. Escríbele por ahora.");
        } else if (resp?.text) {
          setInput((prev) => (prev ? prev + " " : "") + resp.text);  // para revisar/corregir antes de enviar
          setVoiceNote("Revisa el texto y envíalo.");
        } else {
          setVoiceNote("No te entendí bien. Intenta de nuevo o escríbelo.");
        }
      } catch {
        setRecorder(null);
        setVoiceNote("No pude usar el micrófono. Escríbele a Domi.");
      } finally {
        setVoiceBusy(false);
      }
      return;
    }
    // Empezar a grabar.
    try {
      setVoiceNote("Escuchando… toca de nuevo para enviar.");
      const r = await startRecording();
      setRecorder(r);
    } catch {
      setVoiceNote("No diste permiso de micrófono (o no está disponible). Escríbele a Domi.");
    }
  }

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
      setMessages((prev) => [...prev, { role: "assistant", content: reply, proposals, responseType: resp?.response_type }]);
      if (readAloud) speak(reply);  // M4 — Domi lo lee en voz alta
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

            {/* M3 — tipo de respuesta (contrato de Domi): hace visible que una
                charla no ejecuta nada. */}
            {m.role === "assistant" && m.responseType && RT_LABEL[m.responseType] ? (
              <span style={{
                alignSelf: "flex-start", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.2,
                padding: "1px 8px", borderRadius: 999, color: "var(--muted)",
                background: "rgba(127,127,127,0.12)",
              }}>{RT_LABEL[m.responseType]}</span>
            ) : null}

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

      {/* M6 — resumen del día a demanda. */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "4px 0" }}>
        <button type="button" className="pill" style={{ cursor: "pointer" }}
          disabled={busy} onClick={showSummary}>📋 Mi resumen del día</button>
      </div>

      {voiceNote ? (
        <div className="small" style={{ color: "var(--muted)", padding: "2px 2px 4px" }}>{voiceNote}</div>
      ) : null}

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: "1px solid var(--line)", alignItems: "center" }}
      >
        {/* M4 — hablarle a Domi (grabar → transcribir → revisar → enviar). */}
        {recordingSupported() ? (
          <button type="button" onClick={toggleMic} disabled={voiceBusy}
            title={recorder ? "Detener y transcribir" : "Hablar"}
            aria-label={recorder ? "Detener grabación" : "Hablar con Domi"}
            className="btn" style={{
              cursor: "pointer", padding: "8px 11px",
              background: recorder ? "var(--bad, #e5484d)" : undefined,
              color: recorder ? "#fff" : undefined,
            }}>
            {voiceBusy ? "…" : recorder ? "■" : "🎤"}
          </button>
        ) : null}
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escríbele a Domi…"
          style={{ flex: 1 }}
          aria-label="Mensaje para Domi"
        />
        {/* M4 — que Domi lea sus respuestas en voz alta. */}
        {speechSupported() ? (
          <button type="button" title="Leer respuestas en voz alta"
            aria-pressed={readAloud}
            onClick={() => { if (readAloud) stopSpeaking(); setReadAloud((v) => !v); }}
            className="btn" style={{ cursor: "pointer", padding: "8px 11px", opacity: readAloud ? 1 : 0.6 }}>
            {readAloud ? "🔊" : "🔈"}
          </button>
        ) : null}
        <button className="btn btnPrimary" type="submit" disabled={busy || !input.trim()}>Enviar</button>
      </form>
    </div>
  );
}
