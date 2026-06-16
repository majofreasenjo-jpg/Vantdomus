"use client";

import React, { useState } from "react";
import { createLogbookEntry } from "../../lib/api";

export default function BuzonClient({ initialEntries, householdId }: { initialEntries: any[], householdId: string }) {
  const [entries, setEntries] = useState(initialEntries);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !file) return;

    try {
      setLoading(true);
      const fd = new FormData();
      fd.append("entry_type", "instruccion"); // Always send as instruction for AI processing from this inbox
      fd.append("content", content);
      if (file) {
        fd.append("file", file);
      }

      await createLogbookEntry(householdId, fd);
      
      // Reload page to get new entries (including AI response)
      window.location.reload();
    } catch (err: any) {
      alert("Error: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ background: "#fff", padding: 24, borderRadius: 8, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>Nueva Instrucción / Reporte de Campo</h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escribe tu instrucción (Ej: 'Por favor, genera línea de tiempo actualizada con los claims')..."
            rows={4}
            style={{ padding: 12, borderRadius: 6, border: "1px solid #ddd", width: "100%", fontFamily: "inherit" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <input 
              type="file" 
              onChange={e => setFile(e.target.files?.[0] || null)}
              accept=".ogg,.wav,.mp3,.xls,.xlsx,.pdf"
            />
            <button 
              type="submit" 
              disabled={loading}
              style={{
                background: "#081a2d", color: "#d4af37", border: "none", padding: "10px 24px", 
                borderRadius: 4, fontWeight: "bold", cursor: loading ? "wait" : "pointer"
              }}
            >
              {loading ? "Procesando con IA..." : "Enviar Instrucción"}
            </button>
          </div>
        </form>
      </div>

      <div style={{ background: "#fff", padding: 24, borderRadius: 8, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>Historial del Buzón</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {entries.map(en => {
            const isSystem = en.user_id === "0f1e1d24-57b3-40b8-98c1-bc83f3cfd69c";
            return (
              <div key={en.id} style={{
                background: isSystem ? "#f8fbff" : "#fff8e1",
                padding: 16, borderRadius: 8, border: isSystem ? "1px solid #d0d3d4" : "1px solid #f57f17",
                alignSelf: isSystem ? "flex-start" : "flex-end",
                width: "80%"
              }}>
                <div style={{ fontSize: "0.85em", color: "#666", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                  <span>{isSystem ? "VantDomus IA" : "Responsable terreno"}</span>
                  <span>{new Date(en.created_at).toLocaleString()}</span>
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{en.content}</div>
                {en.attachment_url && (
                  <div style={{ marginTop: 8 }}>
                    <a href={`http://127.0.0.1:12801${en.attachment_url}`} target="_blank" rel="noreferrer" style={{color: "#081a2d", fontWeight: "bold"}}>
                      📎 Descargar {en.attachment_name}
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
