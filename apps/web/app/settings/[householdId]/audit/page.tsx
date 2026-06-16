import { getOperationalStatus, listAssistantActions, listAuditEvents } from "../../../../lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AuditPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId: hid } = await params;
  const [audit, assistant, operational] = await Promise.all([
    listAuditEvents(hid, 100).catch(() => ({ items: [] })),
    listAssistantActions(hid, 100).catch(() => ({ items: [] })),
    getOperationalStatus(hid).catch(() => null),
  ]);
  const components = operational?.components || {};
  const componentItems = [
    ["database", "Base de datos"],
    ["redis", "Rate limit"],
    ["clamav", "ClamAV"],
    ["backups", "Backups"],
    ["security_event_chain", "Cadena eventos"],
  ].map(([key, label]) => ({ key, label, value: components[key] || { ok: false, status: "sin datos" } }));

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div>
          <div className="cardTitle" style={{ color: "var(--primary)", fontWeight: "bold" }}>Auditoria de Seguridad</div>
          <div className="big" style={{ fontSize: 28 }}>Bitacora de Blindaje</div>
          <div className="small">Eventos sensibles, mutaciones de datos y acciones ejecutadas por VantDomus IA.</div>
          <div className="small" style={{ marginTop: 6 }}>Unidad: <code>{hid}</code></div>
        </div>
        <a className="btn" href={`/settings/${hid}`}>Volver a configuracion</a>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div className="row" style={{ alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div className="sectionTitle" style={{ margin: 0 }}>Estado Operacional</div>
            <div className="small">Controles activos, respaldos y eventos criticos recientes.</div>
          </div>
          <span className={operational?.ok ? "pill good" : "pill warn"}>{operational?.ok ? "OK" : "Revisar"}</span>
        </div>
        <div className="grid cols4" style={{ gap: 12 }}>
          {componentItems.map((component) => (
            <div key={component.key} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, minHeight: 96 }}>
              <div className="row" style={{ alignItems: "center", marginBottom: 8 }}>
                <div className="cardTitle">{component.label}</div>
                <span className={component.value.ok ? "pill good" : "pill warn"}>{component.value.status}</span>
              </div>
              <div className="small">
                {component.key === "backups" && component.value.latest_backup
                  ? `${component.value.latest_backup} (${component.value.encrypted ? "cifrado" : "plano"})`
                  : component.value.detail || component.value.integrity || component.value.mode || "-"}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <div className="cardTitle" style={{ marginBottom: 8 }}>Eventos high/critical recientes</div>
          <div className="grid" style={{ gap: 8 }}>
            {(operational?.recent_high_severity_events || []).slice(0, 5).map((event: any) => (
              <div key={event.id} className="row" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10 }}>
                <div>
                  <div><span className={event.severity === "critical" ? "pill warn" : "pill"}>{event.severity}</span> {event.event_type}</div>
                  <div className="small">{event.source} · {new Date(event.created_at).toLocaleString()}</div>
                </div>
                <code className="small">{JSON.stringify(event.metadata || {})}</code>
              </div>
            ))}
            {(!operational?.recent_high_severity_events || operational.recent_high_severity_events.length === 0) && (
              <div className="small" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>Sin eventos criticos recientes.</div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="sectionTitle" style={{ padding: 16, margin: 0, borderBottom: "1px solid var(--line)" }}>Eventos de Datos</div>
        <table className="table" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Accion</th>
              <th>Recurso</th>
              <th>Organizacion</th>
              <th>ID</th>
              <th>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {audit.items.map((item: any) => (
              <tr key={item.id}>
                <td className="small">{new Date(item.created_at).toLocaleString()}</td>
                <td><span className="pill good">{item.action}</span></td>
                <td>{item.resource_type}</td>
                <td className="small">{item.organization_id || "-"}</td>
                <td className="small">{item.resource_id || "-"}</td>
                <td className="small"><code>{JSON.stringify(item.metadata || {})}</code></td>
              </tr>
            ))}
            {audit.items.length === 0 && (
              <tr><td colSpan={6} className="small" style={{ padding: 18, textAlign: "center" }}>Sin eventos registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="sectionTitle" style={{ padding: 16, margin: 0, borderBottom: "1px solid var(--line)" }}>Acciones del Asistente IA</div>
        <table className="table" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tool</th>
              <th>Estado</th>
              <th>Argumentos</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {assistant.items.map((item: any) => (
              <tr key={item.id}>
                <td className="small">{new Date(item.created_at).toLocaleString()}</td>
                <td>{item.tool_name}</td>
                <td><span className={item.status === "success" ? "pill good" : "pill warn"}>{item.status}</span></td>
                <td className="small"><code>{JSON.stringify(item.arguments || {})}</code></td>
                <td className="small">{item.result}</td>
              </tr>
            ))}
            {assistant.items.length === 0 && (
              <tr><td colSpan={5} className="small" style={{ padding: 18, textAlign: "center" }}>Sin acciones IA registradas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
