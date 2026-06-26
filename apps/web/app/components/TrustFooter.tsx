"use client";

/**
 * TrustFooter — mensaje de confianza + exportación de datos del hogar.
 *
 * Lección CareZone (competitive sweep): la portabilidad de datos es el "moat"
 * de confianza de una app con salud/finanzas/documentos. Hacemos el export
 * trivial y siempre disponible. Frontend-only: arma el JSON desde los endpoints
 * existentes y lo descarga en el navegador.
 */

import { useState } from "react";
import { getDashboard, familyBoardList, shoppingList, dailyActivitiesList } from "../../lib/api";

export default function TrustFooter({ hid }: { hid: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function exportData() {
    setBusy(true);
    setMsg(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [dash, board, shopping, activities] = await Promise.all([
        getDashboard(hid).catch(() => null),
        familyBoardList(hid).catch(() => ({ items: [] })),
        shoppingList(hid).catch(() => ({ items: [] })),
        dailyActivitiesList(hid, today).catch(() => ({ items: [] })),
      ]);
      const payload = {
        exported_at: new Date().toISOString(),
        household: dash?.household || null,
        persons: dash?.persons || [],
        avisos: board?.items || [],
        compras: shopping?.items || [],
        actividades_hoy: activities?.items || [],
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vantdomus_hogar_${today}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg("Listo: descargamos un respaldo de tu hogar.");
    } catch {
      setMsg("No pudimos exportar ahora. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 16, marginTop: 14, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
      <div className="small" style={{ maxWidth: 540 }}>
        🔒 <strong>Tus datos son tuyos.</strong> La información de tu hogar vive en VantDomus y podés
        llevártela cuando quieras. La IA solo ve lo que cada integrante autoriza.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {msg ? <span className="small" style={{ color: "var(--muted)" }}>{msg}</span> : null}
        <button className="btn" onClick={exportData} disabled={busy}>
          {busy ? "Exportando…" : "Exportar mis datos (JSON)"}
        </button>
      </div>
    </div>
  );
}
