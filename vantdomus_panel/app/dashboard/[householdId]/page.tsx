import { getDashboard, seedDemo, getScores, getAssistant, applyAssistant } from "../../../lib/api";

function pillForHSI(hsi: number) {
  if (hsi >= 80) return { cls: "pill good", label: "Stable" };
  if (hsi >= 60) return { cls: "pill warn", label: "At Risk" };
  return { cls: "pill bad", label: "Critical" };
}

export default async function Dashboard({ params }: { params: { householdId: string } }) {
  const hid = params.householdId;

  const dash = await getDashboard(hid);
  const scores = await getScores(hid).catch(() => ({ exists: false }));
  const asst = await getAssistant(hid).catch(() => ({ items: [] }));

  const f = dash.features || (scores.exists ? scores : null);
  const hsi = f?.hsi ?? 0;
  const pill = pillForHSI(hsi);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div>
          <div className="cardTitle">Unidad Operativa</div>
          <div className="big" style={{ fontSize: 28 }}>{dash.household.name}</div>
          <div className="small">{dash.household.id}</div>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <form
            action={async (fd: FormData) => {
              "use server";
              const mode = String(fd.get("mode") || "home") as "home" | "team";
              await seedDemo(hid, mode);
            }}
          >
            <select className="input" name="mode" defaultValue="home" style={{ marginRight: 8 }}>
              <option value="home">Demo Unidad</option>
              <option value="team">Demo Cuadrilla</option>
            </select>
            <button className="btn btnPrimary" type="submit">Cargar Demo</button>
          </form>

          <a className="btn" href={`/ tasks / ${hid} `}>Ir a Tasks</a>
          <a className="btn" href={`/ finance / ${hid} `}>Ir a Finance</a>
        </div>
      </div>

      <div className="grid kpiGrid">
        <div className="card" style={{ gridColumn: "span 4" }}>
          <div className="row">
            <div>
              <div className="cardTitle">Operational Stability Index (OSI)</div>
              <div className="big">{hsi}</div>
              <div className={pill.cls}>{pill.label}</div>
            </div>
            <div className="pill">{f?.mode || (dash.household.meta?.mode ?? "home")}</div>
          </div>
          <div className="footerNote">
            ML-ready: features_daily + snapshots (hoy heurístico, mañana modelo).
          </div>
        </div>

        <div className="card" style={{ gridColumn: "span 2" }}>
          <div className="cardTitle">Seguridad/Salud</div>
          <div className="big">{f?.health_score ?? 0}</div>
          <div className="small">missed 7d: {f?.missed_7d ?? 0}</div>
        </div>

        <div className="card" style={{ gridColumn: "span 3" }}>
          <div className="cardTitle">Operaciones</div>
          <div className="big">{f?.task_score ?? 0}</div>
          <div className="small">
            done 7d: {f?.tasks_done_7d ?? 0} · overdue: {f?.tasks_overdue ?? 0}
          </div>
        </div>

        <div className="card" style={{ gridColumn: "span 3" }}>
          <div className="cardTitle">Insumos/Presupuesto</div>
          <div className="big">{f?.finance_score ?? 0}</div>
          <div className="small">
            spend 30d: {Math.round(((f?.spend_30d_total ?? 0) as number) * 100) / 100}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <div className="sectionTitle">Planning Assistant</div>
          <form action={async () => { "use server"; await getAssistant(hid, true); }}>
            <button className="btn" type="submit">Refresh</button>
          </form>
        </div>

        <div className="small">Recomendaciones + Aplicar ⇒ crea tareas automáticamente.</div>

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
          B: aplica y crea tareas · D: contrato listo para IA conversacional.
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.2fr .8fr", gap: 14 }}>
        <div className="card">
          <div className="row">
            <div className="sectionTitle">Alerts</div>
            <div className="pill">{dash.alerts.filter((a: any) => a.status === "open").length} open</div>
          </div>

          <table className="table">
            <thead>
              <tr><th>Severity</th><th>Title</th><th>Status</th><th>Created</th></tr>
            </thead>
            <tbody>
              {dash.alerts.slice(0, 10).map((a: any) => (
                <tr key={a.id}>
                  <td>
                    <span className={a.severity === "high" ? "pill bad" : a.severity === "medium" ? "pill warn" : "pill"}>
                      {a.severity}
                    </span>
                  </td>
                  <td>
                    {a.title}
                    <div className="small">{a.message}</div>
                  </td>
                  <td className="small">{a.status}</td>
                  <td className="small">{a.created_at}</td>
                </tr>
              ))}
              {dash.alerts.length === 0 ? (
                <tr><td colSpan={4} className="small">Sin alertas.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="sectionTitle">Personal Operativo</div>
          <div className="small">Drill-down de seguridad y control de fatiga.</div>

          <div style={{ marginTop: 10 }}>
            {dash.persons.map((p: any) => (
              <a
                key={p.id}
                className="btn"
                href={`/ persons / ${p.id}/health?hid=${hid}`}
                style={{ width: "100%", marginBottom: 10, justifyContent: "space-between" }}
              >
                <span>
                  <b>{p.display_name}</b> <span className="small">{p.relation || ""}</span>
                </span>
                <span className="small">Ver</span>
              </a >
            ))}
            {dash.persons.length === 0 ? <div className="small">Sin personal asignado aún.</div> : null}
          </div >
        </div >
      </div >

      <div className="footerNote">
        v0.4 completo: Salud + Tasks + Finance + HSI + Planning Assistant (B+D).
      </div>
    </div >
  );
}
