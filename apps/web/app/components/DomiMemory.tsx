"use client";

/**
 * OPS-2.A — "Lo que Domi recuerda de cada uno".
 *
 * La familia le enseña a Domi hechos de cada integrante (o de todo el hogar) y
 * Domi los usa para personalizar. Solo tipos NO sensibles (salud queda fuera por
 * el backend). Propone → confirma no aplica aquí: son notas que la familia crea
 * y borra directamente.
 */
import { useEffect, useState } from "react";
import { listDomiMemories, createDomiMemory, deleteDomiMemory } from "../../lib/api";

type Person = { id: string; name: string };
type Memory = {
  id: string;
  about: string;
  person_id: string | null;
  memory_type: string;
  content: string;
};

// Etiquetas amigables para los tipos permitidos por el backend.
const TYPE_LABELS: Record<string, string> = {
  preference: "Gustos y preferencias",
  routine_pattern: "Rutinas",
  study_pattern: "Cómo estudia",
  motivation_pattern: "Qué lo motiva",
  calm_strategy: "Qué lo calma",
  social_connection: "Relaciones y amistades",
  family_story: "Historias de familia",
  improvement: "Progresos y logros",
  operational_context: "Notas del hogar",
};
const TYPE_ORDER = Object.keys(TYPE_LABELS);

export default function DomiMemory({ hid, persons }: { hid: string; persons: Person[] }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [personId, setPersonId] = useState<string>(""); // "" = toda la familia
  const [memType, setMemType] = useState<string>("preference");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const res = (await listDomiMemories(hid)) as { items?: Memory[] };
      setMemories(Array.isArray(res?.items) ? res.items : []);
    } catch {
      setError("No se pudo cargar la memoria de Domi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hid]);

  async function add() {
    const text = content.trim();
    if (!text || saving) return;
    setSaving(true);
    setError("");
    try {
      await createDomiMemory({
        household_id: hid,
        memory_type: memType,
        content: text,
        person_id: personId || null,
      });
      setContent("");
      await refresh();
    } catch {
      setError("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteDomiMemory(id, hid);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch {
      setError("No se pudo borrar.");
    }
  }

  const label = (t: string) => TYPE_LABELS[t] || t;

  return (
    <div className="card" style={{ padding: 16, marginTop: 20 }}>
      <div className="big" style={{ fontSize: 20 }}>Lo que Domi recuerda</div>
      <div className="small" style={{ color: "var(--muted)", marginTop: 4, marginBottom: 14 }}>
        Enséñale a Domi sobre cada integrante (o sobre la familia) para que te ayude mejor.
        Ejemplos: “a Diego le cuesta álgebra”, “a mamá le gusta el café en la mañana”, “los
        domingos almuerzan donde la abuela”. La información de salud no se guarda aquí.
      </div>

      {/* Formulario de alta */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end", marginBottom: 14 }}>
        <label className="small" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          ¿Sobre quién?
          <select value={personId} onChange={(e) => setPersonId(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 10, minWidth: 160 }}>
            <option value="">Toda la familia</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="small" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Tipo
          <select value={memType} onChange={(e) => setMemType(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 10, minWidth: 170 }}>
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>{label(t)}</option>
            ))}
          </select>
        </label>
        <label className="small" style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 220 }}>
          ¿Qué debe recordar Domi?
          <input value={content} onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder="Escríbelo en tus palabras…" maxLength={2000}
            style={{ padding: "8px 10px", borderRadius: 10 }} />
        </label>
        <button className="btn" onClick={add} disabled={saving || !content.trim()}
          style={{ padding: "9px 16px" }}>
          {saving ? "Guardando…" : "Enseñar a Domi"}
        </button>
      </div>

      {error ? <div className="small" style={{ color: "var(--bad, #e5484d)", marginBottom: 10 }}>{error}</div> : null}

      {/* Lista */}
      {loading ? (
        <div className="small" style={{ color: "var(--muted)" }}>Cargando…</div>
      ) : memories.length === 0 ? (
        <div className="small" style={{ color: "var(--muted)" }}>
          Todavía no le has enseñado nada a Domi. Empieza con algo simple de cada integrante.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {memories.map((m) => (
            <div key={m.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
              borderRadius: 12, background: "rgba(127,127,127,0.08)",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="small" style={{ fontWeight: 700 }}>
                  {m.about === "familia" ? "👪 Familia" : `👤 ${m.about}`}
                  <span style={{ fontWeight: 400, color: "var(--muted)" }}> · {label(m.memory_type)}</span>
                </div>
                <div style={{ fontSize: 14 }}>{m.content}</div>
              </div>
              <button className="btn" onClick={() => remove(m.id)}
                title="Olvidar" style={{ padding: "4px 10px", fontSize: 12 }}>
                Olvidar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
