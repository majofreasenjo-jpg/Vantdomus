"use client";

/**
 * PostComments — hilo de comentarios + reacciones por aviso del Mural.
 * Colapsado por defecto ("💬 N"); al abrir carga el hilo. Reacciones rápidas
 * (👍 ❤️ ✅ 🙏) se guardan como comentario con emoji. Mata el "lo hablamos por
 * WhatsApp".
 */

import { useState } from "react";
import { familyBoardComments, familyBoardComment } from "../../lib/api";

type Comment = { id: string; body: string; reaction?: string; author_name?: string; created_at: string };

const QUICK = ["👍", "❤️", "✅", "🙏"];

function fmt(iso?: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

export default function PostComments({ hid, postId }: { hid: string; postId: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await familyBoardComments(hid, postId);
      setItems(r?.items || []);
    } catch { setItems([]); }
    setLoaded(true);
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) await load();
  }

  async function send(body: string, reaction?: string) {
    const b = body.trim();
    if (!b || busy) return;
    setBusy(true);
    try {
      await familyBoardComment(hid, postId, b, reaction);
      setText("");
      await load();
    } catch { /* noop */ } finally { setBusy(false); }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button className="btn" style={{ fontSize: 12, padding: "4px 10px" }} onClick={toggle}>
        💬 {loaded ? `${items.length}` : "Comentar"} {open ? "▲" : "▼"}
      </button>

      {open ? (
        <div style={{ marginTop: 8 }}>
          {items.length > 0 ? (
            <div className="grid" style={{ gap: 6, marginBottom: 8 }}>
              {items.map((c) => (
                <div key={c.id} className="small" style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: "6px 10px" }}>
                  <span style={{ fontWeight: 700 }}>{c.author_name || "Integrante"}</span>
                  {c.reaction ? <span style={{ marginLeft: 6 }}>{c.reaction}</span> : null}
                  <span style={{ color: "var(--muted)" }}> · {fmt(c.created_at)}</span>
                  <div>{c.body}</div>
                </div>
              ))}
            </div>
          ) : loaded ? <div className="small" style={{ color: "var(--muted)", marginBottom: 6 }}>Sin comentarios. Sé el primero.</div> : <div className="small">Cargando…</div>}

          <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
            {QUICK.map((e) => (
              <button key={e} className="pill" style={{ cursor: "pointer" }} disabled={busy} onClick={() => send(e, e)}>{e}</button>
            ))}
          </div>
          <div className="formRow" style={{ gap: 6 }}>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(text); }}
              placeholder="Escribe un comentario…" style={{ flex: 1, minWidth: 160 }} />
            <button className="btn btnPrimary" disabled={busy || !text.trim()} onClick={() => send(text)}>Enviar</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
