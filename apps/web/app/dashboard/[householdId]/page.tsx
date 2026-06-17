import { getDashboard, seedDemo, getScores, getAssistant, applyAssistant, getHouseholds } from "../../../lib/api";
import { INDUSTRY_PRESETS_UI } from "../../../lib/taxonomy";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function pillForHSI(hsi: number) {
  if (hsi >= 80) return { cls: "pill good", label: "Stable" };
  if (hsi >= 60) return { cls: "pill warn", label: "At Risk" };
  return { cls: "pill bad", label: "Critical" };
}

export default async function Dashboard({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { householdId: hid } = await params;
  const { view = "overview" } = await searchParams;

  let dash;
  try {
    dash = await getDashboard(hid);
  } catch (error) {
    let fallbackId = "";
    try {
      const households = await getHouseholds();
      const items = households.items || [];
      fallbackId = items[0]?.id || "";
    } catch {}
    if (fallbackId && fallbackId !== hid) {
      redirect(`/dashboard/${fallbackId}`);
    }
    return (
      <div className="grid">
        <div className="card bad" style={{ padding: 30, textAlign: "center", border: "1px solid var(--bad)" }}>
          <div className="cardTitle" style={{ color: "var(--bad)" }}>Acceso Denegado o Unidad Borrada</div>
          <div style={{ marginTop: 10 }}>El departamento que buscas ya no existe o no tienes permisos (Error de seguridad VantDomus).</div>
          <a href="/ceo" className="btn" style={{ marginTop: 20, display: "inline-block" }}>← Volver a Direccion</a>
        </div>
      </div>
    );
  }

  const scores = await getScores(hid).catch(() => ({ exists: false }));
  const asst = await getAssistant(hid).catch(() => ({ items: [] }));

  const f = dash.features || (scores.exists ? scores : null);
  const hsi = f?.hsi ?? 0;
  const pill = pillForHSI(hsi);
  const presetKey = dash.household.meta?.industry_preset || "default";
  const tax = INDUSTRY_PRESETS_UI[presetKey] || INDUSTRY_PRESETS_UI["default"];
  const isFamily = Boolean(tax.family_mode);

  // === ONBOARDING FAMILIA ===
  // Cuando es un hogar familia recién creado y NO tiene integrantes ni datos,
  // mostramos un wizard de bienvenida en vez del dashboard técnico vacío.
  const isEmptyFamily =
    isFamily &&
    (dash.persons?.length ?? 0) === 0 &&
    (dash.alerts?.length ?? 0) === 0;

  if (isEmptyFamily) {
    return (
      <div className="grid" style={{ gap: 18 }}>
        <div
          className="card"
          style={{
            padding: 32,
            background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))",
            border: "1px solid rgba(16,185,129,0.3)",
          }}
        >
          <div className="cardTitle" style={{ fontSize: 32, color: "var(--primary)" }}>
            🏡 Bienvenido a tu hogar
          </div>
          <p style={{ fontSize: 16, lineHeight: 1.6, marginTop: 8, opacity: 0.9 }}>
            VantDomus va a ayudarte a organizar tareas, recordar medicamentos, agendar el colegio y
            cuidar de quienes te importan. Para empezar, necesitamos saber un poquito más de tu familia.
          </p>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 24 }}>👥</div>
            <div className="sectionTitle" style={{ marginTop: 8 }}>1. Agregá integrantes</div>
            <p className="small" style={{ marginTop: 6, lineHeight: 1.5 }}>
              Mamá, papá, hijos, abuelos. Cualquiera que viva en casa o que cuides desde lejos.
            </p>
            <a className="btn btnPrimary" href={`/settings/${hid}/members`} style={{ marginTop: 12, display: "inline-block" }}>
              Agregar familia →
            </a>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 24 }}>💊</div>
            <div className="sectionTitle" style={{ marginTop: 8 }}>2. Medicamentos</div>
            <p className="small" style={{ marginTop: 6, lineHeight: 1.5 }}>
              Si alguien toma medicación, configurá horarios y vamos a recordarle (y avisarte si la olvida).
            </p>
            <a className="btn" href={`/health/${hid}`} style={{ marginTop: 12, display: "inline-block" }}>
              Salud →
            </a>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 24 }}>📅</div>
            <div className="sectionTitle" style={{ marginTop: 8 }}>3. Agenda y colegio</div>
            <p className="small" style={{ marginTop: 6, lineHeight: 1.5 }}>
              Subí circulares del colegio o pegá fechas de pruebas — generamos recordatorios escalonados.
            </p>
            <a className="btn" href={`/tasks/${hid}`} style={{ marginTop: 12, display: "inline-block" }}>
              Agenda →
            </a>
          </div>
        </div>

        <div className="card" style={{ padding: 20, background: "rgba(255,255,255,0.03)" }}>
          <div className="sectionTitle">¿Querés probar primero con un ejemplo?</div>
          <p className="small" style={{ marginTop: 6 }}>
            Cargá la "familia de muestra" — 4 integrantes, medicación de la abuela, prueba escolar del hijo,
            gastos del mes. Podés borrar todo después.
          </p>
          <form
            action={async (fd: FormData) => {
              "use server";
              try {
                await seedDemo(hid, "home");
                revalidatePath(`/dashboard/${hid}`);
              } catch (e) {
                console.error("Error al Cargar demo familia:", e);
              }
            }}
          >
            <button className="btn btnPrimary" type="submit" style={{ marginTop: 12 }}>
              ✨ Cargar familia de muestra
            </button>
          </form>
        </div>
      </div>
    );
  }

  const viewLabels = isFamily
    ? {
        overview: "Resumen familiar",
        hsec: "Bienestar / Salud",
        ops: "Rutinas y apoyo",
        finance: "Presupuesto",
        alertTitle: "Monitor familiar",
        emptyAlert: "Nucleo familiar sin alertas criticas.",
        hsecTitle: "Bienestar, salud y red de cuidado",
        hsecText: "Integrantes asociados al hogar. Revisa medicamentos, controles, descanso, apoyo senior y evidencias de cuidado.",
        financeTitle: "Presupuesto familiar y beneficios",
        financeText: "Centraliza gastos del hogar, vencimientos, seguros, beneficios, compras y respaldos importantes.",
        financeCta: "Abrir Finanzas del Hogar",
        demoHome: "Demo hogar familiar",
        demoTeam: "Demo red de apoyo",
      }
    : {
        overview: "Resumen ejecutivo",
        hsec: "Seguridad / HSE",
        ops: "Operacion",
        finance: "Costos",
        alertTitle: "Monitor de alertas operativas",
        emptyAlert: "Unidad sin alertas criticas.",
        hsecTitle: "Seguimiento de seguridad y responsables",
        hsecText: "Responsables asociados a la unidad. Accede a sus historiales para revisar evidencias, controles y acciones preventivas.",
        financeTitle: "Libro mayor de la unidad",
        financeText: "Centraliza ordenes de compra, facturacion, gastos, presupuesto y respaldos financieros.",
        financeCta: "Acceder a control financiero",
        demoHome: "Demo unidad ejecutiva",
        demoTeam: "Demo equipo operativo",
      };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div>
          <a href="/ceo" style={{ color: "var(--warn)", textDecoration: "none", fontSize: 13, marginBottom: 8, display: "inline-block", fontWeight: "bold" }}>
            ← Volver a Direccion Ejecutiva
          </a>
          <div className="cardTitle">{tax.unit}</div>
          <div className="big" style={{ fontSize: 28 }}>{dash.household.name}</div>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <form
            action={async (fd: FormData) => {
              "use server";
              try {
                const mode = String(fd.get("mode") || "home") as "home" | "team";
                await seedDemo(hid, mode);
                revalidatePath(`/dashboard/${hid}`);
              } catch (e) {
                console.error("Error al Cargar datos de ejemplo:", e);
              }
            }}
          >
            <select className="input" name="mode" defaultValue="home" style={{ marginRight: 8 }}>
              <option value="home">{viewLabels.demoHome}</option>
              <option value="team">{viewLabels.demoTeam}</option>
            </select>
            <button className="btn btnPrimary" type="submit">Cargar datos de ejemplo</button>
          </form>

          <a className="btn" href={`/tasks/${hid}`}>Ir a {tax.tasks}</a>
          <a className="btn" href={`/finance/${hid}`}>Ir a {tax.finance}</a>
        </div>
      </div>

      {/* NAVEGACION POR VISTAS */}
      <div style={{ display: "flex", gap: 12, borderBottom: "1px solid var(--line)", paddingBottom: 12, marginBottom: 12 }}>
         <a href={`?view=overview`} className={`btn ${view === "overview" ? "btnPrimary" : ""}`} style={{ borderRadius: 20 }}>{viewLabels.overview}</a>
         <a href={`?view=hsec`} className={`btn ${view === "hsec" ? "btnPrimary" : ""}`} style={{ borderRadius: 20 }}>{viewLabels.hsec}</a>
         <a href={`?view=ops`} className={`btn ${view === "ops" ? "btnPrimary" : ""}`} style={{ borderRadius: 20 }}>{viewLabels.ops}</a>
         <a href={`?view=finance`} className={`btn ${view === "finance" ? "btnPrimary" : ""}`} style={{ borderRadius: 20 }}>{viewLabels.finance}</a>
      </div>

      {/* === VISTA: Resumen ejecutivo === */}
      {view === "overview" && (
        <>
          <div className="grid kpiGrid">
            <div className="card" style={{ gridColumn: "span 4" }}>
              <div className="row">
                <div>
                  <div className="cardTitle">{tax.kpi.osi}</div>
                  <div className="row" style={{ alignItems: "baseline", gap: 12 }}>
                    <div className="big">{hsi}%</div>
                    <div className="small" style={{ color: "var(--muted)" }}>± {f?.hsi_margin ?? 0}% (Conf. 95%)</div>
                  </div>
                  <div className={pill.cls} style={{ marginTop: 4 }}>{pill.label}</div>
                </div>
                <div className="pill">{f?.mode || (dash.household.meta?.mode ?? "home")}</div>
              </div>
              <div className="footerNote">
                <span style={{ fontWeight: "bold", color: "var(--primary)" }}>Sub-KPI: </span>{tax.kpi_sub ? tax.kpi_sub.osi : "Machine Learning Ready"}
              </div>
            </div>

            <div className="card" style={{ gridColumn: "span 2" }}>
              <div className="cardTitle">{tax.health}</div>
              <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
                <div className="big">{f?.health_score ?? 0}%</div>
                <div className="pill" style={{ opacity: 0.8, backgroundColor: "transparent", borderWidth: 1, borderColor: "var(--line)" }}>± {f?.health_margin ?? 0}%</div>
              </div>
              <div className="small" style={{ marginTop: 4 }}>
                <span style={{ fontWeight: "bold", color: "var(--primary)" }}>[{tax.kpi.health}]</span> {f?.missed_7d ?? 0} fallos · N: {f?.total_meds_7d ?? 0}
              </div>
              <div className="small" style={{ marginTop: 4, fontStyle: "italic", opacity: 0.8 }}>
                ↪ {tax.kpi_sub ? tax.kpi_sub.health : "Métricas de Salud"}
              </div>
            </div>

            <div className="card" style={{ gridColumn: "span 3" }}>
              <div className="cardTitle">{tax.tasks}</div>
              <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
                <div className="big">{f?.task_score ?? 0}%</div>
                <div className="pill" style={{ opacity: 0.8, backgroundColor: "transparent", borderWidth: 1, borderColor: "var(--line)" }}>± {f?.task_margin ?? 0}%</div>
              </div>
              <div className="small" style={{ marginTop: 4 }}>
                <span style={{ fontWeight: "bold", color: "var(--primary)" }}>[{tax.kpi.tasks}]</span> resueltos: {f?.tasks_done_7d ?? 0} · criticidad: {f?.tasks_overdue ?? 0}
              </div>
              <div className="small" style={{ marginTop: 4, fontStyle: "italic", opacity: 0.8 }}>
                ↪ {tax.kpi_sub ? tax.kpi_sub.tasks : "Rendimiento Operativo"}
              </div>
            </div>

            <div className="card" style={{ gridColumn: "span 3" }}>
              <div className="cardTitle">{tax.finance}</div>
              <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
                <div className="big">{f?.finance_score ?? 0}%</div>
                <div className="pill" style={{ opacity: 0.8, backgroundColor: "transparent", borderWidth: 1, borderColor: "var(--line)" }}>± {f?.finance_margin ?? 0}%</div>
              </div>
              <div className="small" style={{ marginTop: 4 }}>
                <span style={{ fontWeight: "bold", color: "var(--primary)" }}>[{tax.kpi.finance}]</span> TTD: {Math.round(((f?.spend_30d_total ?? 0) as number) * 100) / 100}
              </div>
              <div className="small" style={{ marginTop: 4, fontStyle: "italic", opacity: 0.8 }}>
                ↪ {tax.kpi_sub ? tax.kpi_sub.finance : "Flujo OPEX/CAPEX"}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <div className="row">
              <div className="sectionTitle">{viewLabels.alertTitle}</div>
              <div className="pill">{dash.alerts.filter((a: any) => a.status === "open").length} activas</div>
            </div>

            <table className="table">
              <thead>
                <tr><th>Severidad</th><th>Asunto / Reporte</th><th>Estado</th><th>Apertura</th></tr>
              </thead>
              <tbody>
                {dash.alerts.slice(0, 5).map((a: any) => (
                  <tr key={a.id}>
                    <td>
                      <span className={a.severity === "high" ? "pill bad" : a.severity === "medium" ? "pill warn" : "pill"}>
                        {a.severity.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {a.title}
                      <div className="small">{a.message}</div>
                    </td>
                    <td className="small">{a.status}</td>
                    <td className="small">{new Date(a.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {dash.alerts.length === 0 ? (
                  <tr><td colSpan={4} className="small" style={{ textAlign: "center", padding: 16 }}>{viewLabels.emptyAlert}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* === VISTA: OPERACIONES & TAREAS === */}
      {view === "ops" && (

      <div className="card">
        <div className="row">
          <div className="sectionTitle">Asistente de planificacion</div>
          <form action={async () => { "use server"; await getAssistant(hid, true); }}>
            <button className="btn" type="submit">Actualizar</button>
          </form>
        </div>

        <div className="small">Recomendaciones accionables. Al aplicar, VantDomus crea tareas automaticamente.</div>

        <div style={{ marginTop: 10 }}>
          {asst.items?.length ? asst.items.slice(0, 6).map((r: any) => (
            <div key={r.id} className="card" style={{ marginBottom: 10, padding: 12 }}>
              <div className="row">
                <div>
                  <div className="row" style={{ gap: 8, justifyContent: "flex-start" }}>
                    <span className="pill">{r.kind}</span>
                    <span className="pill warn">impact {r.impact}</span>
                  </div>
                  <div style={{ marginTop: 6 }}><b>{r.title}</b></div>
                  <div className="small">{r.rationale}</div>
                </div>

                <form action={async () => { "use server"; await applyAssistant(hid, r.id); }}>
                  <button className="btn btnPrimary" type="submit">Aplicar</button>
                </form>
              </div>
            </div>
          )) : <div className="small">No hay recomendaciones abiertas.</div>}
        </div>

        <div className="footerNote">
          Las recomendaciones quedan trazables para auditoria y seguimiento.
        </div>
      </div>

      )}

      {/* === VISTA: HSEC Y PREVENCIÓN === */}
      {view === "hsec" && (
        <div className="grid">
          <div className="card">
            <div className="sectionTitle">{viewLabels.hsecTitle}</div>
            <div className="small" style={{ marginBottom: 16 }}>{viewLabels.hsecText}</div>

            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {dash.persons.map((p: any) => (
                <div key={p.id} className="card" style={{ background: "rgba(255,255,255,0.02)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <b>{p.display_name}</b> <span className="small" style={{ color: "var(--primary)", display: "block" }}>{p.relation || (isFamily ? "Integrante" : "Operario")}</span>
                  </div>
                  <a className="btn btnPrimary" href={`/persons/${p.id}/health?hid=${hid}`}>Revisar controles</a>
                </div>
              ))}
              {dash.persons.length === 0 ? <div className="small">{isFamily ? "Sin integrantes registrados en este nucleo." : "Sin personal asignado a este proyecto."}</div> : null}
            </div>
          </div>
        </div>
      )}

      {/* === VISTA: FINANZAS Y PRESUPUESTO === */}
      {view === "finance" && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
           <div className="big" style={{ fontSize: 28, marginBottom: 12 }}>{viewLabels.financeTitle}</div>
           <div className="small" style={{ marginBottom: 24, maxWidth: 400, margin: "0 auto", opacity: 0.8 }}>{viewLabels.financeText}</div>
           <a className="btn btnPrimary" style={{ padding: "12px 24px", fontSize: 16 }} href={`/finance/${hid}`}>{viewLabels.financeCta}</a>
        </div>
      )}

      <div className="footerNote" style={{ marginTop: 24 }}>
        Centro operativo distribuido. Visualizacion focalizada para direccion y responsables del cliente.
      </div>
    </div>
  );
}
