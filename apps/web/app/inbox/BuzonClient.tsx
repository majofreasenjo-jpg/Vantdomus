"use client";

import React, { useState } from "react";
import { createLogbookEntry } from "../../lib/api";

interface BuzonClientProps {
  initialEntries: any[];
  householdId: string;
  isFamily?: boolean;
}

export default function BuzonClient({ initialEntries, householdId, isFamily = false }: BuzonClientProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !file) return;
    setError("");

    try {
      setLoading(true);
      const fd = new FormData();
      fd.append("entry_type", "instruccion");
      fd.append("content", content);
      if (file) fd.append("file", file);

      await createLogbookEntry(householdId, fd);

      // Reload page to get new entries (including AI response)
      window.location.reload();
    } catch (err: any) {
      setError(
        isFamily
          ? "No pudimos guardar tu mensaje. Probá de nuevo en unos segundos."
          : "Error: " + err.message,
      );
      setLoading(false);
    }
  };

  // Detección "sistema" más robusta: usa entry_type/source en lugar de UUID
  // hardcodeado. El nuevo backend marca los mensajes del asistente con
  // entry_type="ai_response" o source="vantdomus_ai". Mantenemos también
  // el match al UUID viejo por backwards-compat con seeds antiguos.
  const LEGACY_SYSTEM_USER_ID = "0f1e1d24-57b3-40b8-98c1-bc83f3cfd69c";
  function isSystemEntry(en: any): boolean {
    if (!en) return false;
    if (en.entry_type === "ai_response") return true;
    if (en.source === "vantdomus_ai") return true;
    if (en.is_system === true) return true;
    if (en.user_id === LEGACY_SYSTEM_USER_ID) return true;
    return false;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ background: "#fff", padding: 24, borderRadius: 8, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>
          {isFamily ? "Mandale un mensaje al asistente" : "Nueva Instrucción / Reporte de Campo"}
        </h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              isFamily
                ? "Ej: \"Mañana Diego tiene reunión de apoderados, organizame la agenda.\""
                : "Escribe tu instrucción (Ej: 'Por favor, genera línea de tiempo actualizada con los claims')..."
            }
            rows={4}
            style={{ padding: 12, borderRadius: 6, border: "1px solid #ddd", width: "100%", fontFamily: "inherit" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              accept=".ogg,.wav,.mp3,.xls,.xlsx,.pdf,.jpg,.jpeg,.png,.docx"
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                background: isFamily ? "#10b981" : "#081a2d",
                color: isFamily ? "#fff" : "#d4af37",
                border: "none",
                padding: "10px 24px",
                borderRadius: 6,
                fontWeight: "bold",
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading
                ? (isFamily ? "Procesando…" : "Procesando con IA...")
                : (isFamily ? "Enviar" : "Enviar Instrucción")
              }
            </button>
          </div>
          {error ? <div style={{ color: "#dc2626", fontSize: 14 }}>{error}</div> : null}
        </form>
      </div>

      <div style={{ background: "#fff", padding: 24, borderRadius: 8, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>
          {isFamily ? "Conversaciones recientes" : "Historial del Buzón"}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {entries.length === 0 ? (
            <div style={{ color: "#666", textAlign: "center", padding: 32 }}>
              {isFamily
                ? "Aún no hay mensajes. Mandá el primero — el asistente te responde en segundos."
                : "Sin entradas registradas."}
            </div>
          ) : null}
          {entries.map((en) => {
            const isSystem = isSystemEntry(en);
            return (
              <div
                key={en.id}
                style={{
                  background: isSystem
                    ? (isFamily ? "#ecfdf5" : "#f8fbff")
                    : "#fff8e1",
                  padding: 16,
                  borderRadius: 8,
                  border: isSystem
                    ? (isFamily ? "1px solid #10b981" : "1px solid #d0d3d4")
                    : "1px solid #f57f17",
                  alignSelf: isSystem ? "flex-start" : "flex-end",
                  width: "80%",
                }}
              >
                <div style={{ fontSize: "0.85em", color: "#666", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                  <span>
                    {isSystem
                      ? (isFamily ? "🤖 Asistente VantDomus" : "VantDomus IA")
                      : (isFamily ? "Tú" : "Responsable terreno")}
                  </span>
                  <span>{new Date(en.created_at).toLocaleString("es-CL", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}</span>
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{en.content}</div>
                {en.attachment_url && (
                  <div style={{ marginTop: 8 }}>
                    <a
                      href={en.attachment_url.startsWith("http") ? en.attachment_url : en.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#081a2d", fontWeight: "bold" }}
                    >
                      📎 Descargar {en.attachment_name || "archivo"}
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
