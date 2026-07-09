"use client";

/**
 * DomiDocPanel — CP1c-FUNC-MIN-2 (Domi Documental real).
 *
 * Conecta a Domi con la BANDEJA INTELIGENTE REAL existente (/smart_inbox/*):
 *  - Subir PDF o pegar texto → smartInboxAnalyze (extracción/clasificación reales
 *    por reglas del backend, SIN IA externa).
 *  - Muestra la propuesta clasificada (tipo, resumen, entidades, integrante,
 *    confianza) como propuesta conversacional de Domi.
 *  - Confirmar / Rechazar → smartInboxConfirm / smartInboxReject (persistencia +
 *    auditoría reales del backend). Acciones sensibles = confirmación humana.
 *  - URL: SOLO demo controlada — valida formato y bloquea localhost/IPs privadas,
 *    NO hace fetch real (la lectura web real queda para MIN-2b/MIN-3 con jaula).
 *
 * No crea backend nuevo ni bandeja paralela: reutiliza smart_inbox tal cual.
 */
import { useState } from "react";
import { UploadCloud, FileText, Link2, X, Check, ShieldAlert } from "lucide-react";
import { smartInboxAnalyze, smartInboxConfirm, smartInboxReject } from "../../../lib/api";
import type { DomiState } from "./domiTypes";

type Person = { id: string; name: string };

const ROUTE_LABELS: Record<string, string> = {
  prescription_to_medication: "Receta → Medicamento",
  receipt_to_finance: "Boleta → Gasto",
  shopping_list_to_items: "Lista → Compras",
  school_notice_to_study: "Circular → Estudio",
  doctor_document_to_health: "Documento médico → Salud",
  insurance_policy_to_document: "Póliza/seguro → Vencimiento",
  bill_to_finance_or_deadline: "Cuenta → Vencimiento",
  general_archive: "Documento → Archivo",
};

// Rutas que tocan datos sensibles → SIEMPRE confirmación humana explícita.
const SENSITIVE_ROUTES = new Set([
  "prescription_to_medication",
  "doctor_document_to_health",
  "receipt_to_finance",
  "bill_to_finance_or_deadline",
  "insurance_policy_to_document",
]);

// Rutas donde el backend exige un integrante asignado para poder confirmar.
const NEEDS_PERSON = new Set([
  "school_notice_to_study",
  "prescription_to_medication",
]);

// Adónde llevar al usuario para VER lo que Domi acaba de crear, según el tipo.
function moduleFor(route: string, hid: string): { label: string; href: string } {
  if (route === "receipt_to_finance" || route === "bill_to_finance_or_deadline")
    return { label: "Ver en Finanzas", href: `/finance/${hid}` };
  if (route === "prescription_to_medication" || route === "doctor_document_to_health")
    return { label: "Ver en Salud", href: `/health/${hid}` };
  if (route === "shopping_list_to_items")
    return { label: "Ver en Compras", href: `/compras/${hid}` };
  return { label: "Ver en Recordatorios", href: `/recordatorios/${hid}` };
}

/**
 * Validación de URL para la DEMO controlada (sin fetch real). Solo http(s) y se
 * rechazan localhost / IPs privadas / loopback / link-local / red interna, para
 * dejar la arquitectura anti-SSRF preparada aunque todavía no se navegue.
 */
function validateDemoUrl(raw: string): { ok: boolean; reason?: string; host?: string } {
  const s = raw.trim();
  if (!s) return { ok: false, reason: "Pega un enlace primero." };
  let u: URL;
  try { u = new URL(s); } catch { return { ok: false, reason: "Ese enlace no tiene un formato válido (ej: https://colegio.cl/circular)." }; }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, reason: "Solo se permiten enlaces http(s)." };
  }
  const host = u.hostname.toLowerCase();
  const blockedHosts = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "metadata", "metadata.google.internal"];
  if (blockedHosts.includes(host)) return { ok: false, reason: "Ese destino no está permitido (dirección interna/local)." };
  // IPs privadas / loopback / link-local
  const priv = [
    /^127\./, /^10\./, /^192\.168\./, /^169\.254\./,
    /^172\.(1[6-9]|2\d|3[01])\./, /^0\./,
    /^::1$/, /^fe80:/i, /^fc00:/i, /^fd[0-9a-f]{2}:/i,
  ];
  if (priv.some((re) => re.test(host))) return { ok: false, reason: "Ese destino apunta a una red interna/privada y está bloqueado." };
  if (host.endsWith(".local") || host.endsWith(".internal")) return { ok: false, reason: "Los dominios internos (.local/.internal) están bloqueados." };
  return { ok: true, host };
}

