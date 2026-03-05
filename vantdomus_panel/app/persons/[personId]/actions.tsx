"use client";
import { setAdherencePlan, healthCheckin } from "../../../lib/api";
import { useState } from "react";

export function AdherencePlanForm({ personId }: { personId: string }) {
    const [medication, setMedication] = useState("Losartan");
    const [times, setTimes] = useState("08:00,20:00");
    const [mode, setMode] = useState("tap");
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit() {
        setLoading(true);
        try {
            const res = await setAdherencePlan("", personId, medication, times, mode as any);
            setResult(res);
            setTimeout(() => location.reload(), 1000);
        } catch (e: any) {
            setResult({ error: e.message });
        }
        setLoading(false);
    }

    return (
        <div style={{ padding: 16, border: "1px solid #e0e0e0", borderRadius: 8, background: "#f9fafb", marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 12px" }}>💊 Definir Plan de Adherencia</h3>
            <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontSize: 13 }}>
                    Medication:
                    <input value={medication} onChange={e => setMedication(e.target.value)}
                        style={{ display: "block", width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 4, marginTop: 4 }} />
                </label>
                <label style={{ fontSize: 13 }}>
                    Times (comma-separated):
                    <input value={times} onChange={e => setTimes(e.target.value)}
                        style={{ display: "block", width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 4, marginTop: 4 }}
                        placeholder="08:00,20:00" />
                </label>
                <label style={{ fontSize: 13 }}>
                    Mode:
                    <select value={mode} onChange={e => setMode(e.target.value)}
                        style={{ display: "block", width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 4, marginTop: 4 }}>
                        <option value="tap">Tap</option>
                        <option value="sms">SMS</option>
                        <option value="auto">Auto</option>
                    </select>
                </label>
                <button onClick={handleSubmit} disabled={loading}
                    style={{ padding: "8px 16px", background: "#1976d2", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, marginTop: 4 }}>
                    {loading ? "Guardando..." : "Guardar Plan"}
                </button>
            </div>
            {result && (
                <pre style={{ marginTop: 8, padding: 8, background: "#fff", border: "1px solid #eee", borderRadius: 4, fontSize: 12, overflow: "auto" }}>
                    {JSON.stringify(result, null, 2)}
                </pre>
            )}
        </div>
    );
}

export function CheckinButtons({ personId }: { personId: string }) {
    const [medication, setMedication] = useState("Losartan");
    const [time, setTime] = useState("08:00");
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    async function handleCheckin(outcome: string) {
        setLoading(true);
        try {
            const res = await healthCheckin("", personId, medication, outcome as any);
            setResult(res);
            setTimeout(() => location.reload(), 1200);
        } catch (e: any) {
            setResult({ error: e.message });
        }
        setLoading(false);
    }

    return (
        <div style={{ padding: 16, border: "1px solid #e0e0e0", borderRadius: 8, background: "#f9fafb", marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 12px" }}>🔔 Registrar Check-in</h3>
            <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
                <label style={{ fontSize: 13 }}>
                    Medication:
                    <input value={medication} onChange={e => setMedication(e.target.value)}
                        style={{ display: "block", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 4, marginTop: 4 }} />
                </label>
                <label style={{ fontSize: 13 }}>
                    Hora:
                    <input value={time} onChange={e => setTime(e.target.value)}
                        style={{ display: "block", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 4, marginTop: 4, width: 80 }} />
                </label>
                <button onClick={() => handleCheckin("taken")} disabled={loading}
                    style={{ padding: "8px 16px", background: "#4caf50", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                    ✅ Taken
                </button>
                <button onClick={() => handleCheckin("missed")} disabled={loading}
                    style={{ padding: "8px 16px", background: "#d32f2f", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                    ❌ Missed
                </button>
            </div>
            {result && (
                <div style={{ marginTop: 12 }}>
                    {result.alert_created && (
                        <div style={{ padding: 10, background: "#ffebee", border: "1px solid #ffcdd2", borderRadius: 6, marginBottom: 8 }}>
                            <strong>⚠️ ALERTA CREADA:</strong> {result.alert_created.consecutive_misses} dosis consecutivas perdidas
                        </div>
                    )}
                    <pre style={{ padding: 8, background: "#fff", border: "1px solid #eee", borderRadius: 4, fontSize: 12, overflow: "auto" }}>
                        {JSON.stringify(result, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
