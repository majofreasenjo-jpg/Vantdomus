import React from "react";

function formatNumberStable(value: number, decimals = 0) {
  const safe = Number.isFinite(value) ? value : 0;
  const fixed = Math.abs(safe).toFixed(decimals);
  const [whole, fraction] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${safe < 0 ? "-" : ""}${grouped}${fraction ? `,${fraction}` : ""}`;
}

export default function IndustryTree({ state, tax }: { state: any, tax: any }) {
  // Infer data from state to populate generic unit-planning nodes.
  const { global_osi = 0, global_health = 0, global_task = 0, global_finance = 0, global_esg = 0, pnl } = state || {};
  const isFamily = Boolean(tax?.family_mode);
  const moneyText = (value: number) => isFamily
    ? `$ ${formatNumberStable(Number(value || 0) / 1000, 0)}`
    : `M$ ${formatNumberStable(Number(value || 0), 1)}`;

  // Generic Mappings
  const tup = Math.min(100, global_osi * 1.05); // Tasa Utilización de Procesos (Ligeramente > OSI due to pure operation)
  // Intensidad Energética (Mejor cercano a 100%. Baja con mal mantenimiento Y baja críticamente si hay poca carga en hornos por TUP bajo)
  const eii = Math.max(70, 100 - ((100 - global_task) * 0.4) - ((100 - tup) * 0.35)); 
  const disp_operativa = Math.max(0, 100 - (100 - global_health) * 0.8 - (100 - global_task) * 0.5); // Disponibilidad después de paros
  const prod_laboral = Math.min(100, (global_health * 0.6 + global_task * 0.4)); // Productividad

  // Detenciones
  const fallas_operativas = Math.round(100 - global_health);
  const fallas_equipos = Math.round(100 - global_task);

  const NodeLine = ({ active = true }: { active?: boolean }) => (
    <div style={{ height: 24, borderLeft: `2px dashed ${active ? "var(--muted)" : "rgba(255,255,255,0.1)"}`, marginLeft: 20 }}></div>
  );

  const SubNodeLine = () => (
    <div style={{ width: 20, height: 2, background: "var(--line)", display: "inline-block", verticalAlign: "middle", marginRight: 8 }}></div>
  );

  const MetricPill = ({ val = 0, inverse = false, suffix = "%" }: { val?: number, inverse?: boolean, suffix?: string }) => {
    let color = "var(--warn)";
    if (!inverse) {
      if (val >= 90) color = "var(--good)";
      if (val < 70) color = "var(--bad)";
    } else {
      if (val <= 10) color = "var(--good)";
      if (val > 30) color = "var(--bad)";
    }
    return <span style={{ background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: 4, color, fontWeight: "bold", fontSize: 13, border: `1px solid ${color}40` }}>{val.toFixed(1)}{suffix}</span>
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* MACRO KPIs (universal unit planner) */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
        <div className="card" style={{ padding: 12, background: "rgba(41, 128, 185, 0.15)", borderTop: "3px solid #3498db" }}>
          <div className="small" style={{ fontWeight: "bold", color: "#3498db" }}>{tax?.macro_kpis?.capacity || "Capacity Utilization"}</div>
          <div style={{ fontSize: 22, fontWeight: "bold", marginTop: 4 }}>{tup.toFixed(1)}%</div>
          <div className="small" style={{ opacity: 0.7, marginTop: 4 }}>{isFamily ? "Rutinas, colegio, compras y compromisos cubiertos." : `Apalancado por ${tax?.kpi?.osi || "Produccion"}.`}</div>
        </div>
        <div className="card" style={{ padding: 12, background: "rgba(41, 128, 185, 0.15)", borderTop: "3px solid #3498db" }}>
          <div className="small" style={{ fontWeight: "bold", color: "#3498db" }}>{tax?.macro_kpis?.intensity || "Asset/Energy Intensity"}</div>
          <div style={{ fontSize: 22, fontWeight: "bold", marginTop: 4 }}>{eii.toFixed(1)}%</div>
          <div className="small" style={{ opacity: 0.7, marginTop: 4 }}>{isFamily ? "Carga mental acumulada por pendientes y coordinacion." : "Impactado por sobreuso y falta de mantencion."}</div>
        </div>
        <div className="card" style={{ padding: 12, background: "rgba(41, 128, 185, 0.15)", borderTop: "3px solid #3498db" }}>
          <div className="small" style={{ fontWeight: "bold", color: "#3498db" }}>{tax?.macro_kpis?.uptime || "Operational Uptime"}</div>
          <div style={{ fontSize: 22, fontWeight: "bold", marginTop: 4 }}>{disp_operativa.toFixed(1)}%</div>
          <div className="small" style={{ opacity: 0.7, marginTop: 4 }}>{isFamily ? "Espacios disponibles para descanso, salud y convivencia." : "Tiempo neto productivo descontando paros en terreno."}</div>
        </div>
        <div className="card" style={{ padding: 12, background: "rgba(41, 128, 185, 0.15)", borderTop: "3px solid #3498db" }}>
          <div className="small" style={{ fontWeight: "bold", color: "#3498db" }}>{tax?.macro_kpis?.opex || "OPEX Efficiency"}</div>
          <div style={{ fontSize: 22, fontWeight: "bold", marginTop: 4 }}>{moneyText(pnl?.cogs || 0)}</div>
          <div className="small" style={{ opacity: 0.7, marginTop: 4 }}>{isFamily ? "Presupuesto usado en hogar, salud, compras y servicios." : `Control de gastos directos e indirectos (${tax?.kpi?.finance || "Finance"}).`}</div>
        </div>
        <div className="card" style={{ padding: 12, background: "rgba(41, 128, 185, 0.15)", borderTop: "3px solid #3498db" }}>
          <div className="small" style={{ fontWeight: "bold", color: "#3498db" }}>{tax?.macro_kpis?.productivity || "Labor Productivity"}</div>
          <div style={{ fontSize: 22, fontWeight: "bold", marginTop: 4 }}>{prod_laboral.toFixed(1)}%</div>
          <div className="small" style={{ opacity: 0.7, marginTop: 4 }}>{isFamily ? "Compromisos familiares cerrados sin friccion." : `Eficiencia del capital humano libre de incidentes (${tax?.kpi?.health || "Salud"}).`}</div>
        </div>
      </div>

      {/* ÁRBOL DE DESEMPEÑO GENÉRICO */}
      <div className="card" style={{ background: "transparent", border: "1px solid var(--line)" }}>
        <div className="cardTitle" style={{ fontSize: 18, color: "#fff", textAlign: "center", marginBottom: 24, padding: 10, background: "rgba(255,255,255,0.05)", borderRadius: 6 }}>
          {tax?.tree_title || `ESTRUCTURA CAUSAL DE DESEMPENO (${tax?.domain_label || tax?.name || "Planificador de Unidades"})`}
        </div>
        
        <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          
          {/* UTILIDAD */}
          <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, background: "rgba(0,0,0,0.2)" }}>
            <div style={{ background: "#1f3a52", padding: "6px 12px", borderRadius: 4, fontWeight: "bold", color: "#7dbcf5", marginBottom: 12 }}>1. {tax?.tree_nodes?.n1 || "Utilidad"}</div>
            
            <div className="small" style={{ fontWeight: "bold" }}>└ {tax?.tree_nodes?.n1_a || "Continuidad afectada"} <MetricPill val={global_osi} /></div>
            <div style={{ marginLeft: 16, marginTop: 8 }}>
               <div className="small" style={{ color: "var(--muted)", marginBottom: 4 }}><SubNodeLine />{tax?.tree_nodes?.n1_a1 || "Detenciones por Falla Operativa"} <MetricPill val={fallas_operativas} inverse={true} /></div>
               <div className="small" style={{ color: "var(--muted)" }}><SubNodeLine />{tax?.tree_nodes?.n1_a2 || "Detenciones por Falla Equipos"} <MetricPill val={fallas_equipos} inverse={true} /></div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div className="small" style={{ fontWeight: "bold" }}>└ {tax?.tree_nodes?.n1_b || "Costo operativo"} <MetricPill val={global_finance} /></div>
            </div>
          </div>

          {/* VIDA Y SALUD */}
          <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, background: "rgba(0,0,0,0.2)" }}>
            <div style={{ background: "#1f3a52", padding: "6px 12px", borderRadius: 4, fontWeight: "bold", color: "#7dbcf5", marginBottom: 12 }}>2. {tax?.tree_nodes?.n2 || "Cuidado Vida y Salud"}</div>
            
            <div className="small" style={{ fontWeight: "bold" }}>└ {tax?.tree_nodes?.n2_a || "IF / IS"} <MetricPill val={global_health} /></div>
            <div style={{ marginLeft: 16, marginTop: 8 }}>
               <div className="small" style={{ color: "var(--muted)", marginBottom: 4 }}>
                 <SubNodeLine />{tax?.tree_nodes?.n2_a1 || "Cumplimiento PA Riesgos Altos"} <MetricPill val={global_health} />
               </div>
            </div>
            
            <div className="small" style={{ marginTop: 14, fontStyle: "italic", opacity: 0.6 }}>
              {tax?.tree_nodes?.n2_note || "Alineado a las alertas preventivas de las unidades operativas."}
            </div>
          </div>

          {/* AMBIENTAL */}
          <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, background: "rgba(0,0,0,0.2)" }}>
            <div style={{ background: "#1f3a52", padding: "6px 12px", borderRadius: 4, fontWeight: "bold", color: "#7dbcf5", marginBottom: 12 }}>3. {tax?.tree_nodes?.n3 || "Cuidado Ambiental"}</div>
            
            <div className="small" style={{ fontWeight: "bold" }}>└ {tax?.tree_nodes?.n3_a || "Emisiones (SO2, MP, NOX)"}</div>
            <div style={{ marginLeft: 16, marginTop: 8 }}>
               <div className="small" style={{ color: "var(--muted)", marginBottom: 4 }}>
                 <SubNodeLine />{tax?.tree_nodes?.n3_a1 || "Cumplimiento PA Críticos"} <MetricPill val={global_esg} />
               </div>
            </div>
            
            <NodeLine />
            
            <div className="small" style={{ fontWeight: "bold" }}>└ {tax?.tree_nodes?.n3_b || "Respeto Comunidades"}</div>
            <div style={{ marginLeft: 16, marginTop: 8 }}>
               <div className="small" style={{ color: "var(--muted)", marginBottom: 4 }}>
                 <SubNodeLine />{tax?.tree_nodes?.n3_b1 || "Tasa Reclamos / Infracciones"} <MetricPill val={state.ceo_penalty_applied ? 8 : 0} inverse={true} suffix=" evs" />
               </div>
               <div className="small" style={{ color: "var(--muted)", marginBottom: 4 }}>
                 <SubNodeLine />{tax?.tree_nodes?.n3_b2 || "Cumplimiento PAG"} <MetricPill val={global_esg} />
               </div>
            </div>
          </div>

          {/* PERSONAL Y AUDITORIAS */}
          <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, background: "rgba(0,0,0,0.2)" }}>
            <div style={{ background: "#1f3a52", padding: "6px 12px", borderRadius: 4, fontWeight: "bold", color: "#7dbcf5", marginBottom: 12 }}>4. {tax?.tree_nodes?.n4 || "Personal y Auditorías"}</div>
            
            <div className="small" style={{ fontWeight: "bold" }}>└ {tax?.tree_nodes?.n4_a || "Personal Constante"}</div>
            <div style={{ marginLeft: 16, marginTop: 8 }}>
               <div className="small" style={{ color: "var(--muted)", marginBottom: 4 }}><SubNodeLine />{tax?.tree_nodes?.n4_a1 || "Capacitación"} <MetricPill val={global_task+5} /></div>
               <div className="small" style={{ color: "var(--muted)", marginBottom: 4 }}><SubNodeLine />{tax?.tree_nodes?.n4_a2 || "Control Sobretiempo"} <MetricPill val={global_health} /></div>
            </div>
            
            <NodeLine />

            <div className="small" style={{ fontWeight: "bold" }}>└ {tax?.tree_nodes?.n4_b || "Auditorías"}</div>
            <div style={{ marginLeft: 16, marginTop: 8 }}>
               <div className="small" style={{ color: "var(--muted)", marginBottom: 4 }}><SubNodeLine />{tax?.tree_nodes?.n4_b1 || "Cumplimiento AUD interna"} <MetricPill val={global_finance} /></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
