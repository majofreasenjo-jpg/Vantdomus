import { getDashboard } from "@/lib/api";

export default async function DashboardPage() {
    const householdId = process.env.NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID || "";
    if (!householdId) return <div>Falta NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID</div>;

    const data = await getDashboard(householdId);

    return (
        <div style={{ maxWidth: 1100 }}>
            <h1 style={{ marginTop: 0 }}>📊 Dashboard</h1>
            <div style={{ color: "#666", marginBottom: 16 }}>Hogar: {data.household.name}</div>

            {/* KPIs */}
            <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
                <div style={{ flex: 1, padding: 16, border: "1px solid #eee", borderRadius: 8, textAlign: "center" }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: data.kpis.open_alerts > 0 ? "#d32f2f" : "#4caf50" }}>
                        {data.kpis.open_alerts}
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>Alertas Abiertas</div>
                </div>
                <div style={{ flex: 1, padding: 16, border: "1px solid #eee", borderRadius: 8, textAlign: "center" }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: data.kpis.open_tasks > 0 ? "#f57c00" : "#4caf50" }}>
                        {data.kpis.open_tasks}
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>Tareas Pendientes</div>
                </div>
                <div style={{ flex: 1, padding: 16, border: "1px solid #eee", borderRadius: 8, textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {data.kpis.last_event_at ? new Date(data.kpis.last_event_at).toLocaleString("es-CL") : "—"}
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>Último Evento</div>
                </div>
            </div>

            {/* Alerts */}
            <h2>🚨 Alertas</h2>
            {data.alerts.length === 0 ? (
                <div style={{ padding: 12, color: "#999", border: "1px solid #eee", borderRadius: 8 }}>Sin alertas abiertas</div>
            ) : (
                <div style={{ display: "grid", gap: 8 }}>
                    {data.alerts.map((a: any) => (
                        <div key={a.id} style={{ padding: 12, border: "1px solid #ffcdd2", borderRadius: 8, background: "#fff5f5" }}>
                            <div style={{ fontWeight: 700 }}>{a.title}</div>
                            <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>{a.message}</div>
                            <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>Severidad: {a.severity} · {a.created_at}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Tasks */}
            <h2 style={{ marginTop: 24 }}>📋 Tareas</h2>
            {data.tasks.length === 0 ? (
                <div style={{ padding: 12, color: "#999", border: "1px solid #eee", borderRadius: 8 }}>Sin tareas pendientes</div>
            ) : (
                <div style={{ display: "grid", gap: 8 }}>
                    {data.tasks.map((t: any) => (
                        <div key={t.id} style={{ padding: 12, border: "1px solid #ffe0b2", borderRadius: 8, background: "#fffbf0" }}>
                            <div style={{ fontWeight: 700 }}>{t.type}</div>
                            <div style={{ fontSize: 11, color: "#999" }}>{t.created_at}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Personas */}
            <h2 style={{ marginTop: 24 }}>👥 Personas</h2>
            {data.persons.length === 0 ? (
                <div style={{ padding: 12, color: "#999", border: "1px solid #eee", borderRadius: 8 }}>Sin personas registradas</div>
            ) : (
                <div style={{ display: "grid", gap: 8 }}>
                    {data.persons.map((p: any) => (
                        <a key={p.id} href={`/persons/${p.id}`}
                            style={{ display: "block", padding: 12, border: "1px solid #eee", borderRadius: 8, textDecoration: "none", color: "inherit" }}>
                            <div style={{ fontWeight: 700 }}>{p.display_name}</div>
                            <div style={{ fontSize: 12, color: "#666" }}>{p.relation || "—"}</div>
                        </a>
                    ))}
                </div>
            )}

            {/* Recent Events */}
            <h2 style={{ marginTop: 24 }}>🕐 Eventos Recientes</h2>
            {data.recent_events.length === 0 ? (
                <div style={{ padding: 12, color: "#999", border: "1px solid #eee", borderRadius: 8 }}>Sin eventos</div>
            ) : (
                <div style={{ display: "grid", gap: 6 }}>
                    {data.recent_events.map((e: any) => (
                        <div key={e.id} style={{ padding: 10, border: "1px solid #f3f3f3", borderRadius: 6, fontSize: 13 }}>
                            <span style={{ fontWeight: 600 }}>{e.summary}</span>
                            <span style={{ color: "#999", marginLeft: 8, fontSize: 11 }}>{e.event_type} · {e.occurred_at}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
