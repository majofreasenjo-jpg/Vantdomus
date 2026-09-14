"use client";

/**
 * OPS-2 M9 — Documentos familiares con trazabilidad.
 *
 * Registro de documentos SEPARADO de la memoria: cada archivo guarda su huella
 * (sha256), versión, origen, vigencia y estado de antivirus. Subir una versión
 * nueva reemplaza la anterior dejando rastro. Un documento infectado o vencido
 * queda en cuarentena (no alimenta a Domi). El escáner real es opcional (infra):
 * sin él, los archivos salen marcados "sin escanear".
 */
import { useEffect, useRef, useState } from "react";
import {
  listFamilyDocuments, uploadFamilyDocument, deleteFamilyDocument, setDocumentValidity,
} from "../../lib/api";

type Doc = {
  id: string; filename: string; size_bytes: number; sha256: string; version: number;
  source: string; scan_status: string; valid_until?: string | null; servable: boolean;
  visibility_scope?: string; created_at: string;
};

const SCAN_BADGE: Record<string, { label: string; cls: string }> = {
  clean: { label: "✓ Limpio", cls: "" },
  skipped: { label: "sin escanear", cls: "warn" },
  infected: { label: "⚠ Infectado", cls: "bad" },
  pending: { label: "pendiente", cls: "warn" },
  error: { label: "error escaneo", cls: "bad" },
};

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function FamilyDocuments({ hid }: { hid: string }) {
  const [items, setItems] = useState<Doc[]>([]);
  const [avEnabled, setAvEnabled] = useState(false);
  const [scope, setScope] = useState("household_shared");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [replaceFor, setReplaceFor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      const r = (await listFamilyDocuments(hid)) as { items?: Doc[]; antivirus_enabled?: boolean };
      setItems(r?.items || []);
      setAvEnabled(!!r?.antivirus_enabled);
    } catch { /* silencioso */ }
  }
  useEffect(() => { refresh(); }, [hid]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || busy) return;
    setBusy(true); setNote("");
    try {
      const opts: { visibility_scope: string; supersedes?: string } = { visibility_scope: scope };
      if (replaceFor) opts.supersedes = replaceFor;
      const r = (await uploadFamilyDocument(hid, file, opts)) as { duplicate?: boolean; version?: number };
      setNote(r?.duplicate ? "Ese documento ya estaba registrado (misma huella)." :
        `Registrado${r?.version && r.version > 1 ? ` como versión ${r.version}` : ""}.`);
      setReplaceFor(null);
      await refresh();
    } catch {
      setNote("No se pudo registrar el documento.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(id: string) {
    try { await deleteFamilyDocument(id, hid); await refresh(); } catch { /* noop */ }
  }
  async function expireNow(id: string) {
    try { await setDocumentValidity(id, hid, new Date().toISOString()); await refresh(); } catch { /* noop */ }
  }

  return (
    <div className="card" style={{ padding: 14, display: "grid", gap: 12 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <strong>📁 Documentos de la familia ({items.length})</strong>
        <span className="pill" style={{ opacity: 0.8 }}>
          Antivirus: {avEnabled ? "activo" : "no configurado"}
        </span>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label className="small">
          <input type="radio" name="doc-scope" checked={scope === "household_shared"}
            onChange={() => setScope("household_shared")} /> De la familia
        </label>
        <label className="small">
          <input type="radio" name="doc-scope" checked={scope === "private_self"}
            onChange={() => setScope("private_self")} /> Privado (solo mío)
        </label>
        <input ref={fileRef} type="file" onChange={onFile} disabled={busy}
          aria-label="Subir documento" style={{ marginLeft: "auto" }} />
      </div>
      {replaceFor ? (
        <div className="small" style={{ color: "var(--muted)" }}>
          Vas a subir una <b>nueva versión</b> que reemplaza la actual.{" "}
          <button className="pill" style={{ cursor: "pointer" }} onClick={() => setReplaceFor(null)}>cancelar</button>
        </div>
      ) : null}
      {note ? <div className="small" style={{ color: "var(--muted)" }}>{note}</div> : null}

      {items.length === 0 ? (
        <div className="small" style={{ color: "var(--muted)" }}>
          Aún no hay documentos. Sube un PDF o una foto (boleta, receta, certificado…).
        </div>
      ) : (
        <div className="grid" style={{ gap: 6 }}>
          {items.map((d) => {
            const badge = SCAN_BADGE[d.scan_status] || SCAN_BADGE.pending;
            return (
              <div key={d.id} className="row" style={{ justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>
                    {d.filename}{d.version > 1 ? ` · v${d.version}` : ""}
                    {!d.servable ? " 🔒" : ""}
                  </span>
                  <span className="small" style={{ display: "block", color: "var(--muted)" }}>
                    {fmtSize(d.size_bytes)} · {d.visibility_scope === "private_self" ? "privado" : "familia"}
                    {d.valid_until ? ` · vence ${new Date(d.valid_until).toLocaleDateString("es-CL")}` : ""}
                    {" · "}<span title={d.sha256}>#{d.sha256.slice(0, 8)}</span>
                  </span>
                </span>
                <span className={`pill ${badge.cls}`}>{badge.label}</span>
                <button className="pill" style={{ cursor: "pointer" }} onClick={() => setReplaceFor(d.id)}>Nueva versión</button>
                <button className="pill" style={{ cursor: "pointer" }} onClick={() => expireNow(d.id)}>Vencer</button>
                <button className="pill bad" style={{ cursor: "pointer" }} onClick={() => remove(d.id)}>Eliminar</button>
              </div>
            );
          })}
        </div>
      )}

      <div className="small" style={{ color: "var(--muted)" }}>
        El documento es evidencia; lo que Domi aprende de él vive aparte, en la memoria. Un
        archivo infectado o vencido nunca se usa. {avEnabled ? "" : "El antivirus se activa con configuración del administrador."}
      </div>
    </div>
  );
}
