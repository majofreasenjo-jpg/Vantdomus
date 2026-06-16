"use client";

import React, { useMemo } from "react";

type ReportKind = "executive" | "financial" | "operational";

type ReportTemplate = {
  id: ReportKind;
  title: string;
  subtitle: string;
  focus: string;
  accent: string;
};

const reportTemplates: ReportTemplate[] = [
  {
    id: "executive",
    title: "Informe Ejecutivo",
    subtitle: "Decision, riesgo y proximas acciones",
    focus: "Resumen C-Level, desvio critico, decisiones sugeridas y evidencia requerida.",
    accent: "#f59e0b",
  },
  {
    id: "financial",
    title: "Informe Financiero",
    subtitle: "Gasto, margen y resultado proyectado",
    focus: "P&L ejecutivo, sobre gasto, EBITDA, recuperabilidad y medidas de control.",
    accent: "#22c55e",
  },
  {
    id: "operational",
    title: "Informe Operativo",
    subtitle: "Planificador de unidades y direccion de obra",
    focus: "Continuidad, SLA, unidades criticas, responsables y plan de correccion.",
    accent: "#38bdf8",
  },
];

function money(value: unknown) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
}

function percent(value: unknown) {
  const n = Number(value || 0);
  return `${Math.round(n)}%`;
}

