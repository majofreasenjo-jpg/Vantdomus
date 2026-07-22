"use client";

/**
 * OPS-2 M10 — MUSIC-0: música de la familia por enlaces.
 *
 * Pega un enlace de Spotify/YouTube/Amazon/Deezer/SoundCloud/Apple, etiquétalo
 * por momento y ábrelo cuando quieras. Abrir SIEMPRE es un toque tuyo (canon:
 * confirmación explícita); el backend valida que el dominio sea musical
 * (allowlist anti-phishing). Sin OAuth ni contraseñas — eso es MUSIC-1/2.
 */
import { useEffect, useState } from "react";
import { listFamilyMusic, addFamilyMusic, deleteFamilyMusic } from "../../lib/api";

type Link = {
  id: string; title: string; url: string; service: string; mood: string; for: string;
};

const MOODS: { key: string; label: string; icon: string }[] = [
  { key: "general", label: "General", icon: "🎵" },
  { key: "calma", label: "Calma", icon: "🌿" },
  { key: "energia", label: "Energía", icon: "⚡" },
  { key: "estudio", label: "Estudio", icon: "📖" },
  { key: "dormir", label: "Dormir", icon: "🌙" },
  { key: "fiesta", label: "Fiesta", icon: "🎉" },
];

const SERVICE_ICON: Record<string, string> = {
  spotify: "🟢", youtube: "▶️", amazon: "🅰️", deezer: "🎧", soundcloud: "☁️", apple: "🍎",
};

export default function FamilyMusic({ hid }: { hid: string }) {
  const [items, setItems] = useState<Link[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [mood, setMood] = useState("general");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function refresh() {
    try {
      const r = (await listFamilyMusic(hid)) as { items?: Link[] };
      setItems(r?.items || []);
    } catch { /* silencioso */ }
  }
  useEffect(() => { refresh(); }, [hid]); // eslint-disable-line react-hooks/exhaustive-deps

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !title.trim() || !url.trim()) return;
    setBusy(true); setNote("");
    try {
      await addFamilyMusic({ household_id: hid, title: title.trim(), url: url.trim(), mood });
      setTitle(""); setUrl("");
      setNote("Guardado. Tócalo cuando quieras escucharlo.");
      await refresh();
    } catch (err) {
      const msg = err instanceof Error && err.message.includes("música")
        ? err.message
        : "Solo se aceptan enlaces de servicios de música conocidos (Spotify, YouTube, Amazon, Deezer, SoundCloud, Apple).";
      setNote(msg);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try { await deleteFamilyMusic(id, hid); await refresh(); } catch { /* noop */ }
  }

  const visible = filter ? items.filter((i) => i.mood === filter) : items;

  return (
    <div className="grid" style={{ gap: 14 }}>
      {/* Agregar enlace */}
      <form onSubmit={add} className="card" style={{ padding: 14, display: "grid", gap: 10 }}>
        <strong>➕ Agregar música</strong>
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Nombre (ej. Lista para cocinar)" aria-label="Nombre"
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border,#ccc)" }} />
        <input value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="Pega el enlace (Spotify, YouTube, Amazon, Deezer…)" aria-label="Enlace"
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border,#ccc)" }} />
        <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {MOODS.map((m) => (
            <button type="button" key={m.key} onClick={() => setMood(m.key)}
              className={`pill ${mood === m.key ? "warn" : ""}`} style={{ cursor: "pointer" }}>
              {m.icon} {m.label}
            </button>
          ))}
          <button type="submit" className="btn primary" disabled={busy || !title.trim() || !url.trim()}
            style={{ cursor: "pointer", marginLeft: "auto" }}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
        {note ? <div className="small" style={{ color: "var(--muted)" }}>{note}</div> : null}
      </form>

      {/* Filtro por momento */}
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <button className={`pill ${!filter ? "warn" : ""}`} style={{ cursor: "pointer" }}
          onClick={() => setFilter("")}>Todos</button>
        {MOODS.map((m) => (
          <button key={m.key} className={`pill ${filter === m.key ? "warn" : ""}`}
            style={{ cursor: "pointer" }} onClick={() => setFilter(m.key)}>{m.icon} {m.label}</button>
        ))}
      </div>

      {/* Lista */}
      {visible.length === 0 ? (
        <div className="card" style={{ padding: 16, textAlign: "center" }}>
          <div className="small" style={{ color: "var(--muted)" }}>
            Aún no hay música guardada{filter ? " para este momento" : ""}. Pega un enlace arriba.
          </div>
        </div>
      ) : (
        <div className="grid" style={{ gap: 8 }}>
          {visible.map((l) => (
            <div key={l.id} className="card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }} aria-hidden>{SERVICE_ICON[l.service] || "🎵"}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 700 }}>{l.title}</span>
                <span className="small" style={{ display: "block", color: "var(--muted)" }}>
                  {l.service}{l.for !== "familia" ? ` · para ${l.for}` : ""} · {MOODS.find((m) => m.key === l.mood)?.label || l.mood}
                </span>
              </span>
              <a className="btn primary" href={l.url} target="_blank" rel="noopener noreferrer">▶ Abrir</a>
              <button className="pill" style={{ cursor: "pointer" }} onClick={() => remove(l.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="footerNote">
        La música se abre en la app o pestaña del servicio, siempre con un toque tuyo. VantDomus no
        guarda contraseñas ni cuentas de música; conectar tu cuenta (para controlar la reproducción
        desde aquí) llegará en una próxima fase.
      </div>
    </div>
  );
}
