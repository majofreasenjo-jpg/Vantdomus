import { getPersonDetail, getPersonHealthTimeline } from "../../../lib/api";
import { AdherencePlanForm, CheckinButtons } from "./actions";

export default async function PersonPage({ params }: { params: { personId: string } }) {
    const timeline = await getPersonHealthTimeline(params.personId);
    const data = await getPersonDetail(params.personId);

    return (
        <div style={{ maxWidth: 900 }}>
            <h1 style={{ marginTop: 0 }}>🏥 {data.person.display_name}</h1>
            <div style={{ color: "#666", marginBottom: 16 }}>
                Relación: {data.person.relation || "—"} · <a href="/dashboard">← Dashboard</a>
            </div>

            {/* Adherence Plan Form */}
            <AdherencePlanForm personId={params.personId} />

            {/* Check-in Buttons */}
            <CheckinButtons personId={params.personId} />

            {/* Health Timeline */}
            <h2>📅 Health Timeline</h2>
            {data.events.length === 0 ? (
                <div style={{ padding: 12, color: "#999", border: "1px solid #eee", borderRadius: 8 }}>
                    Sin eventos de salud
                </div>
            ) : (
                <div style={{ display: "grid", gap: 6 }}>
                    {data.events.map((ev: any) => {
                        const isMissed = ev.event_type === "medication_checkin" && ev.payload?.checkin?.outcome === "missed";
                        const isTaken = ev.event_type === "medication_checkin" && ev.payload?.checkin?.outcome === "taken";
                        const isPlan = ev.event_type === "adherence_plan_set";
                        const bg = isMissed ? "#fff5f5" : isTaken ? "#f1f8e9" : isPlan ? "#e3f2fd" : "#fafafa";
                        const border = isMissed ? "#ffcdd2" : isTaken ? "#c8e6c9" : isPlan ? "#bbdefb" : "#eee";
                        return (
                            <div key={ev.id} style={{ padding: 10, border: `1px solid ${border}`, borderRadius: 6, background: bg }}>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{ev.summary}</div>
                                <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
                                    {ev.event_type} · {ev.occurred_at}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