function clean(value: unknown, fallback = "Sin dato") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function htmlEscape(value: unknown) {
  return clean(value, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getWeakest(items: any[], field: string) {
  return [...items].sort((a, b) => Number(a?.[field] || 0) - Number(b?.[field] || 0))[0];
}

function buildReportText(template: ReportTemplate, ctx: any) {
  const rows = [
    `VANTDOMUS | ${template.title.toUpperCase()} ${ctx.clientName}`,
    `Fecha: ${ctx.generatedAt}`,
    `Dominio: ${ctx.domainLabel}`,
    "",
    "LECTURA EJECUTIVA",
    `KPI global: ${percent(ctx.state.global_osi)}`,
    `HSE / seguridad: ${percent(ctx.state.global_health)}`,
    `SLA / tareas: ${percent(ctx.state.global_task)}`,
    `Control financiero: ${percent(ctx.state.global_finance)}`,
    `Riesgo proyectado: ${percent(ctx.collapseRisk)}`,
    `Unidad critica: ${ctx.weakestUnitName}`,
    `Gerencia con mayor atencion: ${ctx.weakestGerenciaName}`,
    "",
    "LECTURA FINANCIERA",
    `Ingresos / valor operacional: ${money(ctx.pnl.revenue)}`,
    `Costos directos: ${money(ctx.pnl.cogs)}`,
    `Margen bruto: ${money(ctx.pnl.gross_margin)}`,
    `Gastos y desviaciones: ${money(ctx.pnl.sga)}`,
    `EBITDA: ${money(ctx.pnl.ebitda)}`,
    `Resultado proyectado: ${money(ctx.pnl.net_income)}`,
    "",
    "ACCIONES PREESTABLECIDAS",
    ...ctx.actions.map((item: string, index: number) => `${index + 1}. ${item}`),
    "",
    "EVIDENCIA REQUERIDA",
    ...ctx.evidence.map((item: string, index: number) => `${index + 1}. ${item}`),
  ];

  if (template.id === "financial") {
    rows.splice(14, 0, "Foco financiero: aislar partidas con desviacion, documentar recuperabilidad y bloquear gasto no trazable.");
  }

  if (template.id === "operational") {
    rows.splice(14, 0, "Foco operativo: corregir unidad critica, responsables vencidos, continuidad y trazabilidad de terreno.");
  }

  return rows.join("\n");
}

function buildReportHtml(template: ReportTemplate, ctx: any) {
  const topUnits = ctx.departments.slice(0, 8);
  const title = `${template.title} ${ctx.clientName}`;
  const rows = [
    ["KPI global", percent(ctx.state.global_osi)],
    ["HSE / seguridad", percent(ctx.state.global_health)],
    ["SLA / tareas", percent(ctx.state.global_task)],
    ["Control financiero", percent(ctx.state.global_finance)],
    ["Riesgo proyectado", percent(ctx.collapseRisk)],
    ["Unidad critica", ctx.weakestUnitName],
  ];
  const pnlRows = [
    ["Ingresos / valor operacional", money(ctx.pnl.revenue)],
    ["Costos directos", money(ctx.pnl.cogs)],
    ["Margen bruto", money(ctx.pnl.gross_margin)],
    ["Gastos y desviaciones", money(ctx.pnl.sga)],
    ["EBITDA", money(ctx.pnl.ebitda)],
    ["Contingencias", money(ctx.pnl.fines_da)],
    ["Resultado proyectado", money(ctx.pnl.net_income)],
  ];

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${htmlEscape(title)}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; background: #fff; }
    .bar { height: 8px; background: ${template.accent}; margin-bottom: 22px; }
    h1 { font-size: 26px; margin: 0 0 6px; letter-spacing: 0; }
    h2 { font-size: 16px; margin: 24px 0 8px; color: #111827; }
    p, li, td, th { font-size: 12px; line-height: 1.45; }
    .meta { color: #4b5563; margin-bottom: 18px; }
    .summary { border: 1px solid #d1d5db; padding: 14px; border-left: 6px solid ${template.accent}; margin-bottom: 18px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
    th { text-align: left; background: #f3f4f6; }
    th, td { border: 1px solid #d1d5db; padding: 8px; vertical-align: top; }
    .pill { display: inline-block; border: 1px solid ${template.accent}; color: #111827; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .footer { margin-top: 28px; font-size: 10px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="bar"></div>
  <h1>VantDomus | ${htmlEscape(title)}</h1>
  <div class="meta">${htmlEscape(ctx.generatedAt)} | ${htmlEscape(ctx.domainLabel)} | Unidad base: ${htmlEscape(ctx.defaultHid || "sin unidad")}</div>
  <div class="summary">
    <span class="pill">${htmlEscape(template.subtitle)}</span>
    <p><strong>Lectura principal:</strong> ${htmlEscape(ctx.executiveSummary)}</p>
    <p><strong>Foco del informe:</strong> ${htmlEscape(template.focus)}</p>
  </div>

  <h2>1. Indicadores ejecutivos</h2>
  <table>
    <tbody>${rows.map(([k, v]) => `<tr><th>${htmlEscape(k)}</th><td>${htmlEscape(v)}</td></tr>`).join("")}</tbody>
  </table>

  <h2>2. Estado financiero</h2>
  <table>
    <tbody>${pnlRows.map(([k, v]) => `<tr><th>${htmlEscape(k)}</th><td>${htmlEscape(v)}</td></tr>`).join("")}</tbody>
  </table>

  <h2>3. Mapa operativo de unidades</h2>
  <table>
    <thead><tr><th>Unidad</th><th>OSI</th><th>HSE</th><th>Tareas</th><th>Finanzas</th></tr></thead>
    <tbody>${topUnits.map((d: any) => `<tr><td>${htmlEscape(d.name)}</td><td>${percent(d.hsi)}</td><td>${percent(d.health)}</td><td>${percent(d.task_completion)}</td><td>${percent(d.finance_score)}</td></tr>`).join("")}</tbody>
  </table>

  <h2>4. Acciones recomendadas</h2>
  <ol>${ctx.actions.map((item: string) => `<li>${htmlEscape(item)}</li>`).join("")}</ol>

  <h2>5. Evidencia y respaldo</h2>
  <ol>${ctx.evidence.map((item: string) => `<li>${htmlEscape(item)}</li>`).join("")}</ol>

  <div class="footer">Informe preestablecido generado por VantDomus. Debe ser validado contra contrato, anexos, trazabilidad documental y aprobaciones del cliente antes de su emision formal.</div>
  <script>
    window.addEventListener("load", () => setTimeout(() => window.print(), 250));
  </script>
</body>
</html>`;
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PresetReports({ state, tax, collapseRisk, defaultHid }: { state: any; tax: any; collapseRisk: number; defaultHid: string }) {
  const ctx = useMemo(() => {
    const gerencias = state?.gerencias || [];
    const departments = gerencias.flatMap((g: any) => g.departments || []);
    const weakestGerencia = getWeakest(gerencias, "macro_osi");
    const weakestUnit = getWeakest(departments, "hsi");
    const clientName = tax?.client_name || tax?.digital_badge || "Cliente";
    const domainLabel = tax?.domain_label || "Planificador de Unidades";
    const pnl = state?.pnl || {};
    const weakestUnitName = clean(weakestUnit?.name, "Sin unidad critica detectada");
    const weakestGerenciaName = clean(weakestGerencia?.name, "Sin gerencia critica detectada");
    const executiveSummary = `${clientName} presenta OSI ${percent(state?.global_osi)}, control financiero ${percent(state?.global_finance)} y riesgo proyectado ${percent(collapseRisk)}. La atencion prioritaria debe concentrarse en ${weakestUnitName} y ${weakestGerenciaName}.`;
    const actions = [
      `Asignar responsable y fecha de cierre para ${weakestUnitName}.`,
      "Congelar gasto no trazable y separar partidas recuperables, no recuperables y en disputa.",
      "Actualizar matriz documental con contrato, anexos, actas, NOC, respaldo fotografico, planillas y aprobaciones.",
      "Ejecutar escenario what-if con impacto en margen, continuidad y fecha de entrega.",
      `Preparar minuta ejecutiva de decisiones para comite ${clientName} con evidencia asociada.`,
    ];
    const evidence = [
      "Contrato, bases de licitacion, oferta economica, APU y gastos generales.",
      "Actas, cartas NOC, ordenes de cambio, instrucciones de terreno y aprobaciones.",
      "Telemetria, reportes diarios, fotografias, bitacoras, HH, maquinaria y avance real.",
      "Planilla de costos, curvas de gasto, respaldo de facturacion y matriz de recuperabilidad.",
    ];

    return {
      actions,
      clientName,
      collapseRisk,
      defaultHid,
      departments,
      domainLabel,
      evidence,
      executiveSummary,
      generatedAt: new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date()),
      pnl,
      state,
      weakestGerenciaName,
      weakestUnitName,
    };
  }, [state, tax, collapseRisk, defaultHid]);

  const generatePdf = (template: ReportTemplate) => {
    const html = buildReportHtml(template, ctx);
    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) {
      downloadFile(`vantdomus-${template.id}-${ctx.clientName}.html`, html, "text/html;charset=utf-8");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  };

  const downloadHtml = (template: ReportTemplate) => {
    const html = buildReportHtml(template, ctx);
    downloadFile(`vantdomus-${template.id}-${ctx.clientName}.html`, html, "text/html;charset=utf-8");
  };

  const downloadTxt = (template: ReportTemplate) => {
    const text = buildReportText(template, ctx);
    downloadFile(`vantdomus-${template.id}-${ctx.clientName}.txt`, text, "text/plain;charset=utf-8");
  };

  return (
    <section className="print-hidden" style={{ border: "1px solid rgba(245, 158, 11, 0.45)", background: "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(50,10,20,0.74))", borderRadius: 14, padding: 18, margin: "0 0 24px" }}>
      <div className="row" style={{ alignItems: "flex-start", gap: 16, marginBottom: 14 }}>
        <div>
          <div className="cardTitle" style={{ color: "#f59e0b" }}>Informes preestablecidos {ctx.clientName}</div>
          <div className="big" style={{ fontSize: 24 }}>Informes ejecutivos, financieros y operativos</div>
          <div className="small" style={{ maxWidth: 920 }}>
            Salidas listas para imprimir como PDF o descargar como evidencia de trabajo. Cada informe toma la lectura viva del tablero: KPI, P&L, riesgo, unidad critica y acciones recomendadas.
          </div>
        </div>
        <span className="pill warn">Formato cliente</span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {reportTemplates.map((template) => (
          <article key={template.id} className="card" style={{ borderColor: "rgba(148,163,184,0.25)", background: "rgba(2,6,23,0.44)", padding: 14 }}>
            <div style={{ height: 4, width: 64, borderRadius: 999, background: template.accent, marginBottom: 12 }} />
            <div style={{ fontWeight: 800, fontSize: 18 }}>{template.title}</div>
            <div className="small" style={{ color: "#bfdbfe", margin: "4px 0 10px" }}>{template.subtitle}</div>
            <p className="small" style={{ minHeight: 48, margin: 0 }}>{template.focus}</p>
            <div className="row" style={{ gap: 8, justifyContent: "flex-start", marginTop: 14, flexWrap: "wrap" }}>
              <button type="button" className="button" style={{ background: template.accent, color: "#020617", border: "none", fontWeight: 800 }} onClick={() => generatePdf(template)}>
                Generar PDF
              </button>
              <button type="button" className="button" style={{ background: "transparent", border: "1px solid rgba(148,163,184,0.45)", color: "var(--text)" }} onClick={() => downloadHtml(template)}>
                HTML
              </button>
              <button type="button" className="button" style={{ background: "transparent", border: "1px solid rgba(148,163,184,0.45)", color: "var(--text)" }} onClick={() => downloadTxt(template)}>
                TXT
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