type Candidate = {
  id: string | null;
  route_type?: string;
  suggested_category?: string;
  title?: string;
  summary?: string;
  confidence?: number;
  requires_confirmation?: boolean;
  proposed_payload?: Record<string, any>;
  person_id?: string | null;
  _demo?: boolean;
  _source?: string;
};

export default function DomiDocPanel({
  hid,
  persons,
  isLight,
  isDemo = false,
  onDomiState,
  onNotify,
  onClose,
}: {
  hid: string;
  persons: Person[];
  isLight: boolean;
  // MIN-2.2: en demo/sesión inválida no se crean registros reales en el hogar.
  isDemo?: boolean;
  onDomiState: (s: DomiState) => void;
  onNotify: (title: string, msg: string, type: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"archivo" | "texto" | "url">("archivo");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [personId, setPersonId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [cand, setCand] = useState<Candidate | null>(null);
  // Tras confirmar, guarda la ruta creada para ofrecer "Ver en …".
  const [doneRoute, setDoneRoute] = useState<string | null>(null);
  // Resumen de lo creado (para mostrarlo en Domi sin salir a otro módulo).
  const [created, setCreated] = useState<{ route: string; merchant?: string; amount?: number; due_date?: string; title?: string; result_type?: string } | null>(null);
  // Aviso de posible gasto duplicado (mismo comercio+monto+día).
  const [dupWarn, setDupWarn] = useState(false);

  const card = isLight
    ? "bg-white/95 border-slate-200 text-slate-800"
    : "bg-slate-950/95 border-slate-800 text-slate-100";
  const inputCls = isLight
    ? "bg-white border-slate-300 text-slate-800 placeholder-slate-400"
    : "bg-slate-900/70 border-slate-700 text-slate-100 placeholder-slate-500";
  const tabActive = "bg-amber-500/20 border-amber-500/40 text-amber-500 font-semibold";
  const tabIdle = isLight ? "border-slate-200 text-slate-500 hover:text-slate-700" : "border-slate-700 text-slate-400 hover:text-slate-200";

  async function analyze() {
    setMsg("");
    setCand(null);
    setDoneRoute(null);
    setCreated(null);
    setDupWarn(false);

    if (mode === "url") {
      const v = validateDemoUrl(url);
      if (!v.ok) { setMsg(v.reason || "Enlace no válido."); return; }
      // DEMO CONTROLADA: no se hace fetch real. Se registra como fuente pendiente.
      onDomiState("proponiendo");
      setCand({
        id: null,
        route_type: "general_archive",
        title: "Enlace recibido",
        summary: `Guardé el enlace de "${v.host}" como fuente pendiente. En esta versión Domi todavía NO abre páginas web (para hacerlo con seguridad falta la "jaula" anti-SSRF). La lectura real de URLs llega en una fase siguiente.`,
        confidence: 0,
        requires_confirmation: false,
        proposed_payload: { source_url: url.trim() },
        _demo: true,
        _source: url.trim(),
      });
      return;
    }

    if (mode === "texto" && !text.trim()) { setMsg("Pega el texto del documento."); return; }
    if (mode === "archivo" && !file) { setMsg("Elige un archivo (PDF)."); return; }

    setBusy(true);
    onDomiState("pensando");
    try {
      const fd = new FormData();
      if (mode === "texto") fd.set("pasted_text", text.trim());
      if (mode === "archivo" && file) fd.set("file", file);
      const c = (await smartInboxAnalyze(hid, personId, fd)) as Candidate;
      setCand(c);
      const sensitive = SENSITIVE_ROUTES.has(c.route_type || "");
      onDomiState(sensitive || c.requires_confirmation ? "esperando_confirmacion" : "proponiendo");
    } catch (e: any) {
      const emsg = String(e?.message || "error");
      if (emsg.includes("401") || emsg.toLowerCase().includes("unauthorized") || emsg.toLowerCase().includes("authentication")) {
        setMsg("Tu sesión expiró. Entra de nuevo (Más → Cerrar sesión → iniciar sesión) y vuelve a intentarlo.");
      } else if (emsg.includes("415") || emsg.toLowerCase().includes("unsupported")) {
        setMsg("Ese tipo de archivo no se pudo leer. Prueba con un PDF con texto o pega el texto directamente.");
      } else {
        setMsg(`No pude analizar el documento (${emsg}). Si es una imagen escaneada, el OCR es limitado en esta versión: prueba con un PDF con texto o pega el texto.`);
      }
      onDomiState("listo");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(allowDuplicate = false) {
    if (!cand) return;
    if (cand._demo || !cand.id) {
      setMsg("Este enlace es una demo: no hay nada que crear todavía. Quedó registrado como fuente pendiente.");
      return;
    }
    // Estudio/medicamento requieren integrante. Si el candidato no lo tiene y
    // aún no elegiste uno, lo pedimos aquí antes de confirmar.
    const needsPerson = NEEDS_PERSON.has(cand.route_type || "") && !cand.person_id;
    if (needsPerson && !personId) {
      setMsg("Para crear esto, elige primero el integrante al que corresponde.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      let target = cand;
      // Re-analiza con el integrante para asociarlo (el backend fija la persona
      // en el análisis, no en la confirmación).
      if (needsPerson && personId) {
        const fd = new FormData();
        if (text.trim()) fd.set("pasted_text", text.trim());
        if (file) fd.set("file", file);
        target = (await smartInboxAnalyze(hid, personId, fd)) as Candidate;
      }
      const pay = target.proposed_payload || {};
      const res = (await smartInboxConfirm(target.id as string, pay, allowDuplicate)) as { result_type?: string };
      onNotify("Documento confirmado", `Domi creó: ${res?.result_type || "registro"}. Queda en el historial del hogar.`, "system");
      onDomiState("alegre");
      setDoneRoute(target.route_type || cand.route_type || "general_archive");
      // Resumen para mostrar en Domi (sin salir a otro módulo).
      setCreated({
        route: target.route_type || "general_archive",
        result_type: res?.result_type,
        merchant: pay.merchant,
        amount: pay.amount,
        due_date: pay.due_date,
        title: pay.med_title || pay.title,
      });
      setDupWarn(false);
      setCand(null); setFile(null); setText("");
      setMsg("");
    } catch (e: any) {
      const emsg = String(e?.message || "error");
      if (emsg.includes("409") || emsg.toUpperCase().includes("DUPLICADO")) {
        setDupWarn(true);
        setMsg("Ya registraste hoy un gasto igual (mismo comercio y monto). ¿Lo creo de todos modos?");
      } else {
        setMsg("No pude confirmar: " + emsg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!cand) return;
    if (cand._demo || !cand.id) { setCand(null); setMsg("Descartado."); onDomiState("listo"); return; }
    setBusy(true);
    setMsg("");
    try {
      await smartInboxReject(cand.id, "Rechazado por el usuario");
      onNotify("Propuesta descartada", "Domi no creó nada.", "system");
      onDomiState("listo");
      setCand(null);
      setMsg("Descartado, no creé nada.");
    } catch (e: any) {
      setMsg("No pude rechazar: " + (e?.message || "error"));
    } finally {
      setBusy(false);
    }
  }

  const route = cand?.route_type || "";
  const pay = cand?.proposed_payload || {};
  const sensitive = SENSITIVE_ROUTES.has(route);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(10,10,25,.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-xl rounded-3xl border shadow-2xl p-6 max-h-[90vh] overflow-y-auto ${card}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <FileText className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <h3 className="text-base font-bold font-display leading-tight">Domi Documental</h3>
              <p className="text-sm opacity-60">Domi lee, entiende y propone. Tú confirmas.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"><X className="w-4 h-4 opacity-70" /></button>
        </div>

        {isDemo ? (
          /* MIN-2.2: en demo/sesión inválida NO se crean registros reales. */
          <div className={`rounded-2xl border p-5 text-center ${isLight ? "bg-amber-50 border-amber-200" : "bg-amber-500/10 border-amber-500/30"}`}>
            <ShieldAlert className="w-7 h-7 mx-auto mb-2 text-amber-500" />
            <p className="text-base font-semibold mb-1">Estás en modo demo</p>
            <p className="text-sm opacity-80 mb-4">
              Domi no puede guardar documentos en tu hogar real sin una sesión válida. Inicia sesión para leer y registrar de verdad.
            </p>
            <a href="/login" className="inline-flex items-center justify-center gap-1.5 py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-base font-semibold cursor-pointer hover:brightness-105 transition-all">
              Iniciar sesión
            </a>
          </div>
        ) : !cand ? (
          <>
            {/* Selector de modo */}
            <div className="flex gap-2 mb-3">
              {([["archivo", "PDF", UploadCloud], ["texto", "Texto", FileText], ["url", "Enlace", Link2]] as const).map(([m, label, Icon]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setMsg(""); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition-colors cursor-pointer ${mode === m ? tabActive : tabIdle}`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            {mode === "archivo" && (
              <label className={`block rounded-2xl border border-dashed p-5 text-center cursor-pointer ${isLight ? "border-slate-300 hover:bg-slate-50" : "border-slate-700 hover:bg-slate-900/60"}`}>
                <UploadCloud className="w-6 h-6 mx-auto mb-1.5 text-amber-500" />
                <span className="text-sm opacity-80">{file ? file.name : "Elegí un PDF (receta, boleta, circular, cuenta…)"}</span>
                <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <p className="text-sm opacity-50 mt-1.5">PDF con texto = lectura real. Imágenes escaneadas: OCR limitado en esta versión.</p>
              </label>
            )}
            {mode === "texto" && (
              <textarea
                rows={5}
                className={`w-full rounded-2xl border p-3 text-base outline-none focus:border-amber-500/60 ${inputCls}`}
                placeholder="Pega aquí el texto del documento (circular del colegio, receta, cuenta, lista…)"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            )}
            {mode === "url" && (
              <div>
                <input
                  className={`w-full rounded-2xl border p-3 text-base outline-none focus:border-amber-500/60 ${inputCls}`}
                  placeholder="https://colegio.cl/circular-marzo"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <div className="flex items-start gap-1.5 mt-2 text-sm text-amber-600/90">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Demo controlada: Domi valida el enlace y lo guarda como fuente, pero <b>todavía no abre páginas web</b> (la lectura real llega con jaula de seguridad).</span>
                </div>
              </div>
            )}

            {/* Integrante */}
            {persons.length > 0 && (
              <select
                className={`w-full mt-3 rounded-xl border p-2.5 text-sm outline-none ${inputCls}`}
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
              >
                <option value="">¿De qué integrante es? (opcional)</option>
                {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={analyze}
              className="w-full mt-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-base font-semibold disabled:opacity-60 cursor-pointer hover:brightness-105 transition-all"
            >
              {busy ? "Analizando…" : "Analizar con Domi"}
            </button>
          </>
        ) : (
          <>
            {/* Propuesta */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full text-sm font-semibold bg-amber-500/15 text-amber-600 border border-amber-500/30">
                {ROUTE_LABELS[route] || "Documento"}
              </span>
              {cand._demo ? (
                <span className="px-2 py-1 rounded-full text-sm font-mono bg-slate-500/15 text-slate-400 border border-slate-500/30">DEMO · sin fetch</span>
              ) : (
                <span className="text-sm opacity-60">Confianza {Math.round((cand.confidence || 0) * 100)}%</span>
              )}
            </div>

            <p className="text-base opacity-90 mb-3">{cand.summary}</p>

            {/* Entidades detectadas */}
            {!cand._demo && (
              <div className={`rounded-2xl border p-3 mb-3 text-sm space-y-1 ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/50 border-slate-800"}`}>
                {route === "shopping_list_to_items" && Array.isArray(pay.items) && (
                  <div>
                    <span className="opacity-60">Productos detectados ({pay.items.length}):</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {(pay.items as string[]).map((it, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">🛒 {it}</span>
                      ))}
                    </div>
                  </div>
                )}
                {pay.med_title && <div><span className="opacity-60">Medicamento:</span> <b>{pay.med_title}</b></div>}
                {pay.title && !pay.med_title && <div><span className="opacity-60">Título:</span> <b>{pay.title}</b></div>}
                {pay.merchant && <div><span className="opacity-60">Comercio:</span> <b>{pay.merchant}</b></div>}
                {/* Detalle de la boleta: producto -> precio */}
                {Array.isArray(pay.line_items) && pay.line_items.length > 0 && (
                  <div className="pt-1">
                    <span className="opacity-60">Detalle de la compra ({pay.line_items.length}):</span>
                    <div className={`mt-1 rounded-lg p-2 space-y-0.5 ${isLight ? "bg-white/70" : "bg-slate-900/60"}`}>
                      {(pay.line_items as Array<{ name: string; price: number }>).map((it, i) => (
                        <div key={i} className="flex justify-between gap-3">
                          <span className="truncate">{it.name}</span>
                          <span className="font-mono shrink-0">${Number(it.price).toLocaleString("es-CL")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {pay.amount != null && <div className="pt-1"><span className="opacity-60">Total:</span> <b>${Number(pay.amount).toLocaleString("es-CL")}</b></div>}
                {pay.due_date && <div><span className="opacity-60">Vence:</span> <b>{pay.due_date}</b></div>}
              </div>
            )}

            {/* Fuente (para URL demo) */}
            {cand._source && (
              <div className="text-sm opacity-60 mb-3 break-all">Fuente: {cand._source}</div>
            )}

            {sensitive && !cand._demo && (
              <div className="flex items-start gap-1.5 mb-3 text-sm text-amber-600">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Es información sensible (salud/finanzas). Domi solo la propone: <b>la confirmas tú</b>.</span>
              </div>
            )}

            {/* Estudio/medicamento: elegir integrante antes de confirmar */}
            {!cand._demo && NEEDS_PERSON.has(route) && !cand.person_id && persons.length > 0 && (
              <select
                className={`w-full mb-3 rounded-xl border p-2.5 text-sm outline-none ${inputCls}`}
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
              >
                <option value="">Elige el integrante (requerido para crear)</option>
                {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => confirm(false)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-base font-semibold disabled:opacity-60 cursor-pointer hover:brightness-105 transition-all"
              >
                <Check className="w-4 h-4" /> {cand._demo ? "Entendido" : "Confirmar y crear"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={reject}
                className={`px-4 py-2.5 rounded-xl border text-base cursor-pointer ${isLight ? "border-slate-300 hover:bg-slate-100" : "border-slate-700 hover:bg-slate-800"}`}
              >
                {cand._demo ? "Cerrar" : "Rechazar"}
              </button>
            </div>

            {/* Posible duplicado: Domi avisa y pide confirmación extra. */}
            {dupWarn && (
              <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                <div className="flex items-start gap-1.5 text-sm text-amber-600 mb-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Ya hay un gasto igual hoy (mismo comercio y monto). Para no duplicar, no lo cree.</span>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => confirm(true)}
                  className="w-full py-2 rounded-lg border border-amber-500/50 text-amber-600 text-sm font-semibold cursor-pointer hover:bg-amber-500/15"
                >
                  Crear de todos modos
                </button>
              </div>
            )}
          </>
        )}

        {msg && <p className="text-base mt-3 opacity-85">{msg}</p>}

        {/* Resumen de lo que Domi creó (visible sin salir a otro módulo). */}
        {created && (
          <div className={`mt-3 rounded-2xl border p-4 ${isLight ? "bg-emerald-50 border-emerald-200" : "bg-emerald-500/10 border-emerald-500/30"}`}>
            <div className="flex items-center gap-1.5 text-emerald-500 font-semibold text-base mb-1.5">
              <Check className="w-4 h-4" /> Creado y registrado
            </div>
            <div className="text-sm space-y-0.5 opacity-90">
              <div><span className="opacity-60">Tipo:</span> {ROUTE_LABELS[created.route] || "Documento"}</div>
              {created.merchant && <div><span className="opacity-60">Comercio:</span> <b>{created.merchant}</b></div>}
              {created.amount != null && <div><span className="opacity-60">Monto:</span> <b>${Number(created.amount).toLocaleString("es-CL")}</b></div>}
              {created.due_date && <div><span className="opacity-60">Fecha:</span> <b>{created.due_date}</b></div>}
              {created.title && !created.merchant && <div><span className="opacity-60">Título:</span> {created.title}</div>}
            </div>
          </div>
        )}

        {/* Tras crear, lleva directo a ver el resultado (sin copiar URLs). */}
        {doneRoute && hid && (
          <a
            href={moduleFor(doneRoute, hid).href}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-600 text-base font-semibold cursor-pointer hover:bg-amber-500/20 transition-colors"
          >
            {moduleFor(doneRoute, hid).label} →
          </a>
        )}
      </div>
    </div>
  );
}
