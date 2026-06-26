import { getDashboard, getScores } from "../../../lib/api";
import { INDUSTRY_PRESETS_UI } from "../../../lib/taxonomy";
import SmartInboxPanel from "./SmartInboxPanel";

export default async function EsgDashboard({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId: hid } = await params;
  const dash = await getDashboard(hid).catch(() => null);
  const scores = await getScores(hid).catch(() => ({ exists: false }));

  if (!dash) {
    return (
      <div className="card bad" style={{ padding: 30, textAlign: "center" }}>
        Unidad Operativa no encontrada o sin acceso ESG.
      </div>
    );
  }

  const f = dash.features || (scores.exists ? scores : null) || {};
  const esg = f.esg || { e_score: 0, s_score: 0, g_score: 0, esg_global: 0, female_workforce_pct: 0, water_desalinated_pct: 0, emissions_sox_tonnes: 0, community_incidents: 0 };
  
  const presetKey = dash.household.meta?.industry_preset || "default";
  const tax = INDUSTRY_PRESETS_UI[presetKey] || INDUSTRY_PRESETS_UI["default"];
  const isFamily = Boolean(tax.family_mode);
  const docScore = Number(esg.e_score || 0);
  const benefitScore = Number(esg.s_score || 0);
  const globalScore = Number(esg.esg_global || 0);
  const criticalDocs = Math.max(0, Math.round((100 - docScore) / 18));
  const upcomingDeadlines = Math.max(1, Math.round((100 - globalScore) / 22));
  const availableBenefits = Math.max(1, Math.round(benefitScore / 12));
  const familyActions = [
    {
      title: "Subir documentos criticos",
      body: "Polizas, garantias, recetas, certificados escolares, contratos, boletas y documentos legales con fecha de vencimiento.",
      href: `/settings/${hid}/audit`,
      cta: "Abrir repositorio",
      color: "#10b981",
    },
    {
      title: "Crear recordatorios",
      body: "Transforma vencimientos en tareas: renovar seguro, pagar permiso, llevar control medico o preparar documento escolar.",
      href: `/tasks/${hid}`,
      cta: "Ir a agenda",
      color: "#38bdf8",
    },
    {
      title: "Revisar impacto en presupuesto",
      body: "Cruza beneficios, descuentos y pagos pendientes para evitar pagar de mas o repetir compras sin respaldo.",
      href: `/finance/${hid}`,
      cta: "Ver finanzas",
      color: "#f59e0b",
    },
  ];

  const getPill = (score: number) => {
    if (isFamily) {
      if (score >= 80) return { cls: "pill good", label: "Documentos al dia" };
      if (score >= 60) return { cls: "pill warn", label: "Vencimientos por revisar" };
      return { cls: "pill bad", label: "Documento / beneficio critico" };
    }
    if (score >= 80) return { cls: "pill good", label: "Aprobado (SASB/GRI)" };
    if (score >= 60) return { cls: "pill warn", label: "Alerta Regulatoria" };
    return { cls: "pill bad", label: "Infracción / Multa Activa" };
  };

  const pillGlobal = getPill(esg.esg_global);

  return (
    <div className="grid" style={{ gap: 14 }}>
      {/* HEADER ESG */}
      <div className="card" style={{ gridColumn: "span 4" }}>
        <div className="cardTitle">{isFamily ? "Repositorio familiar" : "Reporte Integrado ESG"}</div>
        <div className="big" style={{ fontSize: 26 }}>{tax.esg}</div>
        <div className="small">{isFamily ? `Caja fuerte familiar para polizas, seguros, recetas, boletas, garantias, circulares, beneficios y vencimientos de la ${tax.unit}.` : `Desempeno Sostenible y Cumplimiento Normativo de la ${tax.unit}.`}</div>
      </div>

      {isFamily ? <SmartInboxPanel hid={hid} persons={(dash.persons || []).map((p: any) => ({ id: p.id, display_name: p.display_name }))} /> : null}

      {/* GLOBAL ESG SCORE */}
      <div className="card" style={{ gridColumn: "span 4", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="cardTitle">{isFamily ? "Orden documental y beneficios" : "ESG Score (Consolidado)"}</div>
          <div className="row" style={{ alignItems: "baseline", gap: 12 }}>
            <div className="big" style={{ fontSize: 32 }}>{esg.esg_global}%</div>
          </div>
          <div className={pillGlobal.cls} style={{ marginTop: 4 }}>{pillGlobal.label}</div>
        </div>
        <div style={{ textAlign: "right", opacity: 0.8, maxWidth: 300 }}>
          <div className="small">{isFamily ? "Mide si la familia puede encontrar documentos, anticipar vencimientos y usar beneficios antes de gastar de mas." : "Este puntaje penaliza directamente el EBITDA corporativo si cae por debajo del 80%."}</div>
        </div>
      </div>

      {isFamily && (
        <div className="card" style={{ gridColumn: "span 4", borderColor: "var(--primary)" }}>
          <div className="row" style={{ gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 260px" }}>
              <div className="cardTitle" style={{ color: "var(--primary)", fontWeight: 900 }}>Aporte concreto para la familia</div>
              <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>Menos vencimientos, menos gasto perdido, mas respaldo disponible</div>
              <div className="small" style={{ marginTop: 8, lineHeight: 1.55, maxWidth: 720 }}>
                Este modulo sirve para que la IA recuerde documentos por vencer, encuentre respaldos cuando se necesitan y sugiera beneficios o descuentos antes de pagar.
              </div>
            </div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(150px, 1fr))", gap: 10, flex: "1 1 460px" }}>
              <div className="card" style={{ padding: 12, background: "var(--bg)" }}>
                <div className="small">Faltan por ordenar</div>
                <div className="big" style={{ fontSize: 28, color: "var(--bad)" }}>{criticalDocs}</div>
                <div className="small">documentos criticos</div>
              </div>
              <div className="card" style={{ padding: 12, background: "var(--bg)" }}>
                <div className="small">Proximos 30 dias</div>
                <div className="big" style={{ fontSize: 28, color: "var(--warn)" }}>{upcomingDeadlines}</div>
                <div className="small">vencimientos a revisar</div>
              </div>
              <div className="card" style={{ padding: 12, background: "var(--bg)" }}>
                <div className="small">Ahorro posible</div>
                <div className="big" style={{ fontSize: 28, color: "var(--good)" }}>{availableBenefits}</div>
                <div className="small">beneficios disponibles</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ENVIRONMENTAL (E) */}
      <div className="card" style={{ gridColumn: "span 2", borderTop: "4px solid #10b981" }}>
        <div className="sectionTitle" style={{ color: "#10b981" }}>{isFamily ? "Documentos vigentes" : "E - Medioambiente"}</div>
        <div className="big">{esg.e_score}%</div>
        <div className="small">{isFamily ? "Respaldo disponible cuando la familia lo necesita: salud, colegio, garantia, seguro o tramite." : "Compliance Ambiental Alcance 1 y 2"}</div>
        
        <div style={{ marginTop: 20 }}>
          <div className="row" style={{ marginBottom: 6, justifyContent: "space-between" }}>
            <span className="small"><b>{isFamily ? "Polizas y garantias ordenadas" : "Huella Hidrica (Agua Desalada)"}</b></span>
            <span className="small">{esg.water_desalinated_pct}%</span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.1)", height: 8, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: "#3b82f6", width: `${esg.water_desalinated_pct}%`, height: "100%" }} />
          </div>
          <div className="small" style={{ marginTop: 4, opacity: 0.6 }}>{isFamily ? "Meta: cada documento importante debe tener responsable, fecha y archivo ubicable." : "Meta al 2030: Minimo 60%"}</div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div className="row" style={{ marginBottom: 6, justifyContent: "space-between" }}>
            <span className="small"><b>{isFamily ? "Recetas / controles respaldados" : "Emisiones Atmosfericas (SOx/CO2)"}</b></span>
            <span className="small">{isFamily ? `${Math.round(esg.emissions_sox_tonnes / 1000)} docs` : `${Math.round(esg.emissions_sox_tonnes).toLocaleString()} Toneladas`}</span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.1)", height: 8, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: esg.emissions_sox_tonnes > 80000 ? "#ef4444" : "#f59e0b", width: `${Math.min(100, esg.emissions_sox_tonnes / 1000)}%`, height: "100%" }} />
          </div>
          <div className="small" style={{ marginTop: 4, opacity: 0.6 }}>{isFamily ? "La IA puede leerlos, extraer fechas y proponer recordatorios para controles, recetas o renovaciones." : "Penalizado fuertemente por Tareas CAPEX atrasadas."}</div>
        </div>
      </div>

      {/* SOCIAL (S) */}
      <div className="card" style={{ gridColumn: "span 2", borderTop: "4px solid #f59e0b" }}>
        <div className="sectionTitle" style={{ color: "#f59e0b" }}>{isFamily ? "Beneficios y red de apoyo" : "S - Social & Comunidades"}</div>
        <div className="big">{esg.s_score}%</div>
        <div className="small">{isFamily ? "Descuentos, seguros, convenios, apoyos y oportunidades antes de comprar o contratar." : "Licencia Social para Operar"}</div>

        <div style={{ marginTop: 20 }}>
          <div className="row" style={{ marginBottom: 6, justifyContent: "space-between" }}>
            <span className="small"><b>{isFamily ? "Beneficios detectados" : "Inclusion (Dotacion Femenina)"}</b></span>
            <span className="small">{esg.female_workforce_pct}%</span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.1)", height: 8, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: "#c084fc", width: `${(esg.female_workforce_pct / 35.0) * 100}%`, height: "100%" }} />
          </div>
          <div className="small" style={{ marginTop: 4, opacity: 0.6 }}>{isFamily ? "Meta: que la familia vea opciones de ahorro antes de decidir un gasto." : "Meta Corporativa: 35% de dotacion al 2027."}</div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div className="row" style={{ marginBottom: 6, justifyContent: "space-between" }}>
            <span className="small"><b>{isFamily ? "Alertas familiares relevantes" : "Incidentes Comunitarios (Pueblos Originarios/Local)"}</b></span>
            <span className="small"><b>{esg.community_incidents}</b> {isFamily ? "alertas" : "Reportes Duros"}</span>
          </div>
          <div className="small" style={{ marginTop: 4, opacity: 0.6 }}>{isFamily ? `Basado en ${tax.health}, vencimientos y necesidades de apoyo del nucleo familiar.` : `Basado en la gravedad de la ${tax.health}. Mayor fatiga eleva friccion comunitaria por externalidades negativas.`}</div>
        </div>
      </div>

      {isFamily && (
        <div className="grid" style={{ gridColumn: "span 4", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          {familyActions.map((action) => (
            <a key={action.title} href={action.href} className="card warmAccess" style={{ textDecoration: "none", color: "var(--text)", borderTop: `3px solid ${action.color}`, minHeight: 150 }}>
              <div className="cardTitle" style={{ color: "var(--text)", fontWeight: 800 }}>{action.title}</div>
              <div className="small" style={{ lineHeight: 1.5, marginTop: 8, color: "var(--muted)" }}>{action.body}</div>
              <div className="small" style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--line)", color: action.color, fontWeight: 800 }}>{action.cta} &rarr;</div>
            </a>
          ))}
        </div>
      )}

    </div>
  );
}
