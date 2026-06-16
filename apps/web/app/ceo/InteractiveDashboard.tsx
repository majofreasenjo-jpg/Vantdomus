"use client";

import React, { useState, useEffect } from "react";
import IndustryTree from "./IndustryTree";
import { listLogbookEntries, createLogbookEntry, createLogbookShareLink, revokeLogbookShareLink } from "@/lib/api";
import { KPIDonut } from "./KPICharts";
import RiskRadar from "./RiskRadar";
import CeoCopilot from "./CeoCopilot";
import PresetReports from "./PresetReports";

function formatNumberStable(value: number, decimals = 0) {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe < 0 ? "-" : "";
  const fixed = Math.abs(safe).toFixed(decimals);
  const [whole, fraction] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${grouped}${fraction ? `,${fraction}` : ""}`;
}

export default function InteractiveDashboard({ initialState, tax, isEPC, hid }: { initialState: any, tax: any, isEPC: boolean, hid: string }) {
  const [mode, setMode] = useState<"real"|"simulation">("real");
  const [state, setState] = useState(initialState);
  
  // Logbook State
  const [logs, setLogs] = useState<any[]>([]);
  const [entryType, setEntryType] = useState("comentario");
  const [entryContent, setEntryContent] = useState("");
  // New Logbook fields
  const [eventDate, setEventDate] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [shareLinks, setShareLinks] = useState<Record<string, any>>({});
  const [shareLoadingId, setShareLoadingId] = useState<string | null>(null);
  const [shareRevokingId, setShareRevokingId] = useState<string | null>(null);
  
  const [logLoading, setLogLoading] = useState(false);
  const [logWarning, setLogWarning] = useState<string | null>(null);

  // Simulation controls
  const [simOsi, setSimOsi] = useState<number>(initialState?.global_osi || 0);
  const [simHealth, setSimHealth] = useState<number>(initialState?.global_health || 0);
  const [simTask, setSimTask] = useState<number>(initialState?.global_task || 0);
  const [simFinance, setSimFinance] = useState<number>(initialState?.global_finance || 0);

  const defaultHid = hid || (initialState?.gerencias?.[0]?.departments?.[0]?.id || "");

  useEffect(() => {
    if (defaultHid) {
      loadLogs(defaultHid);
    }
  }, [defaultHid]);

  const loadLogs = async (useHid: string) => {
    try {
      setLogWarning(null);
      const resp = await listLogbookEntries(useHid);
      if (resp && resp.items) setLogs(resp.items);
    } catch (e) {
      setLogs([]);
      const message = e instanceof Error ? e.message : "";
      if (message.includes("401") || message.includes("403")) {
        setLogWarning("Bitacora no disponible para esta sesion. Ingresa nuevamente para ver y registrar evidencia.");
      } else {
        setLogWarning("No se pudo cargar la bitacora en este momento.");
      }
    }
  };

  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryContent.trim() || !defaultHid) return;
    setLogLoading(true);
    try {
      const formData = new FormData();
      formData.append("entry_type", entryType);
      formData.append("content", entryContent);
      if (eventDate) {
        // Enviar al formato UTC o ISO si es necesario, o dejar que el servidor reciba la cadena datetime-local
        // datetime-local is "YYYY-MM-DDTHH:mm"
        formData.append("event_date", new Date(eventDate).toISOString());
      }
      if (attachment) {
        formData.append("file", attachment);
      }

      await createLogbookEntry(defaultHid, formData);
      setEntryContent("");
      setEventDate("");
      setAttachment(null);
      await loadLogs(defaultHid);
    } catch (e) {
      console.error(e);
    } finally {
      setLogLoading(false);
    }
  };

  const handleCreateShareLink = async (entryId: string) => {
    setShareLoadingId(entryId);
    try {
      const resp = await createLogbookShareLink(entryId, 900);
      setShareLinks(prev => ({ ...prev, [entryId]: { ...resp, revoked: false } }));
    } catch (e) {
      console.error(e);
      alert("No se pudo crear el link firmado. Verifica que tu usuario tenga rol admin.");
    } finally {
      setShareLoadingId(null);
    }
  };

  const handleRevokeShareLink = async (entryId: string) => {
    const share = shareLinks[entryId];
    if (!share?.url) return;
    const token = String(share.url).split("/").pop() || "";
    setShareRevokingId(entryId);
    try {
      const resp = await revokeLogbookShareLink(token);
      setShareLinks(prev => ({ ...prev, [entryId]: { ...share, ...resp, revoked: true } }));
    } catch (e) {
      console.error(e);
      alert("No se pudo revocar el link firmado.");
    } finally {
      setShareRevokingId(null);
    }
  };

  // Simulation Re-calculation Logic
  useEffect(() => {
    if (mode === "real") {
      setState(initialState);
      return;
    }
    
    // -------------------------------------------------------------
    // CLIENT SIDE P&L SIMULATOR
    // Replicates the backend ceo.py math dynamically
    // -------------------------------------------------------------
    const baseRevenue = initialState.pnl?.revenue ? (initialState.pnl.revenue / (initialState.global_osi / 100)) : 1000;
    const realizedRev = baseRevenue * (simOsi / 100);
    const scale = baseRevenue / 1000;
    const varCogsBase = 350 * scale;
    const fixCogsBase = 100 * scale;
    
    const eiiPenalty = 1.0 + (100.0 - simOsi) * 0.005;
    const varCogs = varCogsBase * (simOsi / 100);
    const fixCogs = fixCogsBase * (2.0 - (simFinance / 100)) * eiiPenalty;
    const cogs = varCogs + fixCogs;
    
    const sgaBase = 150 * scale;
    const delayPenalty = 1.0 + (100.0 - simTask) * 0.015;
    const sga = sgaBase * delayPenalty;
    
    const grossMargin = realizedRev - cogs;
    const ebitda = grossMargin - sga;
    const ebitdaMargin = realizedRev > 0 ? (ebitda / realizedRev) * 100 : 0;
    
    const fineBase = 50 * scale;
    const fineMultiplier = 1.0 + ((100.0 - simHealth) / 10.0) ** 2;
    const finesDa = fineBase * fineMultiplier;
    
    const ebit = ebitda - finesDa;
    const taxes = ebitda > 0 ? ebitda * 0.27 : 0;
    const netIncome = ebit - taxes;

    // Build synthetic simulated state
    const simState = {
      ...initialState,
      global_osi: simOsi,
      global_health: simHealth,
      global_task: simTask,
      global_finance: simFinance,
      ebitda_margin: Number(ebitdaMargin.toFixed(1)),
      pnl: {
        revenue: Number(realizedRev.toFixed(1)),
        cogs: Number(cogs.toFixed(1)),
        gross_margin: Number(grossMargin.toFixed(1)),
        sga: Number(sga.toFixed(1)),
        ebitda: Number(ebitda.toFixed(1)),
        ebitda_margin: Number(ebitdaMargin.toFixed(1)),
        fines_da: Number(finesDa.toFixed(1)),
        ebit: Number(ebit.toFixed(1)),
        taxes: Number(taxes.toFixed(1)),
        net_income: Number(netIncome.toFixed(1)),
      }
    };
    
    setState(simState);
  }, [mode, simOsi, simHealth, simTask, simFinance, initialState]);

  const macroStyle = { color: tax.theme?.primary || "#10b981", cls: "pill", label: "Estable" };

  // --- Motor predictivo de riesgo multidimensional ---
  const operabilityGap = 100 - ((state.global_health + state.global_task) / 2);
  const rawRisk = (operabilityGap / 100) * 1.5 * 100;
  const contextPenalty = (100 - state.global_finance) * 0.2 + (100 - state.global_osi) * 0.3;
  const collapseRisk = Math.min(100, Math.max(0, rawRisk + contextPenalty));
  const mttfMonths = Math.max(0, 120 * (1 - (collapseRisk / 100)));
  const isCritical = collapseRisk > 65;
  const departments = (state.gerencias || []).flatMap((g: any) => g.departments || []);
  const isPuma = tax.client_name === "PUMA" || tax.digital_badge === "PUMA Ops";
  const isFamily = Boolean(tax.family_mode);
  const moneyUnit = isFamily ? "CLP" : "M$";
  const moneyDecimals = isFamily ? 0 : 1;
  const moneyValue = (value: number) => isFamily ? value / 1000 : value;
  const moneyText = (value: number) => `${isFamily ? "$" : "M$"} ${formatNumberStable(moneyValue(Number(value || 0)), moneyDecimals)}`;
  const negativeMoneyText = (value: number) => `-${moneyText(value)}`;
  const clientName = tax.client_name || (isPuma ? "PUMA" : "Cliente");
  const domainLabel = tax.domain_label || "Planificador de Unidades";
  const digitalTitle = tax.digital_title || "VANTDOMUS: PLANIFICADOR DE UNIDADES";
  const digitalDescription = tax.digital_description || "Capa ejecutiva para medir unidades, responsables, avance, costos, documentacion y escenarios del cliente activo.";
  const simulationLabel = tax.simulation_label || "SIMULACION OPERATIVA";
  const financialTitle = tax.financial_title || "MARGEN OPERATIVO CONSOLIDADO";
  const financialExplanation = tax.financial_explanation || "Metrica ejecutiva que cruza continuidad, cumplimiento operativo, costos y eventos documentados. Sirve para entender que unidades empujan o deterioran el resultado proyectado.";
  const performanceTreeLabel = tax.performance_tree_label || "Mapa de rendimiento de unidades";
  const analyticsTitle = tax.analytics_title || "Proyeccion operativa y financiera";
  const riskTitle = tax.risk_title || "MOTOR PREDICTIVO DE RIESGO";
  const riskProbabilityLabel = tax.risk_probability_label || "Probabilidad de desviacion critica";
  const riskTimeLabel = tax.risk_time_label || "Ventana estimada para corregir rumbo";
  const criticalMessage = tax.critical_message || "A este ritmo, la desviacion operacional y financiera puede comprometer la continuidad del plan si no se corrige con evidencia y responsables.";
  const driverSectionTitle = tax.driver_section_title || "Drivers causales del resultado";
  const unitMapTitle = tax.unit_map_title || "Mapa estrategico de unidades";
  const logbookTitle = tax.logbook_title || "Bitacora Operativa de Proyecto";
  const logbookEmpty = tax.logbook_empty || "No hay eventos en la bitacora aun. Crea el primero.";
  const logbookPlaceholder = tax.logbook_placeholder || "Registra un evento, cambio contractual o novedad...";
  const logbookDateLabel = tax.logbook_date_label || "Fecha Ocurrencia:";
  const logbookAttachmentLabel = tax.logbook_attachment_label || "Respaldo:";
  const logbookSubmitLabel = tax.logbook_submit_label || "Publicar Evento";
  const driverDescriptions = {
    osi: tax.driver_descriptions?.osi || `Indica continuidad y cumplimiento global del plan de unidades para ${clientName}.`,
    health: tax.driver_descriptions?.health || `Penalizador por seguridad, calidad, incidentes o interrupciones asociadas a ${tax.unit}s.`,
    tasks: tax.driver_descriptions?.tasks || "Penalizador por atrasos, pendientes, hitos vencidos y baja trazabilidad de responsables.",
    finance: tax.driver_descriptions?.finance || "Multiplicador de margen: presupuesto, gasto, recuperabilidad y evidencia financiera.",
  };
  const pnlLabels = {
    revenue: isEPC ? "Facturacion por Avance (PDP)" : (tax.pnl_labels?.revenue || "Ingresos / valor operacional"),
    cogs: isEPC ? "(-) Costo Directo Obras Civiles y Mano de Obra" : (tax.pnl_labels?.cogs || "(-) Costos directos del servicio"),
    gross: isEPC ? "Margen Bruto (Contractual Proyecto)" : (tax.pnl_labels?.gross || "Margen bruto operacional"),
    sga: isEPC ? "(-) Gastos Generales (GG) y Retrasos HH" : (tax.pnl_labels?.sga || "(-) Gastos, desviaciones y mitigaciones"),
    ebitda: isEPC ? "EBITDA (Margen del Contratista)" : (tax.pnl_labels?.ebitda || "EBITDA / margen operativo"),
    fines: tax.pnl_labels?.fines || "(-) Contingencias, seguros, multas y depreciacion",
    ebit: tax.pnl_labels?.ebit || "EBIT (Resultado Operacional)",
    taxes: tax.pnl_labels?.taxes || "(-) Impuestos a la Renta Corporativa (27%)",
    net: tax.pnl_labels?.net || "RESULTADO PROYECTADO",
  };
  const pumaExecutiveCockpit = [
    { title: "Planificador de Unidades", metric: "En Obra -> Promesa -> Entregado", status: "Control vivo", description: "Inventario tecnico de unidades maestras para corregir rumbo de obra, alcance y avance sin planillas offline.", module: "dashboard", unit_match: "Estacion", action_label: "Abrir planificador", color: "#f59e0b" },
    { title: "Claims Forense NOC23/NOC24", metric: "Telemetria + timeline + probabilidad", status: "Cero alucinacion", description: "Data Intelligence para improductividad, cambios de alcance, duplicidad de adicionales y controversias con evidencia trazable.", module: "settings_audit", unit_match: "Auditoria Surtidores", action_label: "Ver evidencia claim", color: "#38bdf8" },
    { title: "Direccion de Obra", metric: "SLA, HH, productividad y ruta critica", status: "Corregir rumbo", description: "Vista ejecutiva para decidir reasignacion de cuadrillas, prioridades de campo y mitigacion de atrasos.", module: "tasks", unit_match: "Despacho Camiones Cisterna", action_label: "Gestionar direccion", color: "#e11d48" },
    { title: "Gasto y Licitaciones", metric: "Oferta, APU, GG, HH y maquinaria", status: "Control contractual", description: "Lectura de costos y documentos de licitacion: contrato, oferta economica, precios unitarios, movilizacion y gastos generales.", module: "finance", unit_match: "Cartera Empresas Norte", action_label: "Revisar gastos", color: "#22c55e" },
    { title: "Repositorio Documental", metric: "Matriz de evidencia + memoria de calculo", status: "Audit ready", description: "Custodia documentacion, respaldo de claims, presentaciones ejecutivas, cartas NOC y documentos de licitacion.", module: "settings_audit", unit_match: "Auditoria Surtidores", action_label: "Abrir documentacion", color: "#a78bfa" },
  ];
  const genericExecutiveCockpit = [
    { title: "Planificador de Unidades", metric: "Estado, avance y responsable", status: "Control vivo", description: "Vista de unidades maestras para ordenar alcance, prioridades, responsables y compromisos sin depender de planillas aisladas.", module: "dashboard", action_label: "Abrir planificador", color: "#f59e0b" },
    { title: "Costos y Presupuesto", metric: "Gasto, desviacion y margen", status: "Control financiero", description: "Cruce entre presupuesto, gasto real, recuperabilidad y evidencia para decidir ajustes de direccion.", module: "finance", action_label: "Revisar costos", color: "#22c55e" },
    { title: "Documentos y Evidencia", metric: "Repositorio, OCR y trazabilidad", status: "Audit ready", description: "Carga de contratos, respaldos, actas, licitaciones o evidencia operativa con lectura documental y soporte forense.", module: "settings_audit", action_label: "Abrir evidencia", color: "#a78bfa" },
    { title: "Escenarios What-if", metric: "Impacto antes/despues", status: "Simular", description: "Proyecta impactos en continuidad, costo, riesgo y resultado antes de ejecutar una decision.", module: "ceo", action_label: "Simular escenario", color: "#38bdf8" },
  ];
  const executiveCockpit = tax.executive_cockpit || (isPuma ? pumaExecutiveCockpit : genericExecutiveCockpit);
  const resolveOperationalHref = (item: any) => {
    const match = String(item.unit_match || item.label || "").toLowerCase();
    const dept = departments.find((d: any) =>
      String(d.name || "").toLowerCase().includes(match) ||
      match.includes(String(d.name || "").toLowerCase())
    ) || departments.find((d: any) => d.meta?.industry_preset === (isFamily ? "family" : "puma")) || departments[0];
    const targetHid = dept?.id || defaultHid;
    const module = item.module || "dashboard";
    if (!targetHid) return "/ceo";
    if (module === "ceo") return "/ceo";
    if (module === "settings_audit") return `/settings/${targetHid}/audit`;
    return `/${module}/${targetHid}`;
  };
  const gerencias = state.gerencias || [];
  const weakestGerencia = [...gerencias].sort((a: any, b: any) => Number(a?.macro_osi || 100) - Number(b?.macro_osi || 100))[0];
  const weakestUnit = [...departments].sort((a: any, b: any) => Number(a?.hsi || 100) - Number(b?.hsi || 100))[0];
  const netIncome = Number(state.pnl?.net_income || 0);
  const ebitdaMargin = Number(state.ebitda_margin ?? state.pnl?.ebitda_margin ?? 0);
  const executiveState = isFamily
    ? state.global_osi < 65 ? "Sobrecarga familiar" : collapseRisk > 60 ? "Cuidado preventivo" : "Hogar coordinado"
    : netIncome < 0 || state.global_osi < 65 ? "Atencion ejecutiva" : collapseRisk > 60 ? "Riesgo controlado" : "Operacion estable";
  const executiveDecision = isFamily
    ? state.global_osi < 65
      ? "Ordenar rutinas, vencimientos y responsabilidades antes de sumar nuevos compromisos."
      : "Mantener calendario, presupuesto y cuidado preventivo visibles para toda la familia."
    : netIncome < 0
      ? "Congelar gasto no trazable y revisar recuperabilidad contractual."
      : state.global_osi < 65
        ? "Corregir continuidad en la unidad critica antes de asumir nuevos compromisos."
        : "Mantener control y preparar siguiente escenario.";
  const executiveCards = [
    { label: "Estado", value: executiveState, hint: `${state.global_osi}% continuidad`, color: tax.theme?.primary || "var(--primary)" },
    { label: isFamily ? "Saldo" : "Resultado", value: moneyText(netIncome), hint: isFamily ? "capacidad familiar proyectada" : `${ebitdaMargin.toFixed(1)}% margen EBITDA`, color: netIncome >= 0 ? "var(--good)" : "var(--bad)" },
    { label: "Foco", value: weakestGerencia?.name || weakestUnit?.name || "Sin foco critico", hint: weakestUnit ? `Unidad: ${weakestUnit.name}` : "Sin unidad critica", color: "#f59e0b" },
  ];

  return (
    <>
      <section className="card print-hidden" style={{ marginTop: 20, marginBottom: 18, border: `1px solid ${tax.theme?.primary || "var(--primary)"}`, background: "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(20,7,12,0.9))", padding: 20, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1.2fr) minmax(360px, 1.8fr)", gap: 16, alignItems: "stretch" }}>
          <div style={{ borderRadius: 8, padding: 16, background: "rgba(2,6,23,0.42)", border: "1px solid rgba(148,163,184,0.18)" }}>
            <div className="cardTitle" style={{ color: tax.theme?.primary || "var(--primary)", fontWeight: "bold", marginBottom: 8 }}>Vista CEO</div>
            <div style={{ fontSize: 24, lineHeight: 1.12, fontWeight: 900, color: "#fff", letterSpacing: 0 }}>{clientName}: decision inmediata</div>
            <div className="small" style={{ lineHeight: 1.55, marginTop: 10, color: "var(--muted)" }}>
              {executiveDecision}
            </div>
            <div className="row" style={{ justifyContent: "flex-start", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <a className="button" href="#vantia-copilot" style={{ textDecoration: "none", border: "1px solid rgba(245,158,11,0.65)", color: "#fbbf24", background: "rgba(245,158,11,0.08)", minWidth: 118, justifyContent: "center" }}>Decision IA</a>
              <a className="button" href="#informes-ceo" style={{ textDecoration: "none", border: "1px solid rgba(56,189,248,0.62)", color: "#7dd3fc", background: "rgba(56,189,248,0.08)", minWidth: 118, justifyContent: "center" }}>Informe</a>
              <a className="button" href="#detalle-tecnico" style={{ textDecoration: "none", border: `1px solid ${tax.theme?.primary || "var(--primary)"}`, color: tax.theme?.primary || "var(--primary)", background: "rgba(255,255,255,0.035)", minWidth: 118, justifyContent: "center" }}>Detalle</a>
            </div>
          </div>

        <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          {executiveCards.map((item) => (
            <div key={item.label} style={{ border: "1px solid rgba(148,163,184,0.24)", borderRadius: 8, padding: 14, background: "rgba(255,255,255,0.035)", minHeight: 118, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div className="small" style={{ color: "var(--muted)", fontWeight: "bold" }}>{item.label}</div>
              <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: item.color, lineHeight: 1.12, overflowWrap: "anywhere" }}>{item.value}</div>
              <div className="small" style={{ marginTop: 8, color: "var(--muted)" }}>{item.hint}</div>
            </div>
          ))}
        </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button className="button" style={{ background: mode === "simulation" ? "transparent" : "#1f3a52", border: mode === "simulation" ? "1px solid #f39c12" : "1px solid rgba(148,163,184,0.22)", color: mode === "simulation" ? "#f39c12" : "#fff", minWidth: 150, justifyContent: "center" }} onClick={() => setMode(mode === "real" ? "simulation" : "real")}>
            {mode === "real" ? "Simular escenario" : "Lectura real"}
          </button>
        </div>
      </section>

      {/* TOGGLE MODO SIMULADOR */}
      <div className="print-hidden" style={{ display: "none", padding: "12px 16px", background: mode==="simulation" ? "rgba(243, 156, 18, 0.15)" : "transparent", border: mode==="simulation" ? "1px solid #f39c12" : "1px solid var(--line)", borderRadius: 8, marginTop: 24, marginBottom: 16, justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: "bold", color: mode==="simulation" ? "#f39c12" : "var(--muted)" }}>
            {mode === "simulation" ? "🧪 MODO SIMULADOR WHAT-IF ACTIVADO" : "Lectura de Modelos Base"}
          </div>
          <div className="small">{mode === "simulation" ? "Ajusta las palancas dinámicas abajo para proyectar recálculos instantáneos en el EBITDA." : "El comando recibe lectura directa de la base de datos oficial del contrato."}</div>
        </div>
        <button className="button" style={{ background: mode === "simulation" ? "transparent" : "#1f3a52", border: mode === "simulation" ? "1px solid #f39c12" : "none", color: mode === "simulation" ? "#f39c12" : "#fff" }} onClick={() => setMode(mode === "real" ? "simulation" : "real")}>
          {mode === "real" ? "Simular Escenarios" : "Regresar a Lectura Base"}
        </button>
      </div>

      {mode === "simulation" && (
        <div className="grid print-hidden" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 24, padding: "16px", background: "rgba(0,0,0,0.3)", borderRadius: 8, border: "1px dashed rgba(243, 156, 18, 0.4)" }}>
           <div>
             <div className="small" style={{ fontWeight: "bold", marginBottom: 8, color: "var(--primary)" }}>{tax.kpi.osi} ({simOsi}%)</div>
             <input type="range" min="0" max="100" step="1" value={simOsi} onChange={e=>setSimOsi(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--primary)" }} />
           </div>
           <div>
             <div className="small" style={{ fontWeight: "bold", marginBottom: 8, color: "var(--warn)" }}>{tax.kpi.health} ({simHealth}%)</div>
             <input type="range" min="0" max="100" step="1" value={simHealth} onChange={e=>setSimHealth(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--warn)" }} />
           </div>
           <div>
             <div className="small" style={{ fontWeight: "bold", marginBottom: 8, color: "var(--bad)" }}>{tax.kpi.tasks} ({simTask}%)</div>
             <input type="range" min="0" max="100" step="1" value={simTask} onChange={e=>setSimTask(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--bad)" }} />
           </div>
           <div>
             <div className="small" style={{ fontWeight: "bold", marginBottom: 8, color: "var(--good)" }}>{tax.kpi.finance} ({simFinance}%)</div>
             <input type="range" min="0" max="100" step="1" value={simFinance} onChange={e=>setSimFinance(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--good)" }} />
           </div>
        </div>
      )}

      <details id="informes-ceo" className="card print-hidden" style={{ marginBottom: 18, border: "1px solid rgba(56,189,248,0.35)", background: "rgba(2,6,23,0.55)" }}>
        <summary style={{ cursor: "pointer", fontWeight: 900, fontSize: 18 }}>Informes preestablecidos</summary>
        <div style={{ marginTop: 14 }}>
          <PresetReports state={state} tax={tax} collapseRisk={collapseRisk} defaultHid={defaultHid} />
        </div>
      </details>

      <div id="vantia-copilot">
        <CeoCopilot hid={defaultHid} state={state} tax={tax} compact />
      </div>

      <details id="detalle-tecnico" className="card" style={{ marginBottom: 18, border: "1px solid rgba(148,163,184,0.24)", background: "rgba(255,255,255,0.025)" }}>
        <summary style={{ cursor: "pointer", fontWeight: 900, fontSize: 18 }}>Detalle tecnico, operativo y financiero</summary>
        <div style={{ marginTop: 16 }}>
      {executiveCockpit.length > 0 && (
        <div className="grid" style={{ gridTemplateColumns: "repeat(12, 1fr)", gap: 12, marginBottom: 24 }}>
          <div className="card" style={{ gridColumn: "span 4", border: `1px solid ${tax.theme?.primary || "var(--primary)"}`, background: "rgba(0,0,0,0.22)" }}>
            <div className="cardTitle" style={{ color: tax.theme?.primary || "var(--primary)", fontWeight: "bold" }}>KPI GLOBAL DE DIRECCION</div>
            <div className="row" style={{ alignItems: "flex-end", marginTop: 10 }}>
              <div>
                <div className="big" style={{ fontSize: 42 }}>{state.global_osi}%</div>
                <div className="small">Continuidad / OSI</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="big" style={{ fontSize: 30, color: (state.pnl?.net_income ?? 0) >= 0 ? "var(--good)" : "var(--bad)" }}>
                  {moneyText(state.pnl?.net_income || 0)}
                </div>
                <div className="small">Resultado proyectado</div>
              </div>
            </div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 14 }}>
              <div className="pill">HSE {state.global_health}%</div>
              <div className="pill">SLA {state.global_task}%</div>
              <div className="pill">Gasto {state.global_finance}%</div>
            </div>
          </div>

          {executiveCockpit.map((item: any) => (
            <a key={item.title} href={resolveOperationalHref(item)} className="card" style={{ gridColumn: "span 4", textDecoration: "none", color: "var(--text)", border: "1px solid var(--line)", background: "rgba(255,255,255,0.025)", minHeight: 170 }}>
              <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
                <div>
                  <div className="cardTitle" style={{ color: item.color || tax.theme?.primary || "var(--primary)", fontWeight: "bold" }}>{item.title}</div>
                  <div style={{ fontWeight: "bold", fontSize: 18, marginTop: 6 }}>{item.metric}</div>
                  <div className="small" style={{ marginTop: 8, lineHeight: 1.45, color: "var(--muted)" }}>{item.description}</div>
                </div>
                <div className="pill" style={{ borderColor: item.color || "var(--line)", color: item.color || "var(--text)" }}>{item.status}</div>
              </div>
              <div className="small" style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--line)", color: item.color || tax.theme?.primary || "var(--primary)", fontWeight: "bold" }}>
                {item.action_label} →
              </div>
            </a>
          ))}
        </div>
      )}

      {tax.digital_kpis?.length > 0 && (
        <div className="card" style={{ marginBottom: 24, border: `1px solid ${tax.theme?.primary || "var(--line)"}`, background: "linear-gradient(135deg, rgba(217, 119, 6, 0.12), rgba(2, 6, 23, 0.72))" }}>
          <div className="row" style={{ gap: 16, alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div className="cardTitle" style={{ color: tax.theme?.primary || "var(--primary)", fontWeight: "bold" }}>{digitalTitle}</div>
              <div className="small" style={{ maxWidth: 760, lineHeight: 1.6, opacity: 0.84 }}>
                {digitalDescription}
              </div>
            </div>
            <div className="pill" style={{ borderColor: tax.theme?.primary || "var(--line)", color: tax.theme?.primary || "var(--primary)" }}>
              {tax.digital_badge || "Operacion Digital"}
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
            {tax.digital_kpis.map((item: any) => (
              <a key={item.label} href={resolveOperationalHref(item)} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, background: "rgba(0,0,0,0.18)", minHeight: 136, textDecoration: "none", color: "var(--text)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ fontWeight: "bold", marginBottom: 6 }}>{item.label}</div>
                <div className="small" style={{ color: "var(--text)", opacity: 0.9, lineHeight: 1.45 }}>{item.value}</div>
                <div className="small" style={{ marginTop: 10, color: tax.theme?.primary || "var(--primary)", fontWeight: "bold" }}>{item.signal}</div>
                <div className="small" style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line)", color: "var(--muted)", fontWeight: "bold" }}>
                  {item.action_label || "Abrir modulo"} →
                </div>
              </a>
            ))}
          </div>

          {tax.automation_maturity?.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              <div className="small" style={{ marginBottom: 8, fontWeight: "bold", color: "var(--muted)" }}>Ruta de madurez operacional</div>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8 }}>
                {tax.automation_maturity.map((step: string, idx: number) => (
                  <div key={step} className="small" style={{ display: "flex", gap: 8, alignItems: "flex-start", lineHeight: 1.45 }}>
                    <span style={{ color: tax.theme?.primary || "var(--primary)", fontWeight: "bold" }}>{idx + 1}.</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tax.operational_actions?.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              <div className="small" style={{ marginBottom: 10, fontWeight: "bold", color: "var(--muted)" }}>Acciones operativas inmediatas</div>
              <div className="row" style={{ justifyContent: "flex-start", gap: 10, flexWrap: "wrap" }}>
                {tax.operational_actions.map((action: any) => (
                  <a key={action.label} className="btn" href={resolveOperationalHref(action)} style={{ borderColor: tax.theme?.primary || "var(--line)", color: "var(--text)" }}>
                    {action.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DASHBOARD RENDER */}
      <div className="card" style={{ 
        background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.95))", 
        border: mode === "simulation" ? "1px dashed #f39c12" : "1px solid var(--primary)", 
        boxShadow: "0 0 40px rgba(91, 124, 250, 0.15)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "24px 32px",
        position: "relative"
      }}>
        {mode === "simulation" && <div style={{ position: "absolute", top: 12, right: 12, color: "#f39c12", fontSize: 12, fontWeight: "bold" }}>{simulationLabel}</div>}
        <div>
           <div className="cardTitle" style={{ fontSize: 16, color: "var(--primary)", fontWeight: "bold" }}>{financialTitle}</div>
           <div className="big" style={{ fontSize: 64, color: "#fff", textShadow: "0 2px 15px rgba(0,0,0,0.8)", margin: "8px 0" }}>
              {(state.ebitda_margin ?? state.pnl?.ebitda_margin ?? 0).toFixed(1)}%
           </div>
           <div className="small" style={{ marginTop: 8, maxWidth: 600, lineHeight: 1.6, opacity: 0.85 }}>
             {financialExplanation}
           </div>
        </div>
        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 6, opacity: 0.7 }}>
           <div className="small" style={{ fontWeight: "bold", fontSize: 14 }}>{performanceTreeLabel}</div>
           <div className="small">▼ Modelamiento Dinámico VantDomus</div>
        </div>
      </div>

      <div className="sectionTitle" style={{ fontSize: 18, borderBottom: "1px solid var(--line)", paddingBottom: 8, color: "var(--muted)", marginTop: 24 }}>{driverSectionTitle}</div>
      <div className="grid" style={{ gap: 14, gridTemplateColumns: "repeat(12, 1fr)" }}>
        <div className="card" style={{ gridColumn: "span 3", border: `1px solid ${macroStyle.color}`, boxShadow: `0 0 20px ${macroStyle.color}20`, padding: 16 }}>
           <KPIDonut 
             title={tax.driver_titles?.osi || `1. Driver Relevancia (${tax.kpi.osi})`}
             value={state.global_osi}
             valueColor={macroStyle.color}
             accentColor="var(--primary)"
             description={driverDescriptions.osi}
           />
        </div>
        <div className="card" style={{ gridColumn: "span 3", background: "rgba(255,255,255,0.02)", padding: 16 }}>
           <KPIDonut 
             title={tax.driver_titles?.health || `2. Fuga Operacional (${tax.kpi.health})`}
             value={state.global_health}
             valueColor="var(--warn)"
             accentColor="var(--warn)"
             description={driverDescriptions.health}
           />
        </div>
        <div className="card" style={{ gridColumn: "span 3", background: "rgba(255,255,255,0.02)", padding: 16 }}>
           <KPIDonut 
             title={tax.driver_titles?.tasks || `3. Fuga CAPEX/Mantenimiento (${tax.kpi.tasks})`}
             value={state.global_task}
             valueColor="var(--bad)"
             accentColor="var(--bad)"
             description={driverDescriptions.tasks}
           />
        </div>
        <div className="card" style={{ gridColumn: "span 3", background: "rgba(255,255,255,0.02)", padding: 16 }}>
           <KPIDonut 
             title={tax.driver_titles?.finance || `4. Eficiencia de Costos (${tax.kpi.finance})`}
             value={state.global_finance}
             valueColor="var(--good)"
             accentColor="var(--good)"
             description={driverDescriptions.finance}
           />
        </div>
      </div>

      <div className="sectionTitle" style={{ fontSize: 18, borderBottom: "1px solid var(--line)", paddingBottom: 8, color: "var(--primary)", marginTop: 24 }}>{unitMapTitle}</div>
      <IndustryTree state={state} tax={tax} />

      <div className="sectionTitle" style={{ fontSize: 18, borderBottom: "1px solid var(--line)", paddingBottom: 8, color: "var(--muted)", marginTop: 24 }}>{analyticsTitle}</div>
      
      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", gap: 24, alignItems: "start" }}>
        {/* LADO IZQUIERDO: ESTADO DE RESULTADOS */}
        <div className="card" style={{ padding: "0", overflow: "hidden" }}>
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid var(--line)" }}>
                <th style={{ textAlign: "left" }}>Linea de resultado</th>
                <th style={{ textAlign: "right" }}>Monto ({moneyUnit})</th>
                <th style={{ textAlign: "left", paddingLeft: 16 }}>Lectura VantDomus</th>
              </tr>
            </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: "bold" }}>{pnlLabels.revenue}</td>
              <td style={{ textAlign: "right", color: "var(--good)", fontWeight: "bold" }}>{moneyText(state.pnl?.revenue || 0)}</td>
              <td className="small">Impulsado por {tax.kpi.osi}</td>
            </tr>
            <tr>
              <td>{pnlLabels.cogs}</td>
              <td style={{ textAlign: "right", color: "var(--bad)" }}>{negativeMoneyText(state.pnl?.cogs || 0)}</td>
              <td className="small">Regulado por factor de Eficiencia ({tax.kpi.finance})</td>
            </tr>
            <tr style={{ background: "rgba(255,255,255,0.02)" }}>
              <td style={{ fontWeight: "bold" }}>{pnlLabels.gross}</td>
              <td style={{ textAlign: "right", fontWeight: "bold" }}>{moneyText(state.pnl?.gross_margin || 0)}</td>
              <td></td>
            </tr>
            <tr>
              <td>{pnlLabels.sga}</td>
              <td style={{ textAlign: "right", color: "var(--bad)" }}>{negativeMoneyText(state.pnl?.sga || 0)}</td>
              <td className="small">Castigado fuertemente por Atrasos ({tax.kpi.tasks})</td>
            </tr>
            <tr style={{ background: "rgba(255,255,255,0.05)" }}>
              <td style={{ fontWeight: "bold", fontSize: 15, color: "var(--primary)" }}>{pnlLabels.ebitda}</td>
              <td style={{ textAlign: "right", fontWeight: "bold", fontSize: 15, color: "var(--primary)" }}>{moneyText(state.pnl?.ebitda || 0)}</td>
              <td style={{ fontWeight: "bold", color: "var(--primary)", fontSize: 13 }}>{isFamily ? "Balance familiar" : "Margen EBITDA"}: {state.ebitda_margin}%</td>
            </tr>
            <tr>
              <td>{pnlLabels.fines}</td>
              <td style={{ textAlign: "right", color: "var(--bad)" }}>{negativeMoneyText(state.pnl?.fines_da || 0)}</td>
              <td className="small">Penalizacion por {tax.kpi.health}</td>
            </tr>
            <tr style={{ background: "rgba(255,255,255,0.02)" }}>
              <td style={{ fontWeight: "bold" }}>{pnlLabels.ebit}</td>
              <td style={{ textAlign: "right", fontWeight: "bold" }}>{moneyText(state.pnl?.ebit || 0)}</td>
              <td></td>
            </tr>
            <tr>
              <td>{pnlLabels.taxes}</td>
              <td style={{ textAlign: "right", color: "var(--bad)" }}>{negativeMoneyText(state.pnl?.taxes || 0)}</td>
              <td className="small">{isFamily ? "Reserva preventiva sugerida para salud, compras, vencimientos y emergencias." : "Carga Tributaria Constante (27% s/EBIT)"}</td>
            </tr>
            <tr style={{ background: "linear-gradient(90deg, rgba(49,208,122,0.1), transparent)" }}>
              <td style={{ fontWeight: "bold", fontSize: 16, color: "var(--text)" }}>{pnlLabels.net}</td>
              <td style={{ textAlign: "right", fontWeight: "bold", fontSize: 16, color: (state.pnl?.net_income ?? 0) >= 0 ? "var(--good)" : "var(--bad)" }}>
                {moneyText(state.pnl?.net_income || 0)}
              </td>
              <td className="small" style={{ fontStyle: "italic", opacity: 0.8 }}>Ultima linea proyectada por VantDomus.</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* LADO DERECHO: RADAR Y MOTOR DE RIESGO */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="card" style={{ padding: "16px", border: "1px solid var(--primary)", background: "rgba(0,0,0,0.2)", position: "relative" }}>
           <div className="cardTitle" style={{ color: "var(--primary)", fontWeight: "bold", textAlign: "center" }}>{isFamily ? "RADAR DE CUIDADO FAMILIAR" : "RADAR DE VULNERABILIDAD"}</div>
           <RiskRadar state={state} tax={tax} />
        </div>

        <div className="card" style={{ background: isCritical ? "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(0,0,0,0.8))" : "rgba(255,255,255,0.02)", border: isCritical ? "1px solid var(--bad)" : "1px solid var(--line)" }}>
           <div className="cardTitle" style={{ color: isCritical ? "var(--bad)" : "var(--muted)", fontWeight: "bold" }}>{riskTitle}</div>
           
           <div style={{ marginTop: 12 }}>
             <div className="small">{riskProbabilityLabel}</div>
             <div className="big" style={{ color: isCritical ? "var(--bad)" : "var(--good)" }}>
               {collapseRisk.toFixed(1)}%
             </div>
           </div>

           <div style={{ marginTop: 16 }}>
             <div className="small">{riskTimeLabel}</div>
             <div className="big" style={{ fontSize: 24 }}>
                {Math.floor(mttfMonths)} Meses
             </div>
           </div>

           {isCritical && (
             <div style={{ marginTop: 16, padding: "8px 12px", background: "rgba(239, 68, 68, 0.2)", borderLeft: "3px solid var(--bad)", fontSize: 13, color: "var(--text)" }}>
                <strong>CRITICO:</strong> {criticalMessage}
             </div>
           )}
        </div>
      </div>
    </div>
        </div>
      </details>
      {/* BITÁCORA COLABORATIVA */}
      <div className="sectionTitle" style={{ fontSize: 18, borderBottom: "1px solid var(--line)", paddingBottom: 8, color: "var(--muted)", marginTop: 24 }}>{logbookTitle}</div>
      
      <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", background: "rgba(0,0,0,0.2)" }}>
        {logWarning && (
          <div style={{ margin: 16, marginBottom: 0, border: "1px solid rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.08)", color: "#fbbf24", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 700 }}>
            {logWarning}
          </div>
        )}
        <div style={{ flex: 1, padding: 16, maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {logs.length === 0 ? (
             <div className="small" style={{ opacity: 0.5, textAlign: "center", padding: 20 }}>{logbookEmpty}</div>
          ) : (
            logs.map(log => {
               let badgeColor = "#7f8c8d";
               if (log.entry_type === "hito") badgeColor = "#3498db";
               if (log.entry_type === "accidente") badgeColor = "#e74c3c";
               if (log.entry_type === "implementacion") badgeColor = "#2ecc71";
               if (log.entry_type === "reunion") badgeColor = "#9b59b6";
               if (log.entry_type === "auditoria" || log.entry_type === "inspeccion") badgeColor = "#f1c40f";
               if (log.entry_type === "alerta" || log.entry_type === "aviso") badgeColor = "#e67e22";
               if (log.entry_type === "acuerdo") badgeColor = "#1abc9c";
               
               const displayDate = log.event_date ? new Date(log.event_date).toLocaleString() : new Date(log.created_at).toLocaleString();
               
               return (
                 <div key={log.id} style={{ background: "rgba(255,255,255,0.03)", padding: 12, borderRadius: 6, borderLeft: `3px solid ${badgeColor}` }}>
                   <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <div className="row" style={{ gap: 8, alignItems: "center" }}>
                        <span style={{ fontWeight: "bold", fontSize: 14 }}>{log.author_name}</span>
                        <span style={{ fontSize: 11, background: badgeColor, color: "#fff", padding: "2px 6px", borderRadius: 4, fontWeight: "bold", textTransform: "uppercase" }}>
                           {log.entry_type}
                        </span>
                      </div>
                      <div className="small" style={{ opacity: 0.6 }}>{displayDate}</div>
                   </div>
                   <div style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.9 }}>{log.content}</div>
                   {log.attachment_url && (
                     <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                        <button
                          type="button"
                          onClick={() => handleCreateShareLink(log.id)}
                          disabled={shareLoadingId === log.id}
                          className="button"
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--primary)", textDecoration: "none", fontSize: 12 }}
                        >
                           {shareLoadingId === log.id ? "Creando link..." : `Crear link firmado: ${log.attachment_name || "Archivo adjunto"}`}
                        </button>
                        {shareLinks[log.id] && (
                          <div style={{ width: "100%", maxWidth: 720, background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.35)", borderRadius: 6, padding: 10 }}>
                            <div className="small" style={{ color: "#fbbf24", marginBottom: 6, fontWeight: "bold" }}>
                              {shareLinks[log.id].revoked
                                ? `Link revocado: ${new Date(shareLinks[log.id].revoked_at).toLocaleString()}`
                                : `Link firmado generado. Se muestra solo una vez y vence: ${new Date(shareLinks[log.id].expires_at).toLocaleString()}`}
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input
                                className="input"
                                readOnly
                                value={`/api/proxy${shareLinks[log.id].url}`}
                                disabled={shareLinks[log.id].revoked}
                                style={{ flex: 1, fontFamily: "monospace", fontSize: 12 }}
                                onFocus={e => e.currentTarget.select()}
                              />
                              {!shareLinks[log.id].revoked && (
                                <a
                                  href={`/api/proxy${shareLinks[log.id].url}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="button"
                                  style={{ padding: "8px 12px", textDecoration: "none", fontSize: 12 }}
                                >
                                  Abrir
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRevokeShareLink(log.id)}
                                disabled={shareLinks[log.id].revoked || shareRevokingId === log.id}
                                className="button"
                                style={{ padding: "8px 12px", fontSize: 12, background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.45)", color: "#fecaca" }}
                              >
                                {shareRevokingId === log.id ? "Revocando..." : "Revocar"}
                              </button>
                            </div>
                          </div>
                        )}
                     </div>
                   )}
                 </div>
               );
            })
          )}
        </div>
        
        <form onSubmit={handleCreateLog} style={{ padding: 16, background: "rgba(255,255,255,0.05)", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 12 }}>
           <div style={{ display: "flex", gap: 12 }}>
             <select 
               title="Tipo de Entrada"
               className="input" 
               value={entryType} 
               onChange={e=>setEntryType(e.target.value)} 
               style={{ width: 140 }}
             >
               <option value="comentario">Comentario</option>
               <option value="hito">Hito</option>
               <option value="accidente">{isFamily ? "Alerta de cuidado" : "Accidente HSE"}</option>
               <option value="implementacion">{isFamily ? "Rutina implementada" : "Implementacion"}</option>
               <option value="reunion">{isFamily ? "Conversacion familiar" : "Reunion"}</option>
               <option value="acuerdo">{isFamily ? "Acuerdo familiar" : "Acuerdo Comercial"}</option>
               <option value="auditoria">{isFamily ? "Documento revisado" : "Auditoria"}</option>
               <option value="inspeccion">{isFamily ? "Control medico / hogar" : "Inspeccion"}</option>
               <option value="aviso">Aviso / Alerta</option>
             </select>
             <input 
               title="Contenido"
               placeholder={logbookPlaceholder}
               className="input" 
               style={{ flex: 1 }} 
               value={entryContent}
               onChange={e=>setEntryContent(e.target.value)}
               disabled={logLoading}
             />
           </div>
           
           <div style={{ display: "flex", gap: 12, alignItems: "center", borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: 12, marginTop: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="small" style={{ opacity: 0.7 }}>{logbookDateLabel}</span>
                <input 
                  type="datetime-local" 
                  className="input" 
                  value={eventDate} 
                  onChange={e => setEventDate(e.target.value)}
                  style={{ padding: "6px 10px", fontSize: 13 }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                 <span className="small" style={{ opacity: 0.7 }}>{logbookAttachmentLabel}</span>
                 <input 
                   type="file" 
                   className="input" 
                   onChange={e => setAttachment(e.target.files ? e.target.files[0] : null)}
                   style={{ padding: "6px", fontSize: 13 }}
                 />
              </div>
              <div style={{ flex: 1 }} />
              <button className="button" type="submit" disabled={logLoading}>
                {logLoading ? "Guardando..." : logbookSubmitLabel}
              </button>
           </div>
        </form>
      </div>

    </>
  );
}
