import { getEventDetail } from "../../../lib/api";
import { EvalRulesButton } from "./actions";

export default async function EventDetailPage({ params }: { params: { eventId: string } }) {
  const data = await getEventDetail(params.eventId);
  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ marginTop: 0 }}>Event</h1>
      <EvalRulesButton eventId={params.eventId} />
      <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8, marginBottom: 16 }}>
        <div style={{ fontWeight: 900 }}>{data.event.summary}</div>
        <div style={{ fontSize: 12, color: "#666" }}>
          {data.event.domain} · {data.event.event_type} · occurred {data.event.occurred_at}
        </div>
      </div>
      <h2>Payload</h2>
      <pre style={{ padding: 12, border: "1px solid #eee", borderRadius: 8, overflowX: "auto" }}>
        {JSON.stringify(data.payload, null, 2)}
      </pre>
    </div>
  );
}
