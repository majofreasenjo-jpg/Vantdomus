import { getDashboard } from "@/lib/api";

export default async function DashboardPage({ params }: { params: { householdId: string } }) {
  const hid = params.householdId;
  const dash = await getDashboard(hid);

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ marginTop: 0 }}>Dashboard</h1>

      <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8, marginBottom: 12 }}>
        <div style={{ fontWeight: 900 }}>{dash.household.name}</div>
        <div style={{ fontSize: 12, color: "#666" }}>{dash.household.id}</div>
      </div>

      <h2>Persons</h2>
      {dash.persons.length === 0 ? <div>Sin personas aún.</div> : (
        <ul>
          {dash.persons.map((p: any) => (
            <li key={p.id}>
              <b>{p.display_name}</b> {p.relation ? <span style={{ color: "#666" }}>({p.relation})</span> : null}
              <span> · </span>
              <a href={`/persons/${p.id}/health?hid=${hid}`}>Health timeline</a>
            </li>
          ))}
        </ul>
      )}

      <h2>Alerts</h2>
      {dash.alerts.length === 0 ? <div>Sin alerts.</div> : (
        <ul>
          {dash.alerts.map((a: any) => (
            <li key={a.id}>
              <b>{a.severity}</b> — {a.title} <span style={{ color: "#666" }}>({a.status})</span>
              <div style={{ fontSize: 12, color: "#666" }}>{a.message}</div>
            </li>
          ))}
        </ul>
      )}

      <h2>Recent events</h2>
      {dash.recent_events.length === 0 ? <div>Sin eventos aún.</div> : (
        <ul>
          {dash.recent_events.map((e: any) => (
            <li key={e.id}>
              {e.summary}
              <div style={{ fontSize: 12, color: "#666" }}>{e.domain} · {e.event_type} · {e.occurred_at}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
