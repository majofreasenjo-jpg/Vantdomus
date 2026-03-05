import { getInbox } from "../../lib/api";

export default async function InboxPage() {
  const householdId = process.env.NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID || "";
  if (!householdId) return <div>Falta NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID</div>;
  const data = await getInbox(householdId);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Inbox</h1>
      <div style={{ color: "#666", marginBottom: 12 }}>Household: {householdId}</div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Created", "Source", "Type", "Stage", "Event"].map(h => (
              <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.items.map((it: any) => (
            <tr key={it.artifact.id}>
              <td style={{ borderBottom: "1px solid #f3f3f3", padding: 8 }}>{it.artifact.created_at}</td>
              <td style={{ borderBottom: "1px solid #f3f3f3", padding: 8 }}>{it.artifact.source}</td>
              <td style={{ borderBottom: "1px solid #f3f3f3", padding: 8 }}>{it.artifact.content_type}</td>
              <td style={{ borderBottom: "1px solid #f3f3f3", padding: 8 }}>
                <b>{it.status_rollup.stage}</b>
              </td>
              <td style={{ borderBottom: "1px solid #f3f3f3", padding: 8 }}>
                {it.mapped_event ? <a href={`/events/${it.mapped_event.id}`}>{it.mapped_event.event_type}</a> : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
