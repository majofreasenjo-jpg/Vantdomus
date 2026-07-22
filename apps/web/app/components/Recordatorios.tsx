"use client";

/**
 * OPS-2 M7.A — Recordatorios programables + bandeja de notificaciones in-app.
 *
 * La familia crea recordatorios reales ("recuérdame X a tal hora"). La entrega
 * es PULL: al abrir/refrescar, el backend marca como entregados los vencidos y
 * aparecen aquí para descartarlos (acuse). El push real (al teléfono) llega en
 * una próxima fase; por ahora la notificación vive dentro de la app.
 */
import { useEffect, useState } from "react";
import { listReminders, createReminder, dismissReminder } from "../../lib/api";

type Reminder = {
  id: string;
  title: string;
  body?: string | null;
  remind_at: string;
  for: string;
  status: string;
  is_due: boolean;
};

// Opciones rápidas de "cuándo": devuelven un ISO a partir de ahora.
function inMinutes(mins: number): string {
  return new Date(Date.now() + mins * 60_000).toISOString();
}
function todayAt(hour: number): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1); // si ya pasó, mañana
  return d.toISOString();
}

const WHEN_OPTIONS: { label: string; iso: () => string }[] = [
  { label: "En 1 hora", iso: () => inMinutes(60) },
  { label: "Esta tarde (18:00)", iso: () => todayAt(18) },
  { label: "Mañana 9:00", iso: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.toISOString(); } },
];

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-CL", {
      weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export default function Recordatorios({ hid }: { hid: string }) {
  const [items, setItems] = useState<Reminder[]>([]);
  const [unseen, setUnseen] = useState(0);
  const [title, setTitle] = useState("");
  const [whenIdx, setWhenIdx] = useState(0);
  const [customWhen, setCustomWhen] = useState("");
  const [scope, setScope] = useState("household_shared");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function refresh() {
    try {
      const r = (await listReminders(hid)) as { items?: Reminder[]; unseen?: number };
      setItems(r?.items || []);
      setUnseen(r?.unseen || 0);
    } catch {
      /* silencioso: la bandeja simplemente no carga */
    }
  }

  useEffect(() => { refresh(); }, [hid]); // eslint-disable-line react-hooks/exhaustive-deps

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || busy) return;
    // Fecha: custom (datetime-local) tiene prioridad; si no, la opción rápida.
    const remind_at = customWhen ? new Date(customWhen).toISOString() : WHEN_OPTIONS[whenIdx].iso();
    setBusy(true);
    setNote("");
    try {
      await createReminder({ household_id: hid, title: t, remind_at, visibility_scope: scope });
      setTitle("");
      setCustomWhen("");
      setNote(`Listo. Te avisaré: ${fmtWhen(remind_at)}.`);
      await refresh();
    } catch {
      setNote("No se pudo crear el recordatorio. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function dismiss(id: string) {
    try {
      await dismissReminder(id, hid);
      await refresh();
    } catch { /* noop */ }
  }

  const due = items.filter((r) => r.is_due);
  const upcoming = items.filter((r) => !r.is_due && r.status === "pending");

  return (
    <div className="grid" style={{ gap: 14, marginBottom: 18 }}>
      {/* Campana: notificaciones entregadas (vencidas) pendientes de acuse. */}
      {due.length > 0 ? (
        <div className="card" style={{ padding: 14, borderLeft: "4px solid var(--danger, #d9534f)" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <strong>🔔 Para ti ahora ({unseen})</strong>
          </div>
          <div className="grid" style={{ gap: 8 }}>
            {due.map((r) => (
              <div key={r.id} className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 700 }}>{r.title}</span>
                  <span className="small" style={{ display: "block", color: "var(--muted)" }}>
                    {r.for !== "familia" ? `Para ${r.for} · ` : ""}{fmtWhen(r.remind_at)}
                  </span>
                </span>
                <button className="btn" style={{ cursor: "pointer" }} onClick={() => dismiss(r.id)}>Listo ✓</button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Crear un recordatorio nuevo. */}
      <form onSubmit={add} className="card" style={{ padding: 14, display: "grid", gap: 10 }}>
        <strong>➕ Nuevo recordatorio</strong>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="¿Qué no hay que olvidar? (ej. Pagar la luz)"
          aria-label="Título del recordatorio"
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border, #ccc)" }}
        />
        <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {WHEN_OPTIONS.map((w, i) => (
            <button
              type="button" key={w.label}
              onClick={() => { setWhenIdx(i); setCustomWhen(""); }}
              className={`pill ${whenIdx === i && !customWhen ? "warn" : ""}`}
              style={{ cursor: "pointer" }}
            >{w.label}</button>
          ))}
          <label className="small" style={{ color: "var(--muted)" }}>
            o fecha exacta:{" "}
            <input
              type="datetime-local"
              value={customWhen}
              onChange={(e) => setCustomWhen(e.target.value)}
              aria-label="Fecha y hora exacta"
              style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border, #ccc)" }}
            />
          </label>
        </div>
        <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label className="small">
            <input type="radio" name="rem-scope" checked={scope === "household_shared"}
              onChange={() => setScope("household_shared")} /> Para la familia
          </label>
          <label className="small">
            <input type="radio" name="rem-scope" checked={scope === "private_self"}
              onChange={() => setScope("private_self")} /> Solo para mí
          </label>
          <button type="submit" className="btn primary" disabled={busy || !title.trim()}
            style={{ cursor: "pointer", marginLeft: "auto" }}>
            {busy ? "Guardando…" : "Crear recordatorio"}
          </button>
        </div>
        {note ? <div className="small" style={{ color: "var(--muted)" }}>{note}</div> : null}
      </form>

      {/* Programados (aún no vencen). */}
      {upcoming.length > 0 ? (
        <div className="card" style={{ padding: 14 }}>
          <strong className="small">⏳ Programados</strong>
          <div className="grid" style={{ gap: 6, marginTop: 8 }}>
            {upcoming.map((r) => (
              <div key={r.id} className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                <span style={{ flex: 1, minWidth: 0 }}>{r.title}</span>
                <span className="small" style={{ color: "var(--muted)" }}>{fmtWhen(r.remind_at)}</span>
                <button className="pill" style={{ cursor: "pointer" }} onClick={() => dismiss(r.id)}>Cancelar</button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
