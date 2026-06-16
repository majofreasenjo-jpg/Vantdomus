import { getGerenciaState } from "../../lib/api";
import { INDUSTRY_PRESETS_UI } from "../../lib/taxonomy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GerenciaDashboard() {
  const state = await getGerenciaState().catch(() => ({
    macro_hsi: 0, macro_health: 0, macro_task: 0, macro_finance: 0, 
    departments: [], bottleneck_penalty_applied: false, min_hsi: 0
  }));

  const getHsiStyle = (hsi: number) => {
    if (hsi >= 80) return { cls: "pill good", label: "Estable", color: "var(--good)" };
    if (hsi >= 60) return { cls: "pill warn", label: "En Riesgo", color: "var(--warn)" };
    return { cls: "pill bad", label: "Crítico", color: "var(--bad)" };
  };

  const macroStyle = getHsiStyle(state.macro_hsi);

  let presetKey = "default";
  if (state.departments?.length > 0) {
      presetKey = state.departments[0].meta?.industry_preset || "default";
  }
  const tax = INDUSTRY_PRESETS_UI[presetKey] || INDUSTRY_PRESETS_UI.default;


  return (
    <div className="grid" style={{ gap: 20 }}>
      {/* HEADER CORPORATIVO */}
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div>
          <div className="cardTitle">Centro Operativo</div>
          <div className="big" style={{ fontSize: 32 }}>Gestion de Unidades</div>
          <div className="small">Agregación Fractal no-lineal (Macro-OSI v1.0)</div>
        </div>
      </div>

      {/* MACRO KPIs (Consolidado) */}
      <div className="grid kpiGrid" style={{ gap: 14 }}>
        <div className="card" style={{ gridColumn: "span 4", borderColor: macroStyle.color, boxShadow: `0 0 20px ${macroStyle.color}20` }}>
          <div className="row">
            <div>
              <div className="cardTitle">Macro-OSI (estabilidad de unidades)</div>
              <div className="row" style={{ alignItems: "baseline", gap: 12 }}>
                <div className="big">{state.macro_hsi}%</div>
              </div>
              <div className={macroStyle.cls} style={{ marginTop: 4 }}>{macroStyle.label}</div>
            </div>
            {state.bottleneck_penalty_applied && (
              <div className="pill bad" style={{ padding: "8px 12px", background: "rgba(255,50,50,0.1)" }}>
                ¡Atención! Penalización por Cuello de Botella
              </div>
            )}
          </div>
          <div className="footerNote">
            Consolidado ponderado. Castigo activo si alguna división cae de 60%.
          </div>
        </div>

        <div className="card" style={{ gridColumn: "span 2" }}>
          <div className="cardTitle">{tax.kpi.health}</div>
          <div className="big">{state.macro_health}%</div>
          <div className="small" style={{ marginTop: 4 }}>Promedio de {tax.health}.</div>
        </div>

        <div className="card" style={{ gridColumn: "span 3" }}>
          <div className="cardTitle">{tax.kpi.tasks}</div>
          <div className="big">{state.macro_task}%</div>
          <div className="small" style={{ marginTop: 4 }}>Ejecución holística de iniciativas.</div>
        </div>

        <div className="card" style={{ gridColumn: "span 3" }}>
          <div className="cardTitle">{tax.kpi.finance}</div>
          <div className="big">{state.macro_finance}%</div>
          <div className="small" style={{ marginTop: 4 }}>Burn rate corporativo base.</div>
        </div>
      </div>

      {/* HEATMAP OPERATIVO (Departamentos) */}
      <div className="sectionTitle" style={{ fontSize: 20 }}>Drill-down: mapa de unidades</div>
      
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {state.departments.map((dept: any) => {
          const s = getHsiStyle(dept.hsi);
          return (
            <a key={dept.id} href={`/dashboard/${dept.id}`} className="card" style={{ textDecoration: "none", cursor: "pointer", borderLeft: `4px solid ${s.color}`, transition: "transform 0.2s", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div className="row" style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: "bold", fontSize: 16 }}>{dept.name}</div>
                  <div className={s.cls}>{dept.hsi}%</div>
                </div>
                
                <div className="row" style={{ marginBottom: 6 }}>
                  <div className="small">{tax.kpi.health}:</div>
                  <div className="small" style={{ fontWeight: "bold" }}>{dept.health_score}%</div>
                </div>
                <div className="row" style={{ marginBottom: 6 }}>
                  <div className="small">{tax.kpi.tasks}:</div>
                  <div className="small" style={{ fontWeight: "bold" }}>{dept.task_score}%</div>
                </div>
                <div className="row">
                  <div className="small">{tax.kpi.finance}:</div>
                  <div className="small" style={{ fontWeight: "bold" }}>{dept.finance_score}%</div>
                </div>
              </div>
              
              <div className="small" style={{ marginTop: 14, color: "var(--primary)", textAlign: "right" }}>
                Inspeccionar detalle ➔
              </div>
            </a>
          );
        })}
        {state.departments.length === 0 && (
          <div className="small" style={{ gridColumn: "span 3", opacity: 0.6 }}>No hay unidades asociadas a esta vista.</div>
        )}
      </div>

    </div>
  );
}
