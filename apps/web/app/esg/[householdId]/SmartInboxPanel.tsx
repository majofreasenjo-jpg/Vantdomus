"use client";

import { useState } from "react";
import { smartInboxAnalyze, smartInboxConfirm, smartInboxReject } from "../../../lib/api";
import DomiOrb, { type DomiState } from "../../components/DomiOrb";

type Person = { id: string; display_name: string };

const ROUTE_LABELS: Record<string, string> = {
  prescription_to_medication: "Receta → Medicamento",
  receipt_to_finance: "Boleta → Gasto",
  shopping_list_to_items: "Lista → Compras",
  school_notice_to_study: "Circular → Estudio",
  doctor_document_to_health: "Documento médico → Salud",
  insurance_policy_to_document: "Póliza/seguro → Vencimiento",
  bill_to_finance_or_deadline: "Cuenta → Vencimiento",
  general_archive: "Documento general → Archivo",
};

export default function SmartInboxPanel({ hid, persons }: { hid: string; persons: Person[] }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [personId, setPersonId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [cand, setCand] = useState<any | null>(null);
  const [fields, setFields] = useState<Record<string, any>>({});

  async function analyze() {
    setBusy(true); setMsg(""); setCand(null);
    try {
      const fd = new FormData();
      if (text.trim()) fd.set("pasted_text", text.trim());
      if (file) fd.set("file", file);
      if (!text.trim() && !file) { setMsg("Pegá texto o elegí un archivo."); setBusy(false); return; }
      const c = await smartInboxAnalyze(hid, personId, fd);
      setCand(c);
      setFields({ ...(c.proposed_payload || {}) });
    } catch (e: any) {
      setMsg("No se pudo analizar: " + (e?.message || "error"));
    } finally { setBusy(false); }
  }

  async function confirm() {
    if (!cand) return;
    setBusy(true); setMsg("");
    try {
      const res = await smartInboxConfirm(cand.id, fields);
      setMsg(`Listo: se creó (${res.result_type}).`);
      setCand(null); setText(""); setFile(null);
    } catch (e: any) {
      setMsg("No se pudo confirmar: " + (e?.message || "error"));
    } finally { setBusy(false); }
  }

  async function reject() {
    if (!cand) return;
    setBusy(true); setMsg("");
    try {
      await smartInboxReject(cand.id, "Rechazado por el usuario");
      setMsg("Propuesta rechazada. No se creó nada.");
      setCand(null);
    } catch (e: any) {
      setMsg("No se pudo rechazar: " + (e?.message || "error"));
    } finally { setBusy(false); }
  }

  const setF = (k: string, v: any) => setFields((p) => ({ ...p, [k]: v }));
  const route = cand?.route_type as string | undefined;
  const orbState: DomiState = busy ? "pensando" : msg.startsWith("Listo") ? "logro" : cand ? "protector" : "sereno";

  return (
    <div className="card" style={{ gridColumn: "span 4", borderColor: "var(--primary)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <DomiOrb state={orbState} size={34} showChips={false} />
        <div className="cardTitle" style={{ color: "var(--primary)", fontWeight: 900, margin: 0 }}>Bandeja inteligente</div>
      </div>
      <div className="small" style={{ marginBottom: 12, lineHeight: 1.55, maxWidth: 760 }}>
        Subí una receta, boleta, circular, cuenta o documento familiar. VantDomus intentará ordenarlo y propondrá qué hacer.
        Vos confirmás antes de activar recordatorios o guardar información importante.
      </div>

      {!cand ? (
        <div className="grid" style={{ gap: 10 }}>
          <textarea className="input" rows={3} placeholder="Pegá acá el texto del documento (o elegí un PDF abajo)..."
            value={text} onChange={(e) => setText(e.target.value)} />
          <div className="formRow" style={{ alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <input type="file" className="input" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <select className="input" value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">Integrante (opcional)</option>
              {persons.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
            </select>
            <button className="btn btnPrimary" type="button" disabled={busy} onClick={analyze}>
              {busy ? "Analizando..." : "Analizar documento"}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid" style={{ gap: 10 }}>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            <span className="pill warn">{ROUTE_LABELS[route || ""] || route}</span>
            <span className="small">Confianza: {Math.round((cand.confidence || 0) * 100)}%</span>
          </div>
          <div className="small">{cand.summary}</div>

          {route === "shopping_list_to_items" ? (
            <div className="small">
              <div style={{ marginBottom: 6 }}>Productos detectados ({(fields.items || cand.proposed_payload?.items || []).length}):</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {((fields.items || cand.proposed_payload?.items || []) as string[]).map((it, i) => (
                  <span key={i} className="pill">🛒 {it}</span>
                ))}
              </div>
              <div style={{ marginTop: 6, color: "var(--muted)" }}>Al confirmar, los agrego a Compras (pendientes).</div>
            </div>
          ) : null}
          {route === "prescription_to_medication" ? (
            <label className="small">Medicamento
              <input className="input" value={fields.med_title || ""} onChange={(e) => setF("med_title", e.target.value)} />
            </label>
          ) : null}
          {route === "receipt_to_finance" ? (
            <div className="formRow" style={{ flexWrap: "wrap" }}>
              <label className="small">Monto
                <input className="input" type="number" value={fields.amount ?? ""} onChange={(e) => setF("amount", parseFloat(e.target.value))} />
              </label>
              <label className="small">Comercio
                <input className="input" value={fields.merchant || ""} onChange={(e) => setF("merchant", e.target.value)} />
              </label>
            </div>
          ) : null}
          {(route === "school_notice_to_study" || route === "insurance_policy_to_document" || route === "bill_to_finance_or_deadline" || route === "doctor_document_to_health" || route === "general_archive") ? (
            <div className="formRow" style={{ flexWrap: "wrap" }}>
              <label className="small" style={{ flex: 1, minWidth: 220 }}>Título
                <input className="input" style={{ width: "100%" }} value={fields.title || ""} onChange={(e) => setF("title", e.target.value)} />
              </label>
              {("due_date" in fields) ? (
                <label className="small">Vence (dd/mm/aaaa)
                  <input className="input" value={fields.due_date || ""} onChange={(e) => setF("due_date", e.target.value)} />
                </label>
              ) : null}
            </div>
          ) : null}

          {cand.person_id ? null : (
            <select className="input" value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">Integrante (si corresponde)</option>
              {persons.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
            </select>
          )}

          <div className="formRow">
            <button className="btn btnPrimary" type="button" disabled={busy} onClick={confirm}>Confirmar y crear</button>
            <button className="btn" type="button" disabled={busy} onClick={reject}>Rechazar propuesta</button>
          </div>
        </div>
      )}

      {msg ? <div className="small" style={{ marginTop: 10, color: "var(--primary)" }}>{msg}</div> : null}
    </div>
  );
}
