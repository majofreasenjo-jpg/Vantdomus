"use client";

/**
 * QuickAddActivity — barra "+" que entiende lenguaje natural.
 * Ej: "Diego fútbol mañana 17:00" → crea la actividad para Diego, mañana 17:00.
 * Detecta integrante por nombre; si no, usa el selector. Optimista: refresca al
 * crear.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dailyActivityCreate } from "../../lib/api";
import { parseActivity } from "../../lib/nlDate";

type Person = { id: string; display_name: string };

function isoFromDateTime(dateIso: string, time?: string): string | undefined {
  if (!time) return undefined;
  try { return new Date(`${dateIso}T${time}:00`).toISOString(); } catch { return undefined; }
}

export default function QuickAddActivity({ hid, persons }: { hid: string; persons: Person[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [personId, setPersonId] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  function detectPerson(raw: string): { pid: string; cleaned: string } {
    const low = raw.toLowerCase();
    for (const p of persons) {
      const fn = p.display_name.trim().split(/\s+/)[0].toLowerCase();
      if (fn && new RegExp(`\\b${fn}\\b`).test(low)) {
        return { pid: p.id, cleaned: raw.replace(new RegExp(fn, "i"), "").trim() };
      }
    }
    return { pid: "", cleaned: raw };
  }

  async function add() {
    const raw = text.trim();
    if (!raw || busy) return;
    const det = detectPerson(raw);
    const pid = det.pid || personId || persons[0]?.id;
    if (!pid) { setPreview("Primero agrega un integrante."); return; }
    const parsed = parseActivity(det.cleaned || raw);
    setBusy(true); setPreview(null);
    try {
      await dailyActivityCreate(hid, {
        person_id: pid,
        title: parsed.title,
        activity_type: "other",
        visibility: "family",
        date_iso: parsed.dateIso,
        starts_at: isoFromDateTime(parsed.dateIso, parsed.time),
        notes: parsed.recurrence ? `Recurrencia sugerida: ${parsed.recurrence}` : undefined,
      });
      setText("");
      router.refresh();
    } catch {
      setPreview("No se pudo crear. Intenta de nuevo.");
    } finally { setBusy(false); }
  }

  // Vista previa en vivo de lo entendido
  const live = text.trim() ? (() => {
    const det = detectPerson(text.trim());
    const parsed = parseActivity(det.cleaned || text.trim());
    const who = det.pid ? persons.find((p) => p.id === det.pid)?.display_name : (personId ? persons.find(p => p.id === personId)?.display_name : persons[0]?.display_name);
    return `${who || "—"} · ${parsed.title}${parsed.time ? " · " + parsed.time : ""} · ${parsed.dateIso}${parsed.recurrence ? " · " + parsed.recurrence : ""}`;
  })() : null;

  return (
    <div className="card" style={{ padding: 14, marginBottom: 12 }}>
      <div className="cardTitle">⚡ Agregar rápido (escribe natural)</div>
      <div className="formRow" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder='Ej: "Diego fútbol mañana 17:00" o "control médico Elena el viernes"'
          style={{ flex: 1, minWidth: 240 }}
        />
        <select className="input" value={personId} onChange={(e) => setPersonId(e.target.value)} title="Integrante por defecto">
          <option value="">Auto-detectar</option>
          {persons.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
        </select>
        <button className="btn btnPrimary" onClick={add} disabled={busy || !text.trim()}>Agregar</button>
      </div>
      {live ? <div className="small" style={{ marginTop: 6, color: "var(--muted)" }}>Domi entiende: {live}</div> : null}
      {preview ? <div className="small" style={{ marginTop: 6, color: "var(--muted)" }}>{preview}</div> : null}
    </div>
  );
}
