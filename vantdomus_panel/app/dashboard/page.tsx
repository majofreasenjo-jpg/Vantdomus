import { getDashboard, getHouseholds, getHSIStatus } from "../../lib/api";

function pillForHSI(hsi: number) {
    if (hsi >= 80) return { cls: "pill good", label: "Stable" };
    if (hsi >= 60) return { cls: "pill warn", label: "At Risk" };
    return { cls: "pill bad", label: "Critical" };
}

export default async function DashboardPage() {
    const householdId = process.env.NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID || "";
    if (!householdId) return <div>Falta NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID</div>;

    const data = await getDashboard(householdId);
    if (!data.household) return <div>Error loading dashboard data</div>;

    const f = data.features;
    const hsi = f?.hsi ?? 0;
    const pill = pillForHSI(hsi);

    return (
        <div style={{ maxWidth: 1100 }}>
            <h1 style={{ marginTop: 0 }}>📊 Dashboard General</h1>
            <div style={{ color: "#666", marginBottom: 16 }}>Hogar Activo: {data.household.name} ({data.household.id})</div>

            <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
                <a className="btn" href={`/dashboard/${householdId}`} style={{ background: "#eee", color: "#333", textDecoration: "none", padding: "8px 16px", borderRadius: 4 }}>
                    👉 Ir a Vista de Unidad
                </a>
            </div>

            {/* KPIs */}
            <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
                <div style={{ flex: 1, padding: 16, border: "1px solid #ecc", borderRadius: 8, textAlign: "center", background: "#fdf8f8" }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: (f?.alerts_open ?? 0) > 0 ? "#d32f2f" : "#4caf50" }}>
                        {f?.alerts_open ?? 0}
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>Alertas Abiertas</div>
                </div>
                <div style={{ flex: 1, padding: 16, border: "1px solid #eee", borderRadius: 8, textAlign: "center" }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: (f?.tasks_overdue ?? 0) > 0 ? "#f57c00" : "#4caf50" }}>
                        {f?.tasks_overdue ?? 0}
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>Tareas Atrasadas</div>
                </div>
                <div style={{ flex: 1, padding: 16, border: "1px solid #cce5ff", borderRadius: 8, textAlign: "center", background: "#f0f8ff" }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: "#0056b3" }}>
                        {hsi}
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>Índice HSI ({pill.label})</div>
                </div>
            </div>

            {/* Alerts */}
            <h2>🚨 Alertas Recientes</h2>
            {data.alerts?.length === 0 ? (
                <div style={{ padding: 12, color: "#999", border: "1px solid #eee", borderRadius: 8 }}>Sin alertas abiertas</div>
            ) : (
                <div style={{ display: "grid", gap: 8 }}>
                    {data.alerts?.slice(0, 5).map((a: any) => (
                        <div key={a.id} style={{ padding: 12, border: "1px solid #ffcdd2", borderRadius: 8, background: "#fff5f5" }}>
                            <div style={{ fontWeight: 700 }}>{a.title}</div>
                            <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>{a.message}</div>
                            <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>Severidad: {a.severity} · {a.created_at}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Recent Events */}
            <h2 style={{ marginTop: 24 }}>🕐 Eventos Registrados</h2>
            {data.events?.length === 0 ? (
                <div style={{ padding: 12, color: "#999", border: "1px solid #eee", borderRadius: 8 }}>Sin eventos registrados</div>
            ) : (
                <div style={{ display: "grid", gap: 6 }}>
                    {data.events?.slice(0, 10).map((e: any) => (
                        <div key={e.id} style={{ padding: 10, border: "1px solid #f3f3f3", borderRadius: 6, fontSize: 13 }}>
                            <span style={{ fontWeight: 600 }}>{e.summary}</span>
                            <span style={{ color: "#999", marginLeft: 8, fontSize: 11 }}>{e.event_type} · {new Date(e.occurred_at).toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
