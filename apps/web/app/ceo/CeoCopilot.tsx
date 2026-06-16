"use client";

import React, { useMemo, useRef, useState } from "react";
import { analyzeContractualPackage, analyzeForensicDocument, assistantChat } from "@/lib/api";

type ChatRole = "assistant" | "user";
type ChatMessage = { role: ChatRole; content: string };
type VantPhase = "listening" | "thinking" | "responding";

function fmt(value: any, suffix = "%") {
  const n = Number(value);
  if (!Number.isFinite(n)) return "s/d";
  return `${n.toFixed(0)}${suffix}`;
}

function money(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "s/d";
  return `M$ ${Math.round(n).toLocaleString("es-CL")}`;
}

function getLowest(items: any[], scoreKey: string) {
  return [...items].filter(Boolean).sort((a, b) => Number(a?.[scoreKey] ?? 100) - Number(b?.[scoreKey] ?? 100))[0];
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildExecutiveContext(state: any, tax: any) {
  const gerencias = state?.gerencias || [];
  const departments = gerencias.flatMap((g: any) =>
    (g.departments || []).map((d: any) => ({
      ...d,
      gerencia: g.name,
    }))
  );
  const weakestGerencia = getLowest(gerencias, "macro_osi");
  const weakestUnit = getLowest(departments, "hsi");
  const pnl = state?.pnl || {};

  return [
    `Cliente: ${tax?.client_name || "Cliente"}.`,
    `KPI global continuidad/OSI: ${fmt(state?.global_osi)}; HSE: ${fmt(state?.global_health)}; SLA/tareas: ${fmt(state?.global_task)}; gasto/finanzas: ${fmt(state?.global_finance)}.`,
    `Resultado proyectado: ${money(pnl.net_income)}; EBITDA: ${money(pnl.ebitda)}; margen EBITDA: ${fmt(state?.ebitda_margin ?? pnl.ebitda_margin)}.`,
    weakestGerencia ? `Gerencia con mayor atencion: ${weakestGerencia.name} (${fmt(weakestGerencia.macro_osi)} OSI).` : "",
    weakestUnit ? `Unidad critica: ${weakestUnit.name} en ${weakestUnit.gerencia} (${fmt(weakestUnit.osi)} OSI).` : "",
    "Capacidades esperadas: planificador de unidades, direccion de obra, control de gastos, licitaciones, repositorio documental, claims forense NOC23/NOC24 y escenarios what-if.",
  ].filter(Boolean).join(" ");
}

function buildOpeningBrief(state: any, tax: any) {
  const gerencias = state?.gerencias || [];
  const departments = gerencias.flatMap((g: any) =>
    (g.departments || []).map((d: any) => ({ ...d, gerencia: g.name }))
  );
  const weakestGerencia = getLowest(gerencias, "macro_osi");
  const weakestUnit = getLowest(departments, "osi");
  const pnl = state?.pnl || {};
  const netIncome = Number(pnl.net_income || 0);
  const globalOsi = Number(state?.global_osi || 0);
  const finance = Number(state?.global_finance || 0);
  const task = Number(state?.global_task || 0);

  const alert =
    netIncome < 0 || globalOsi < 65 || finance < 75 || task < 70
      ? "El tablero muestra una condicion que requiere decision ejecutiva."
      : "El tablero se mantiene operativo, pero conviene sostener control preventivo.";

  const priority = netIncome < 0
    ? "priorizar gasto, licitaciones y stress financiero"
    : task < 70
      ? "priorizar direccion de obra y ruta critica"
      : globalOsi < 70
        ? "priorizar continuidad operacional y unidades con menor OSI"
        : "mantener seguimiento de evidencia y escenarios";

  return [
    "Resumen ejecutivo:",
    alert,
    weakestGerencia ? `Foco: ${weakestGerencia.name} (${fmt(weakestGerencia.macro_osi)}).` : "",
    weakestUnit ? `Unidad critica: ${weakestUnit.name}.` : "",
    `Resultado: ${money(pnl.net_income)} | Gasto ${fmt(state?.global_finance)} | SLA ${fmt(state?.global_task)}.`,
    `Accion sugerida: ${priority}.`,
  ].filter(Boolean).join("\n");
}

function localFallback(question: string, state: any, tax: any) {
  const lower = normalizeText(question);
  const pnl = state?.pnl || {};
  const directAnswer = answerKnownQuestion(lower, state, pnl, tax);
  if (directAnswer) return directAnswer;

  const focus = lower.includes("claim") || lower.includes("evidencia") || lower.includes("licit")
    ? "Prioriza matriz de evidencia, bitacora con adjuntos, trazabilidad de fechas NOC y cruce contra contrato/oferta economica."
    : lower.includes("gasto") || lower.includes("margen") || lower.includes("ebitda")
      ? "Prioriza partidas con desviacion de gasto, impacto EBITDA y escenarios de recuperacion antes de autorizar nuevas compras o adicionales."
      : lower.includes("hse") || lower.includes("derrame")
        ? "Prioriza eventos HSE, evidencia privada, responsable, fecha de ocurrencia y acciones preventivas con vencimiento."
        : "Prioriza continuidad de abastecimiento, SLA de despacho cisterna, unidades con menor OSI y decisiones de correccion de rumbo.";

  return [
    "Respuesta ejecutiva:",
    focus,
    "",
    "Siguiente paso:",
    "Abre el modulo asociado y deja evidencia fuente antes de decidir.",
  ].join("\n");
}

function buildCriticalAnswer(state: any, tax: any) {
  const gerencias = state?.gerencias || [];
  const departments = gerencias.flatMap((g: any) =>
    (g.departments || []).map((d: any) => ({ ...d, gerencia: g.name }))
  );
  const weakestGerencia = getLowest(gerencias, "macro_osi");
  const weakestUnit = getLowest(departments, "hsi");
  const pnl = state?.pnl || {};
  const netIncome = Number(pnl.net_income || 0);
  const task = Number(state?.global_task || 0);
  const finance = Number(state?.global_finance || 0);

  const critical = netIncome < 0
    ? "Resultado financiero negativo"
    : task < 65
      ? "SLA / direccion de obra"
      : finance < 75
        ? "Gasto y recuperabilidad"
        : "Continuidad operacional";

  return [
    "Lo mas critico hoy:",
    `1. ${critical}. Resultado proyectado: ${money(pnl.net_income)}.`,
    weakestGerencia ? `2. Gerencia a revisar: ${weakestGerencia.name} (${fmt(weakestGerencia.macro_osi)} OSI).` : "",
    weakestUnit ? `3. Unidad critica: ${weakestUnit.name}${weakestUnit.gerencia ? ` / ${weakestUnit.gerencia}` : ""}.` : "",
    "",
    "Decision recomendada:",
    "Congelar gasto no trazable, revisar licitacion/contrato y abrir plan de correccion para la unidad critica.",
  ].filter(Boolean).join("\n");
}

function formatContractualAnalysis(resp: any) {
  const findings = Array.isArray(resp?.findings) ? resp.findings : [];
  const docs = Array.isArray(resp?.reviewed_documents) ? resp.reviewed_documents : [];
  const checklist = Array.isArray(resp?.checklist) ? resp.checklist : [];
  const summary = Array.isArray(resp?.executive_summary) ? resp.executive_summary : [];
  const topFindings = findings.slice(0, 6).map((item: any, idx: number) => [
    `${idx + 1}. ${item.topic || "Hallazgo"} [${item.severity || "s/d"}]`,
    `   Fuente: ${item.source || "Paquete documental"}`,
    `   Impacto: ${item.impact || "Pendiente de cuantificar."}`,
    `   Recomendacion: ${item.recommendation || "Revisar con evidencia fuente."}`,
    item.suggested_clause ? `   Clausula sugerida: ${item.suggested_clause}` : "",
  ].filter(Boolean).join("\n"));

  return [
    "Motor contractual/comercial VantDomus activado:",
    `Riesgo estimado: ${resp?.risk_score ?? "s/d"}/100.`,
    "",
    "Resumen ejecutivo:",
    ...(summary.length ? summary.map((item: string) => `- ${item}`) : ["- Paquete procesado y registrado en bitacora."]),
    "",
    "Documentos leidos:",
    ...(docs.length ? docs.map((doc: any) => `- ${doc.filename}: ${doc.document_type} (${doc.extracted_chars || 0} caracteres, OCR ${doc.ocr_status || "s/d"})`) : ["- Sin detalle documental."]),
    "",
    "Hallazgos principales:",
    ...(topFindings.length ? topFindings : ["Sin hallazgos automaticos suficientes; revisar OCR o adjuntar contrato/oferta/BBTT/ECO."]),
    "",
    "Checklist de cierre:",
    ...(checklist.slice(0, 7).map((item: string) => `- ${item}`)),
  ].join("\n");
}

function answerKnownQuestion(normalizedQuestion: string, state: any, pnl: any, tax?: any) {
  const clientName = tax?.client_name || "cliente";
  const isWhereQuestion =
    normalizedQuestion.includes("donde") ||
    normalizedQuestion.includes("en que parte") ||
    normalizedQuestion.includes("como veo") ||
    normalizedQuestion.includes("ubico") ||
    normalizedQuestion.includes("explicame donde");
  const asksOverspend =
    normalizedQuestion.includes("sobre gasto") ||
    normalizedQuestion.includes("sobregasto") ||
    normalizedQuestion.includes("gasto") ||
    normalizedQuestion.includes("costo") ||
    normalizedQuestion.includes("desviacion");
  const asksDocuments =
    normalizedQuestion.includes("documento") ||
    normalizedQuestion.includes("archivo") ||
    normalizedQuestion.includes("respaldo") ||
    normalizedQuestion.includes("subo") ||
    normalizedQuestion.includes("cargar") ||
    normalizedQuestion.includes("adjuntar");
  const asksClaim =
    normalizedQuestion.includes("claim") ||
    normalizedQuestion.includes("noc") ||
    normalizedQuestion.includes("evidencia") ||
    normalizedQuestion.includes("forense");
  const asksTender =
    normalizedQuestion.includes("licitacion") ||
    normalizedQuestion.includes("licitaciones") ||
    normalizedQuestion.includes("oferta") ||
    normalizedQuestion.includes("adjudicacion") ||
    normalizedQuestion.includes("apu") ||
    normalizedQuestion.includes("bases tecnicas") ||
    normalizedQuestion.includes("contrato");
  const asksForensicExample =
    (normalizedQuestion.includes("ejemplo") || normalizedQuestion.includes("modelo") || normalizedQuestion.includes("formato") || normalizedQuestion.includes("plantilla")) &&
    (normalizedQuestion.includes("informe") || normalizedQuestion.includes("forense") || normalizedQuestion.includes("dossier"));
  const asksCorrection =
    normalizedQuestion.includes("corregir") ||
    normalizedQuestion.includes("que debo") ||
    normalizedQuestion.includes("prioridad") ||
    normalizedQuestion.includes("rumbo");
  const asksCritical =
    normalizedQuestion.includes("critico") ||
    normalizedQuestion.includes("critica") ||
    normalizedQuestion.includes("mas grave") ||
    normalizedQuestion.includes("mayor riesgo") ||
    normalizedQuestion.includes("donde esta lo mas");

  if (asksCritical) {
    return buildCriticalAnswer(state, tax);
  }

  if ((isWhereQuestion || asksDocuments) && asksDocuments) {
    return [
      "Los documentos importantes se suben en la Bitacora Operativa de Proyecto, al final del dashboard.",
      "",
      "Paso a paso:",
      "1. Baja hasta la seccion Bitacora Operativa de Proyecto.",
      "2. En Tipo de entrada elige segun el caso: Auditoria, Inspeccion, Acuerdo Comercial, Aviso / Alerta, Hito o Comentario.",
      "3. Escribe el contexto del documento: contrato, NOC, evidencia HSE, licitacion, adicional, carta, acta o respaldo de improductividad.",
      "4. Usa el campo Respaldo para adjuntar el archivo.",
      "5. Presiona Publicar Evento.",
      "",
      "Para documentos criticos de claims o licitaciones, tambien debes revisar la tarjeta Repositorio Documental y Claims Forense NOC23/NOC24. Esa vista sirve para ordenar la evidencia, pero la carga con archivo queda en la bitacora con adjunto.",
    ].join("\n");
  }

  if (isWhereQuestion && asksClaim) {
    return [
      "La evidencia de claims se revisa en dos lugares:",
      "",
      "1. Tarjeta Claims Forense NOC23/NOC24: sirve para analizar controversias, improductividad, duplicidad de adicionales y trazabilidad.",
      "2. Bitacora Operativa de Proyecto: ahi subes los respaldos como cartas NOC, actas, informes, fotos, planillas o documentos contractuales.",
      "",
      "Recomendacion: cada documento debe quedar con fecha de ocurrencia, tipo de evento y descripcion clara para que luego pueda formar parte de la matriz de evidencia.",
    ].join("\n");
  }

  if (asksTender) {
    return [
      "Si necesitas revisar una licitacion, usa esta ruta dentro de VantDomus:",
      "",
      "1. Abre la tarjeta Gasto y Licitaciones.",
      "   Ahi debes revisar oferta economica, APU, gastos generales, HH, maquinaria, costos directos y posibles desviaciones.",
      "",
      "2. Abre Repositorio Documental.",
      "   Ahi ordenas contrato, carta de adjudicacion, bases tecnicas, oferta, planillas ECO/APU, anexos, cronograma y respaldos.",
      "",
      "3. Si la licitacion ya genero controversia, abre Claims Forense NOC23/NOC24.",
      "   Ahi comparas alcance contratado vs alcance ejecutado, adicionales, improductividad, duplicidades y evidencia por fecha.",
      "",
      "4. Para subir documentos nuevos, baja a Bitacora Operativa de Proyecto.",
      "   Selecciona tipo de entrada Acuerdo Comercial, Auditoria o Aviso / Alerta, adjunta el archivo en Respaldo y presiona Publicar Evento.",
      "",
      "Checklist minimo para revisar:",
      "- Contrato y carta de adjudicacion.",
      "- Oferta economica y APU/ECO.",
      "- Bases tecnicas y alcance.",
      "- Cronograma y ruta critica.",
      "- HH, maquinaria, gastos generales y costos directos.",
      "- NOC, adicionales, actas y evidencia de improductividad si aplica.",
    ].join("\n");
  }

  if (asksForensicExample) {
    return [
      `Ejemplo de salida esperada para un informe forense VantDomus ${clientName}:`,
      "",
      "VANTDOMUS | INTELIGENCIA FORENSE",
      `DOSSIER MAESTRO: AUDITORIA FORENSE ${String(clientName).toUpperCase()}`,
      "ANEXO PERICIAL DOCUMENTAL Y FINANCIERO",
      "",
      "1. RESUMEN EJECUTIVO",
      "El documento analizado se incorpora como pieza de evidencia para contrastar oferta, contrato, bases tecnicas, ECO/APU, timeline NOC y matriz de evidencia. El objetivo es determinar si existe cambio de alcance, riesgo financiero, improductividad, duplicidad de cobros o controversia contractual.",
      "",
      "2. TRAZABILIDAD Y METODO",
      "- Archivo fuente: nombre, revision, fecha, origen y responsable.",
      "- Metodo de lectura: texto nativo u OCR.",
      "- Registro: bitacora VantDomus y repositorio documental.",
      "- Evidencia asociada: contrato, carta de adjudicacion, BBTT, ECO-01 a ECO-09, NOC, actas, fotos, correos o planillas.",
      "",
      "3. MATRIZ DE EVIDENCIA",
      "DOCUMENTO/FAMILIA | ESTADO LICITACION | ESTADO PROYECTO/CONTRATO | DIAGNOSTICO PERICIAL",
      "Ejemplo: CE-DRW-00001 | Rev_P | Rev_0 IFC | Cambio de revision con posible endurecimiento de alcance.",
      "",
      "4. HALLAZGOS PERICIALES",
      "- Hallazgo 1: diferencia entre lo ofertado y lo exigido.",
      "- Hallazgo 2: impacto en HH, maquinaria, plazo o gastos generales.",
      "- Hallazgo 3: evidencia faltante para cerrar causalidad.",
      "",
      "5. STRESS TEST FINANCIERO",
      "- Driver: aumento de alcance, paralizacion, multa UF/dia, IPC, retenciones o GG.",
      "- Impacto: monto estimado CLP/UF, periodo afectado y fuente del calculo.",
      "",
      "6. RED-LINING / BLINDAJE",
      "- Clausula de primacia documental.",
      "- Limite acumulado de multas.",
      "- Pago proporcional de GG/utilidades ante aumento de alcance.",
      "- Reconocimiento de obra extraordinaria con respaldo en libro de obra o instruccion formal.",
      "",
      "7. DICTAMEN TECNICO PRELIMINAR",
      "Con la evidencia disponible, el documento queda clasificado como soporte contractual/financiero inicial. Su fuerza probatoria depende de cruzarlo con matriz documental, timeline, contrato y respaldo economico.",
      "",
      "8. PROXIMA ACCION",
      "Sube el contrato, oferta economica, BBTT, ECO/APU y cualquier NOC asociado para que VantDomus arme el cruce forense completo.",
    ].join("\n");
  }

  if (asksCorrection) {
    return [
      "Para corregir rumbo hoy, partiria por estas tres zonas:",
      "",
      `1. KPI GLOBAL DE DIRECCION: continuidad ${fmt(state?.global_osi)}, HSE ${fmt(state?.global_health)}, SLA ${fmt(state?.global_task)} y gasto ${fmt(state?.global_finance)}.`,
      "2. Direccion de Obra: revisa atrasos, tareas, ruta critica y responsables.",
      "3. Gasto y Licitaciones: cruza desviaciones de costo contra oferta, APU, HH, maquinaria y adicionales.",
      "",
      "Decision sugerida: primero identifica la unidad con peor OSI/SLA, luego registra evidencia en bitacora y finalmente simula el escenario antes/despues.",
    ].join("\n");
  }

  if (!isWhereQuestion || !asksOverspend) return null;

  return [
    "El sobre gasto lo ves en tres zonas del dashboard:",
    "",
    "1. Arriba, en KPI GLOBAL DE DIRECCION: revisa el indicador Gasto. Si esta bajo, hay desviacion financiera.",
    "2. En la tarjeta Gasto y Licitaciones: abre ese modulo para revisar costos, oferta, APU, gastos generales, HH y maquinaria.",
    "3. Mas abajo, en Proyeccion operativa y financiera: mira costos, gastos, EBITDA/margen y resultado proyectado.",
    "",
    `Lectura actual ${clientName}: Gasto ${fmt(state?.global_finance)}, EBITDA ${money(pnl.ebitda)}, resultado proyectado ${money(pnl.net_income)}.`,
    "",
    "Para explicar la causa, cruza esa lectura con bitacora, documentos de licitacion, adicionales, NOC y evidencia de improductividad.",
  ].join("\n");
}

function VantDomusFigure({ phase, size = 96, compact = false }: { phase: VantPhase; size?: number; compact?: boolean }) {
  const palette = {
    listening: { main: "#f59e0b", soft: "rgba(245,158,11,0.28)", label: "Pregunta recibida", motion: "vantPulse" },
    thinking: { main: "#38bdf8", soft: "rgba(56,189,248,0.26)", label: "Analizando evidencia", motion: "vantScan" },
    responding: { main: "#22c55e", soft: "rgba(34,197,94,0.24)", label: "Respuesta lista", motion: "vantGlow" },
  }[phase];

  return (
    <div style={{ display: "grid", gap: 10, justifyItems: "start" }}>
      <style>{`
        @keyframes vantPulse {
          0%, 100% { transform: scale(1); opacity: 0.62; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes vantScan {
          0% { transform: translateY(-110%); opacity: 0; }
          18% { opacity: 1; }
          82% { opacity: 1; }
          100% { transform: translateY(110%); opacity: 0; }
        }
        @keyframes vantGlow {
          0%, 100% { box-shadow: 0 0 18px rgba(34,197,94,0.22), 0 0 36px rgba(245,158,11,0.14); }
          50% { box-shadow: 0 0 28px rgba(34,197,94,0.45), 0 0 52px rgba(245,158,11,0.24); }
        }
        @keyframes vantOrbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes vantFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes vantBlink {
          0%, 100% { opacity: 0.25; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.12); }
        }
        @keyframes vantAsk {
          0%, 100% { transform: translateX(0); }
          30% { transform: translateX(-2px); }
          70% { transform: translateX(2px); }
        }
      `}</style>
      <div
        aria-label={`VantDomus ${palette.label}`}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: `1px solid ${palette.main}`,
          background: `radial-gradient(circle at 35% 25%, ${palette.soft}, transparent 38%), rgba(2,6,23,0.72)`,
          display: "grid",
          placeItems: "center",
          boxShadow: `0 18px 45px ${palette.soft}`,
          position: "relative",
          overflow: "visible",
          animation: phase === "thinking" ? "vantFloat 1.1s ease-in-out infinite" : undefined,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -8,
            borderRadius: "50%",
            border: `1px solid ${palette.main}`,
            opacity: phase === "thinking" ? 0.85 : 0.2,
            animation: phase === "thinking" ? "vantOrbit 2.2s linear infinite" : undefined,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: -17,
            borderRadius: "50%",
            border: `1px solid ${palette.soft}`,
            opacity: phase === "thinking" ? 0.75 : 0.18,
            animation: phase === "thinking" ? "vantOrbit 6s linear reverse infinite" : undefined,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 14,
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,0.24)",
            background: "linear-gradient(145deg, #f59e0b, #e11d48 62%, #111827)",
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
          }}
        >
          <div style={{ fontSize: Math.round(size * 0.46), fontWeight: 900, color: "#fff", letterSpacing: 0, zIndex: 1 }}>V</div>
          <div
            style={{
              position: "absolute",
              width: "78%",
              height: 3,
              borderRadius: 999,
              background: palette.main,
              opacity: phase === "thinking" ? 0.92 : 0,
              animation: phase === "thinking" ? `${palette.motion} 1.15s linear infinite` : undefined,
              boxShadow: `0 0 18px ${palette.main}`,
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            right: -8,
            top: 16,
            display: "flex",
            gap: 4,
            opacity: phase === "thinking" ? 1 : 0,
          }}
        >
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: "#38bdf8",
                animation: `vantBlink 0.9s ease-in-out ${dot * 0.15}s infinite`,
              }}
            />
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            right: 6,
            bottom: 6,
            width: 13,
            height: 13,
            borderRadius: 999,
            background: palette.main,
            boxShadow: `0 0 18px ${palette.main}`,
          }}
        />
      </div>
      <div
        className="small"
        style={{
          color: palette.main,
          fontWeight: "bold",
          border: `1px solid ${palette.main}`,
          borderRadius: 999,
          padding: "5px 10px",
          background: palette.soft,
        }}
      >
        {palette.label}
      </div>
      {!compact && <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5, width: Math.max(160, size * 2.15), marginTop: 2 }}>
        {[
          ["listening", "Pregunta"],
          ["thinking", "Analiza"],
          ["responding", "Dictamina"],
        ].map(([key, label]) => {
          const active = phase === key;
          return (
            <div
              key={key}
              className="small"
              style={{
                border: `1px solid ${active ? palette.main : "rgba(255,255,255,0.12)"}`,
                color: active ? palette.main : "var(--muted)",
                borderRadius: 6,
                padding: "4px 6px",
                textAlign: "center",
                background: active ? palette.soft : "rgba(255,255,255,0.025)",
                fontWeight: active ? "bold" : "normal",
              }}
            >
              {label}
            </div>
          );
        })}
      </div>}
    </div>
  );
}

