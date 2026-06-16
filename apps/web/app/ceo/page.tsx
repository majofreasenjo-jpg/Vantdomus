import { getCeoState, seedCeo, fastForwardCeo } from "../../lib/api";
import { INDUSTRY_PRESETS_UI } from "../../lib/taxonomy";
import { revalidatePath } from "next/cache";
import SubmitButton from "./SubmitButton";
import IndustryTree from "./IndustryTree";
import PrintButton from "./PrintButton";
import { cookies } from "next/headers";
import InteractiveDashboard from "./InteractiveDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CeoDashboard() {
  const cookieStore = await cookies();
  const hid = cookieStore.get("hid")?.value || "";

  let state = await getCeoState().catch(() => null);
  
  // Si el backend falla por completo, inyectar base nula.
  if (!state) {
    state = {
      global_osi: 100, global_health: 100, global_task: 100, global_finance: 100, global_esg: 100,
      ebitda_margin: 0,
      pnl: { revenue: 0, cogs: 0, gross_margin: 0, sga: 0, ebitda: 0, fines_da: 0, ebit: 0, taxes: 0, net_income: 0 },
      gerencias: [], ceo_penalty_applied: false, min_gerencia_osi: 0
    };
  }

  // Failsafe Crítico: Si el backend Render todavía está en la versión antigua y no envía PNL
  // Lo reconstruiremos sintéticamente acá mismo:
  if (!state.pnl) {
    const global_osi = state.global_osi || 0;
    const global_f = state.global_finance || 0;
    const global_t = state.global_task || 0;
    const global_h = state.global_health || 0;
    const global_esg = state.global_esg || 100;
    
    const rev = 1000.0 * (global_osi / 100.0);
    const eii_pen_factor = 1.0 + (100.0 - global_osi) * 0.005;
    const var_cogs = 350.0 * (global_osi / 100.0);
    const fix_cogs = 100.0 * (2.0 - (global_f / 100.0)) * eii_pen_factor;
    const cogs = var_cogs + fix_cogs;
    
    const gross = rev - cogs;
    const sga = 150.0 + (100.0 - global_t) * 2.5;
    const ebt = gross - sga;
    const esg_pen = Math.max(0, (80.0 - global_esg) * 12.0);
    const fines = 100.0 + (100.0 - global_h) * 5.0 + esg_pen;
    const ebp = ebt - fines;
    const taxes = ebp > 0 ? ebp * 0.27 : 0;
    const net = ebp - taxes;
    
    state.pnl = {
      revenue: Math.round(rev),
      cogs: Math.round(cogs),
      gross_margin: Math.round(gross),
      sga: Math.round(sga),
      ebitda: Math.round(ebt),
      fines_da: Math.round(fines),
      ebit: Math.round(ebp),
      taxes: Math.round(taxes),
      net_income: Math.round(net)
    };
  }

  const getHsiStyle = (hsi: number) => {
    if (hsi >= 80) return { cls: "pill good", label: "Estable", color: "var(--good)" };
    if (hsi >= 60) return { cls: "pill warn", label: "En Riesgo", color: "var(--warn)" };
    return { cls: "pill bad", label: "Crítico", color: "var(--bad)" };
  };

  const macroStyle = getHsiStyle(state.global_osi);

  let presetKey = "default";
  let isEPC = false;
  
  if (state.gerencias && state.gerencias.length > 0) {
      if (state.gerencias[0].departments?.length > 0) {
          presetKey = state.gerencias[0].departments[0].meta?.industry_preset || "default";
      }
      
      // Búsqueda Profunda (Deep Scan)
      for (const g of state.gerencias) {
          if (g.departments) {
              for (const d of g.departments) {
                  if (d.meta?.industry_preset === "epc" || d.meta?.gerencia === "Proyectos & Montaje") {
                      isEPC = true;
                  }
              }
          }
      }
  }
  
  const tax = INDUSTRY_PRESETS_UI[presetKey] || INDUSTRY_PRESETS_UI["default"];
  const clientName = tax.client_name || (presetKey === "puma" ? "PUMA" : "Cliente");
  const headerEyebrow = tax.header_eyebrow || `${tax.product_line || "Planificador de Unidades"} - Perfil ${tax.domain_label || "adaptable"}`;
  const headerTitle = tax.header_title || `Direccion Ejecutiva ${clientName}`;
  const headerSubtitle = tax.header_subtitle || "Lectura consolidada de unidades, avance, costos, documentacion y escenarios para corregir rumbo.";
  const seedLabel = tax.seed_label || (presetKey === "puma" ? "Actualizar Cliente PUMA" : "Actualizar Unidades");
  const seedLoadingLabel = tax.seed_loading_label || "Actualizando unidades...";
  const scenarioLabel = tax.scenario_label || "Proyectar Riesgo (+30 Dias)";
  const scenarioLoadingLabel = tax.scenario_loading_label || "Calculando escenario...";
  const seedCompany = presetKey === "technical_office" || presetKey === "family" || presetKey === "puma" ? presetKey : "technical_office";
  const activeHid = hid || state.gerencias?.[0]?.departments?.[0]?.id || "";

  return (
    <div className="grid" style={{ gap: 20 }}>
      {/* HEADER CORPORATIVO */}
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div>
          <div className="cardTitle">{headerEyebrow}</div>
          <div className="big" style={{ fontSize: 32 }}>{headerTitle}</div>
          <div className="small">{headerSubtitle}</div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <PrintButton />
          <form action={async () => {
            "use server";
            try {
              const seeded = await seedCeo(seedCompany);
              if (seeded?.active_household_id) {
                const store = await cookies();
                store.set("hid", seeded.active_household_id, { path: "/", sameSite: "lax" });
              }
            } catch (e) {
              const store = await cookies();
              store.delete("vantdomus_access_token");
              store.delete("vantdomus_session_id");
            }
            revalidatePath("/ceo");
          }}>
            <SubmitButton 
              label={seedLabel} 
              loadingLabel={seedLoadingLabel} 
              bg="#e11d48" 
              color="#fff" 
            />
          </form>
          <form action={async () => {
            "use server";
            try {
              await fastForwardCeo(30);
            } catch (e) {
              const store = await cookies();
              store.delete("vantdomus_access_token");
              store.delete("vantdomus_session_id");
            }
            revalidatePath("/ceo");
          }}>
            <SubmitButton 
              label={scenarioLabel} 
              loadingLabel={scenarioLoadingLabel} 
              bg="#e74c3c" 
              color="#fff" 
            />
          </form>
        </div>
      </div>

      <section style={{ border: "1px solid rgba(148,163,184,0.22)", borderRadius: 12, padding: "14px 16px", background: "rgba(15,23,42,0.42)" }}>
        <div className="row" style={{ alignItems: "center", gap: 14, justifyContent: "space-between", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900, color: "#e5e7eb" }}>Perfil activo: {tax.product_line || "VantDomus adaptable"}</div>
            <div className="small">
              {tax.domain_label || "Operacion transversal"} · El tipo de VantDomus se administra desde Ajustes Cliente.
            </div>
          </div>
          <a
            className="btn"
            href={activeHid ? `/settings/${activeHid}` : "/"}
            style={{ borderColor: "var(--primary)", color: "var(--primary)", textDecoration: "none" }}
          >
            Cambiar en Ajustes Cliente
          </a>
        </div>
      </section>

      <InteractiveDashboard initialState={state} tax={tax} isEPC={isEPC} hid={activeHid} />

      {/* HEATMAP OPERATIVO (Gerencias) */}
      <details className="card" style={{ marginTop: 18, border: "1px solid rgba(148,163,184,0.24)", background: "rgba(255,255,255,0.025)" }}>
      <summary style={{ cursor: "pointer", fontWeight: 900, fontSize: 18 }}>{tax.unit_map_title || "Gerencias y unidades operativas"}</summary>
      <div className="sectionTitle" style={{ fontSize: 20, marginTop: 18 }}>{tax.drilldown_title || "Drill-down: unidades, gerencias y responsables"}</div>
      
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
        {state.gerencias.map((g: any) => {
          const s = getHsiStyle(g.macro_osi);
          return (
            <div key={g.name} className="card" style={{ borderLeft: `6px solid ${s.color}`, display: "flex", flexDirection: "column" }}>
              <div style={{ marginBottom: 14 }}>
                <div className="row" style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: "bold", fontSize: 18 }}>{g.name}</div>
                  <div className={s.cls} style={{ fontSize: 16 }}>{g.macro_osi}%</div>
                </div>
                
                <div className="row" style={{ marginBottom: 6 }}>
                  <div className="small">{tax.kpi.health}:</div>
                  <div className="small" style={{ fontWeight: "bold" }}>{g.macro_health}%</div>
                </div>
                <div className="row" style={{ marginBottom: 6 }}>
                  <div className="small">{tax.kpi.tasks}:</div>
                  <div className="small" style={{ fontWeight: "bold" }}>{g.macro_task}%</div>
                </div>
                <div className="row">
                  <div className="small">{tax.kpi.finance}:</div>
                  <div className="small" style={{ fontWeight: "bold" }}>{g.macro_finance}%</div>
                </div>
                {g.penalty_applied && (
                  <div className="small bad" style={{ marginTop: 8, fontStyle: "italic" }}>
                    * Penalización interna: Unidad inferior a 60% detectada.
                  </div>
                )}
              </div>
              
              <div style={{ padding: "10px", background: "rgba(255,255,255,0.02)", borderRadius: 6, flex: 1 }}>
                <div className="small" style={{ marginBottom: 8, opacity: 0.7 }}>UNIDADES OPERATIVAS:</div>
                <div className="grid" style={{ gap: 6 }}>
                  {g.departments.map((d: any) => {
                    const ds = getHsiStyle(d.hsi);
                    return (
                      <a key={d.id} href={`/dashboard/${d.id}`} className="row card" style={{ padding: "6px 10px", textDecoration: "none", border: "1px solid var(--line)", cursor: "pointer", transition: "border-color 0.2s" }}>
                        <span className="small" style={{ color: "var(--text)" }}>{d.name}</span>
                        <span className="small" style={{ color: ds.color, fontWeight: "bold" }}>{d.hsi}% ➔</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
        {state.gerencias.length === 0 && (
          <div className="small" style={{ gridColumn: "span 3", opacity: 0.6 }}>No hay unidades detectadas. Actualiza el cliente para inicializar el planificador.</div>
        )}
      </div>
      </details>

    </div>
  );
}
