"use client";

/**
 * OPS-2 M8 — Biblioteca de Domi (6 capas) + inferencias confirmables.
 *
 * Muestra lo que Domi sabe, agrupado en 6 capas (personal, familiar, documental,
 * operativa, inferencias, temporal), con sus metadatos. Y lo más importante del
 * canon: una INFERENCIA de Domi NO es un hecho — aparece como "Domi ha notado…"
 * y solo entra a su memoria cuando la familia la confirma. También permite
 * corregir el texto de una memoria y exportar todo lo que puedes ver.
 */
import { useEffect, useState } from "react";
import {
  getMemoryLibrary, listMemoryInferences, confirmMemoryInference,
  dismissMemoryInference, correctDomiMemory, exportMemory,
} from "../../lib/api";

type Item = {
  id: string; about: string; content: string; layer: string; layer_label: string;
  source?: string; sensitivity?: string; confidence?: number | null;
  visibility_scope?: string; inference_status?: string | null;
};
type Layer = { key: string; label: string; items: Item[] };

const LAYER_ICON: Record<string, string> = {
  personal: "🧑", familiar: "👨‍👩‍👧", documental: "📄",
  operativa: "🗂️", inferencia: "💡", temporal: "⏳",
};

export default function MemoryLibrary({ hid }: { hid: string }) {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [inferences, setInferences] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");

  async function refresh() {
    try {
      const [lib, inf] = await Promise.all([
        getMemoryLibrary(hid) as Promise<{ layers?: Layer[]; total?: number }>,
        listMemoryInferences(hid) as Promise<{ items?: Item[] }>,
      ]);
      setLayers(lib?.layers || []);
      setTotal(lib?.total || 0);
      setInferences(inf?.items || []);
    } catch { /* silencioso */ }
  }

  useEffect(() => { refresh(); }, [hid]); // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmInf(id: string) {
    try { await confirmMemoryInference(id, hid); await refresh(); } catch { /* noop */ }
  }
  async function dismissInf(id: string) {
    try { await dismissMemoryInference(id, hid); await refresh(); } catch { /* noop */ }
  }
  async function saveCorrection(id: string) {
    const t = draft.trim();
    if (!t) return;
    try {
      await correctDomiMemory(id, hid, t);
      setEditing(null); setDraft("");
      await refresh();
    } catch { setNote("No se pudo corregir."); }
  }
  async function doExport() {
    try {
      const data = await exportMemory(hid);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "mi-memoria-domi.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch { setNote("No se pudo exportar."); }
  }

  const nonEmpty = layers.filter((l) => l.items.length > 0);

  return (
    <div className="grid" style={{ gap: 14 }}>
      {/* Inferencias por confirmar — lo que Domi cree pero aún no da por hecho. */}
      {inferences.length > 0 ? (
        <div className="card" style={{ padding: 14, borderLeft: "4px solid var(--accent, #6a5acd)" }}>
          <strong>💡 Domi ha notado algo ({inferences.length})</strong>
          <div className="small" style={{ color: "var(--muted)", margin: "4px 0 8px" }}>
            No lo daré por hecho hasta que ustedes lo confirmen.
          </div>
          <div className="grid" style={{ gap: 8 }}>
            {inferences.map((i) => (
              <div key={i.id} className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span>{i.content}</span>
                  <span className="small" style={{ display: "block", color: "var(--muted)" }}>
                    {i.about !== "familia" ? `Sobre ${i.about}` : "De la familia"}
                    {typeof i.confidence === "number" ? ` · confianza ${Math.round(i.confidence * 100)}%` : ""}
                  </span>
                </span>
                <button className="btn primary" style={{ cursor: "pointer" }} onClick={() => confirmInf(i.id)}>Sí, recuérdalo</button>
                <button className="btn" style={{ cursor: "pointer" }} onClick={() => dismissInf(i.id)}>No</button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Biblioteca por capas. */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <strong>📚 Lo que Domi sabe ({total})</strong>
        <button className="pill" style={{ cursor: "pointer" }} onClick={doExport}>⬇ Exportar</button>
      </div>
      {note ? <div className="small" style={{ color: "var(--muted)" }}>{note}</div> : null}

      {nonEmpty.length === 0 ? (
        <div className="card" style={{ padding: 16, textAlign: "center" }}>
          <div className="small">Todavía no le has enseñado nada a Domi. Empieza contándole gustos o rutinas.</div>
        </div>
      ) : (
        nonEmpty.map((l) => (
          <div key={l.key} className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              <span aria-hidden>{LAYER_ICON[l.key] || "•"}</span> {l.label} ({l.items.length})
            </div>
            <div className="grid" style={{ gap: 6 }}>
              {l.items.map((it) => (
                <div key={it.id} className="row" style={{ justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  {editing === it.id ? (
                    <span style={{ flex: 1, display: "flex", gap: 6 }}>
                      <input value={draft} onChange={(e) => setDraft(e.target.value)}
                        aria-label="Corregir memoria"
                        style={{ flex: 1, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border,#ccc)" }} />
                      <button className="pill" style={{ cursor: "pointer" }} onClick={() => saveCorrection(it.id)}>Guardar</button>
                      <button className="pill" style={{ cursor: "pointer" }} onClick={() => { setEditing(null); setDraft(""); }}>✕</button>
                    </span>
                  ) : (
                    <>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span>{it.content}</span>
                        <span className="small" style={{ display: "block", color: "var(--muted)" }}>
                          {it.about !== "familia" ? `${it.about} · ` : ""}{it.source || "familia"}
                          {it.sensitivity && it.sensitivity !== "normal" ? ` · ${it.sensitivity}` : ""}
                        </span>
                      </span>
                      <button className="pill" style={{ cursor: "pointer" }}
                        onClick={() => { setEditing(it.id); setDraft(it.content); }}>Corregir</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