function VantMiniMark({ phase }: { phase: VantPhase }) {
  const color = phase === "thinking" ? "#38bdf8" : phase === "responding" ? "#22c55e" : "#f59e0b";
  return (
    <span
      aria-hidden="true"
      style={{
        width: 20,
        height: 20,
        borderRadius: 6,
        display: "inline-grid",
        placeItems: "center",
        color: "#fff",
        fontSize: 12,
        fontWeight: 900,
        background: "linear-gradient(145deg, #f59e0b, #e11d48 60%, #111827)",
        border: `1px solid ${color}`,
        boxShadow: `0 0 14px ${color}55`,
      }}
    >
      V
    </span>
  );
}

export default function CeoCopilot({ hid, state, tax, compact = false }: { hid: string; state: any; tax: any; compact?: boolean }) {
  const clientName = tax?.client_name || "Cliente";
  const domainLabel = tax?.domain_label || "Planificador de Unidades";
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: buildOpeningBrief(state, tax),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [forensicFile, setForensicFile] = useState<File | null>(null);
  const [forensicPurpose, setForensicPurpose] = useState("Analisis forense para licitacion, claims y respaldo contractual");
  const [contractFiles, setContractFiles] = useState<File[]>([]);
  const [contractPurpose, setContractPurpose] = useState("Revision de terminos comerciales, contrato, BBTT, oferta, ECO/APU, gastos generales y obras extraordinarias");
  const [contractResult, setContractResult] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const executiveContext = useMemo(() => buildExecutiveContext(state, tax), [state, tax]);
  const globalOsi = Number(state?.global_osi || 0);
  const assistantMood = globalOsi >= 80 ? "Operacion estable" : globalOsi >= 60 ? "Atencion preventiva" : "Riesgo ejecutivo";
  const visualPhase: VantPhase = loading ? "thinking" : messages[messages.length - 1]?.role === "user" ? "listening" : "responding";
  const visibleMessages = compact && messages.length > 1 ? messages.slice(-2) : messages;
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
  const operationalSuggestions = [
    "Donde subo documentos importantes?",
    "Necesito revisar una licitacion",
    "Dame un ejemplo de informe forense",
    "Donde veo el sobre gasto?",
    "Que debo corregir hoy?",
  ];

  async function ask(text: string) {
    const question = text.trim();
    if (!question || loading) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setInput("");
    if (inputRef.current) inputRef.current.value = "";
    setLoading(true);

    try {
      const directAnswer = answerKnownQuestion(normalizeText(question), state, state?.pnl || {}, tax);
      if (directAnswer) {
        setMessages((prev) => [...prev, { role: "assistant", content: directAnswer }]);
        return;
      }
      if (!hid) throw new Error("No hay una unidad activa para consultar.");
      const payload = [
        {
          role: "system" as const,
          content:
            `Eres Copilot VantDomus para ${clientName}, bajo el dominio ${domainLabel}. Responde como asesor operativo ejecutivo. Si el usuario pregunta donde ver un dato, indica la seccion exacta del dashboard y el modulo que debe abrir. Usa solo el contexto del tablero y recomienda validar documentos fuente cuando hables de claims, licitaciones o costos. Se concreto, accionable y orientado a decision.`,
        },
        { role: "system" as const, content: executiveContext },
        ...nextMessages.map((m) => ({ role: m.role, content: m.content })),
      ];
      const resp = await assistantChat(hid, payload, 0.2);
      setMessages((prev) => [...prev, { role: "assistant", content: resp.reply || localFallback(question, state, tax) }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: localFallback(question, state, tax) }]);
    } finally {
      setLoading(false);
    }
  }

  async function analyzeDocument() {
    if (!forensicFile || !hid || loading) return;
    setLoading(true);
    const question = `Analizar documento forense: ${forensicFile.name}`;
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    try {
      const formData = new FormData();
      formData.set("purpose", forensicPurpose);
      formData.set("file", forensicFile);
      const resp = await analyzeForensicDocument(hid, formData);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: resp.report || "Documento recibido y registrado como evidencia, pero no se pudo generar informe automatico.",
        },
      ]);
      setForensicFile(null);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "No pude analizar el documento. Verifica que sea PDF, TXT, DOCX, XLSX, PPTX o imagen, que no supere el limite permitido y que tu sesion tenga permisos sobre la unidad activa.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function analyzeContractPackage() {
    if (!contractFiles.length || !hid || loading) return;
    setLoading(true);
    setContractResult(null);
    setMessages((prev) => [...prev, { role: "user", content: `Analizar paquete contractual: ${contractFiles.length} documentos` }]);
    try {
      const formData = new FormData();
      formData.set("client_name", clientName);
      formData.set("purpose", contractPurpose);
      contractFiles.forEach((file) => formData.append("files", file));
      const resp = await analyzeContractualPackage(hid, formData);
      setContractResult(resp);
      setMessages((prev) => [...prev, { role: "assistant", content: formatContractualAnalysis(resp) }]);
      setContractFiles([]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "No pude ejecutar el motor contractual. Revisa que los archivos sean PDF, DOCX, XLSX, PPTX, TXT, CSV o imagen, y que la unidad activa tenga permisos. Si algun documento es escaneado, confirma que OCR/Tesseract este disponible.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="card print-hidden"
      style={{
        marginBottom: compact ? 18 : 24,
        border: "1px solid rgba(245, 158, 11, 0.48)",
        background: "linear-gradient(135deg, rgba(7,12,26,0.96), rgba(43,12,22,0.82))",
        boxShadow: "0 22px 60px rgba(0,0,0,0.28)",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: compact ? "150px minmax(0, 1fr)" : "260px minmax(0, 1fr)", gap: compact ? 12 : 18, alignItems: "stretch" }}>
        <aside
          style={{
            border: "1px solid rgba(245,158,11,0.38)",
            borderRadius: 8,
            padding: compact ? 12 : 16,
            background: "linear-gradient(180deg, rgba(245,158,11,0.14), rgba(255,255,255,0.025))",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: compact ? 210 : 360,
          }}
        >
          <div>
            <VantDomusFigure phase={visualPhase} size={compact ? 58 : 96} compact={compact} />
            <div className="cardTitle" style={{ color: "#fbbf24", fontWeight: "bold", fontSize: compact ? 15 : 18, marginTop: compact ? 10 : 0 }}>VantIA</div>
            <div className="small" style={{ marginTop: 4, color: "var(--muted)" }}>{clientName}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: loading ? "#f59e0b" : "#22c55e", boxShadow: `0 0 16px ${loading ? "#f59e0b" : "#22c55e"}` }} />
              <span className="small" style={{ fontWeight: "bold", color: loading ? "#fbbf24" : "#86efac" }}>
                {loading ? "Analizando" : "Disponible"}
              </span>
            </div>
            <div style={{ marginTop: 14, padding: 12, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, background: "rgba(0,0,0,0.2)", display: compact ? "none" : "block" }}>
              <div className="small" style={{ color: "var(--muted)", marginBottom: 4 }}>Lectura actual</div>
              <div style={{ fontWeight: "bold", color: "#fff" }}>{assistantMood}</div>
              <div className="small" style={{ marginTop: 8, color: "var(--muted)", lineHeight: 1.45 }}>
                OSI {fmt(state?.global_osi)} · HSE {fmt(state?.global_health)} · Gasto {fmt(state?.global_finance)}
              </div>
            </div>
          </div>
          <div className="small" style={{ color: "var(--muted)", lineHeight: 1.45, display: compact ? "none" : "block" }}>
            Enfocado en decisiones, evidencia y escenarios. Recomienda acciones con trazabilidad documental.
          </div>
        </aside>

        <section>
          <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1 }}>
            <div className="cardTitle" style={{ color: "#f59e0b", fontWeight: "bold" }}>Asistencia ejecutiva</div>
              <div className="small" style={{ maxWidth: 900, lineHeight: 1.5, color: "var(--muted)", marginTop: 6, display: compact ? "none" : "block" }}>
                Haz preguntas sobre KPI, rumbo de obra, gastos, claims, licitaciones, documentacion o escenarios de correccion.
              </div>
            </div>
            <div className="pill" style={{ borderColor: "#f59e0b", color: "#fbbf24" }}>IA + evidencia</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: compact ? "minmax(0, 1fr)" : "minmax(0, 1fr) 300px", gap: 14, marginTop: 16 }}>
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: compact ? 10 : 12, background: "rgba(0,0,0,0.22)", minHeight: compact ? 220 : 278 }}>
              {compact ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {lastUserMessage && (
                    <div style={{ border: "1px solid rgba(245,158,11,0.36)", borderRadius: 8, padding: "8px 10px", background: "rgba(245,158,11,0.12)" }}>
                      <div className="small" style={{ color: "#fbbf24", fontWeight: "bold", marginBottom: 4 }}>{clientName} pregunta</div>
                      <div style={{ fontSize: 14, color: "#fff", lineHeight: 1.35 }}>{lastUserMessage.content}</div>
                    </div>
                  )}
                  <div style={{ border: "1px solid rgba(148,163,184,0.22)", borderRadius: 8, padding: "10px 12px", background: "linear-gradient(135deg, rgba(255,255,255,0.065), rgba(255,255,255,0.025))" }}>
                    <div className="small" style={{ fontWeight: "bold", color: "#93c5fd", marginBottom: 6, display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <VantMiniMark phase={loading ? "thinking" : "responding"} /> VantIA responde
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45, fontSize: 14 }}>
                      {loading ? `Analizando tablero ${clientName}...` : lastAssistantMessage?.content}
                    </div>
                  </div>
                </div>
              ) : (
              <div style={{ maxHeight: 292, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4 }}>
            {visibleMessages.map((message, idx) => (
                <div
                  key={`${message.role}-${idx}`}
                  style={{
                    alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: message.role === "user" ? "52%" : "78%",
                    border: message.role === "user" ? "1px solid rgba(245,158,11,0.42)" : "1px solid rgba(148,163,184,0.22)",
                    borderRadius: message.role === "user" ? "8px 8px 2px 8px" : "8px 8px 8px 2px",
                    padding: compact ? "8px 10px" : "10px 12px",
                    background: message.role === "user" ? "rgba(245,158,11,0.16)" : "linear-gradient(135deg, rgba(255,255,255,0.065), rgba(255,255,255,0.025))",
                    lineHeight: 1.45,
                    fontSize: compact ? 13 : 14,
                    boxShadow: message.role === "assistant" ? "0 10px 24px rgba(0,0,0,0.16)" : "none",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  <div className="small" style={{ fontWeight: "bold", color: message.role === "user" ? "#fbbf24" : "#93c5fd", marginBottom: 4 }}>
                    {message.role === "user" ? clientName : <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><VantMiniMark phase="responding" /> VantIA</span>}
                  </div>
                  {message.content}
                </div>
            ))}
                {loading && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#38bdf8", fontSize: 13, fontWeight: "bold" }}>
                    <VantMiniMark phase="thinking" />
                    Analizando evidencia y tablero {clientName}...
                  </div>
                )}
              </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(inputRef.current?.value || input);
                }}
                style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 112px", gap: 10, marginTop: 10 }}
              >
                <input
                  ref={inputRef}
                  className="input"
                  onInput={(e) => setInput(e.currentTarget.value)}
                  placeholder="Pregunta sobre KPI, gastos, claims, licitaciones o escenarios..."
                  disabled={loading}
                  style={{ width: "100%" }}
                />
                <button
                  className="button"
                  type="submit"
                  disabled={loading}
                  style={{ background: "#f59e0b", color: "#111827", fontWeight: "bold", justifyContent: "center", border: "1px solid rgba(255,255,255,0.18)", boxShadow: "none" }}
                >
                  Consultar
                </button>
              </form>

              <details style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                <summary style={{ cursor: "pointer", fontWeight: "bold", color: "#fbbf24" }}>Documentos y motor contractual</summary>
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10, alignItems: "end" }}>
                <div>
                  <div className="small" style={{ fontWeight: "bold", color: "#fbbf24", marginBottom: 6 }}>Analisis forense documental</div>
                  <input
                    className="input"
                    value={forensicPurpose}
                    onChange={(e) => setForensicPurpose(e.target.value)}
                    placeholder="Objetivo del analisis: licitacion, claim, NOC, costos..."
                    disabled={loading}
                    style={{ width: "100%", marginBottom: 8 }}
                  />
                  <input
                    className="input"
                    type="file"
                    accept=".pdf,.txt,.csv,.docx,.xlsx,.xls,.pptx,.png,.jpg,.jpeg,.tif,.tiff"
                    onChange={(e) => setForensicFile(e.target.files?.[0] || null)}
                    disabled={loading}
                    style={{ width: "100%" }}
                  />
                  <div className="small" style={{ color: "var(--muted)", marginTop: 6 }}>
                    Sube PDF, imagen, TXT, CSV, DOCX, PPTX o XLSX. El motor usa texto nativo y OCR cuando esta disponible.
                  </div>
                </div>
                <button
                  className="button"
                  type="button"
                  onClick={analyzeDocument}
                  disabled={loading || !forensicFile}
                  style={{ background: forensicFile ? "#38bdf8" : "rgba(255,255,255,0.08)", color: forensicFile ? "#082f49" : "var(--muted)", fontWeight: "bold", minWidth: 150 }}
                >
                  Analizar archivo
                </button>
              </div>

              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10, alignItems: "end" }}>
                <div>
                  <div className="small" style={{ fontWeight: "bold", color: "#fbbf24", marginBottom: 6 }}>Motor contractual/comercial</div>
                  <input
                    className="input"
                    value={contractPurpose}
                    onChange={(e) => setContractPurpose(e.target.value)}
                    placeholder="Objetivo: revision comercial, contrato, GG, obras extraordinarias..."
                    disabled={loading}
                    style={{ width: "100%", marginBottom: 8 }}
                  />
                  <input
                    className="input"
                    type="file"
                    multiple
                    accept=".pdf,.txt,.csv,.docx,.xlsx,.xls,.pptx,.png,.jpg,.jpeg,.tif,.tiff"
                    onChange={(e) => setContractFiles(Array.from(e.target.files || []))}
                    disabled={loading}
                    style={{ width: "100%" }}
                  />
                  <div className="small" style={{ color: "var(--muted)", marginTop: 6 }}>
                    Carga contrato, terminos comerciales, BBTT, oferta, ECO/APU y anexos. El resultado queda registrado en bitacora como auditoria.
                  </div>
                  {contractResult && (
                    <div style={{ marginTop: 8, padding: 10, border: "1px solid rgba(245,158,11,0.28)", borderRadius: 8, background: "rgba(245,158,11,0.08)" }}>
                      <div className="small" style={{ color: "#fbbf24", fontWeight: "bold" }}>
                        Ultimo dictamen: riesgo {contractResult.risk_score}/100 · {contractResult.findings?.length || 0} hallazgos · {contractResult.reviewed_documents?.length || 0} documentos
                      </div>
                    </div>
                  )}
                </div>
                <button
                  className="button"
                  type="button"
                  onClick={analyzeContractPackage}
                  disabled={loading || !contractFiles.length}
                  style={{ background: contractFiles.length ? "#f59e0b" : "rgba(255,255,255,0.08)", color: contractFiles.length ? "#111827" : "var(--muted)", fontWeight: "bold", minWidth: 168 }}
                >
                  Analizar paquete
                </button>
              </div>
              </details>
            </div>

            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, background: "rgba(255,255,255,0.025)", display: compact ? "none" : "block" }}>
              <div className="small" style={{ fontWeight: "bold", color: "var(--muted)", marginBottom: 10 }}>Preguntas rapidas</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {operationalSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="button"
                    onClick={() => ask(suggestion)}
                    disabled={loading}
                    style={{ textAlign: "left", justifyContent: "flex-start", background: "rgba(255,255,255,0.04)", border: "1px solid var(--line)" }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <div className="small" style={{ marginTop: 12, lineHeight: 1.45, color: "var(--muted)" }}>
                El Copilot combina la lectura del tablero con trazabilidad documental para apoyar decisiones, no reemplaza la validacion contractual.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
