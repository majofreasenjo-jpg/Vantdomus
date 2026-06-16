import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import { getCeoState } from "../lib/api";
import { useTaxonomy } from "../context/TaxonomyContext";

function toneNumber(val: number, target: number = 80): "good" | "warn" | "bad" {
    if (val >= target) return "good";
    if (val >= (target * 0.75)) return "warn";
    return "bad";
}

export function CeoScreen({ navigation }: any) {
    const { tax } = useTaxonomy();
    const [loading, setLoading] = useState(true);
    const [ceoData, setCeoData] = useState<any>(null);
    const [error, setError] = useState<string>("");

    const refresh = async () => {
        setError("");
        setLoading(true);
        try {
            const data = await getCeoState();
            setCeoData(data);
        } catch (e: any) {
            setError(e?.message || String(e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    const pnl = ceoData?.pnl || {};
    const macro_kpis = tax?.macro_kpis || {};

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, width: "100%", maxWidth: 640, alignSelf: "center", minHeight: "100%" }}>
            <View style={styles.rowBetween}>
                <View>
                    <Text style={styles.h1}>Estado Corporativo</Text>
                    <Text style={styles.muted}>Command Center Nivel 4</Text>
                </View>
                <Pressable style={styles.btnSync} onPress={refresh}>
                     <Text style={styles.btnText}>Sync</Text>
                </Pressable>
            </View>

            {loading ? <ActivityIndicator style={{ marginTop: 24 }} size="large" color="#5b7cfa" /> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            {ceoData && !loading ? (
                <>
                    {/* Tarjeta 1: P&L General */}
                    <Card title="Estado de Resultados (P&L)">
                        <View style={styles.rowBetween}>
                            <View>
                                <Text style={styles.muted}>Margen EBITDA</Text>
                                <Text style={[styles.big, { color: "#5b7cfa" }]}>{ceoData.ebitda_margin}%</Text>
                            </View>
                            <View>
                                <Text style={styles.muted}>Net Income</Text>
                                <Text style={[styles.big, { color: pnl.net_income >= 0 ? "#10b981" : "#ef4444" }]}>
                                    ${pnl.net_income?.toLocaleString("en-US")}M
                                </Text>
                            </View>
                        </View>
                        
                        <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)", paddingTop: 10 }}>
                            <View style={[styles.rowBetween, { marginBottom: 6 }]}>
                                <Text style={styles.statLabel}>Revenue</Text>
                                <Text style={styles.statLine}>${pnl.revenue?.toLocaleString("en-US")}M</Text>
                            </View>
                            <View style={[styles.rowBetween, { marginBottom: 6 }]}>
                                <Text style={styles.statLabel}>COGS / Cash Cost</Text>
                                <Text style={styles.statLine}>-${pnl.cogs?.toLocaleString("en-US")}M</Text>
                            </View>
                            <View style={[styles.rowBetween, { marginBottom: 6 }]}>
                                <Text style={styles.statLabel}>SG&A</Text>
                                <Text style={styles.statLine}>-${pnl.sga?.toLocaleString("en-US")}M</Text>
                            </View>
                            <View style={[styles.rowBetween, { marginBottom: 6 }]}>
                                <Text style={styles.statLabel}>EBITDA</Text>
                                <Text style={styles.statLine}>${pnl.ebitda?.toLocaleString("en-US")}M</Text>
                            </View>
                            <View style={[styles.rowBetween, { marginBottom: 6 }]}>
                                <Text style={styles.statLabel}>Multas / Depreciación</Text>
                                <Text style={styles.statLine}>-${pnl.fines_da?.toLocaleString("en-US")}M</Text>
                            </View>
                        </View>
                    </Card>

                    {/* Tarjeta 2: Macro KPIs Taxonómicos B2B */}
                    <Card title="Drivers de Valor (B2B Tree)">
                        <View style={{ marginBottom: 16 }}>
                            <View style={styles.rowBetween}>
                                <Text style={styles.statLabel}>{macro_kpis.capacity || "Capacity"}</Text>
                                <Pill text={`${ceoData.global_osi}%`} tone={toneNumber(ceoData.global_osi, 80)} />
                            </View>
                            <Text style={styles.explainer}>Dirige el Revenue multiplicando volumen de Output.</Text>
                        </View>
                        
                        <View style={{ marginBottom: 16 }}>
                            <View style={styles.rowBetween}>
                                <Text style={styles.statLabel}>{macro_kpis.opex || "OPEX Efficiency"}</Text>
                                <Pill text={`${ceoData.global_finance}%`} tone={toneNumber(ceoData.global_finance, 80)} />
                            </View>
                            <Text style={styles.explainer}>Deprime o subsidia el COGS general.</Text>
                        </View>

                        <View style={{ marginBottom: 16 }}>
                            <View style={styles.rowBetween}>
                                <Text style={styles.statLabel}>{macro_kpis.uptime || "Operational Uptime"}</Text>
                                <Pill text={`${ceoData.global_health}%`} tone={toneNumber(ceoData.global_health, 95)} />
                            </View>
                            <Text style={styles.explainer}>Evita Fines D&A y colapsos de {tax.health}.</Text>
                        </View>
                        
                        <View style={{ marginBottom: 16 }}>
                            <View style={styles.rowBetween}>
                                <Text style={styles.statLabel}>Risk Management (ESG)</Text>
                                <Pill text={`${ceoData.global_esg}%`} tone={toneNumber(ceoData.global_esg, 90)} />
                            </View>
                            <Text style={styles.explainer}>Previene multas catastróficas por daño ambiental y social.</Text>
                        </View>
                    </Card>

                    {/* Tarjeta 3: Gerencias / Divisiones */}
                    <Card title="Apalancamiento por Gerencia">
                        {ceoData.gerencias && ceoData.gerencias.map((g: any, i: number) => (
                            <View key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" }}>
                                <Text style={[styles.statLine, { fontWeight: "bold", color: "#e9f0ff", marginBottom: 6 }]}>{g.name}</Text>
                                <View style={styles.rowBetween}>
                                    <Text style={styles.statLabel}>OSI General</Text>
                                    <View style={styles.row}>
                                        <Text style={[styles.statLine, { marginRight: 8 }]}>{g.macro_osi}%</Text>
                                        <Pill text={toneNumber(g.macro_osi, 80)} tone={toneNumber(g.macro_osi, 80)} />
                                    </View>
                                </View>
                                {g.penalty_applied && (
                                     <Text style={[styles.explainer, { color: "#f59e0b", marginTop: 4 }]}>⚠️ Penalizada matemáticamente por presentar un cuello de botella grave ({g.min_dept_hsi}%).</Text>
                                )}
                            </View>
                        ))}
                    </Card>
                    
                    <View style={{ height: 40 }} />
                </>
            ) : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0b0f17" },
    h1: { color: "#e9f0ff", fontSize: 24, fontWeight: "900" },
    muted: { color: "#93a4b8", fontSize: 13, marginTop: 2 },
    error: { color: "#ff5c7a", marginTop: 12 },
    big: { fontSize: 32, fontWeight: "900" },
    row: { flexDirection: "row", alignItems: "center" },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    statLine: { color: "#e9f0ff", fontSize: 15 },
    statLabel: { color: "#93a4b8", fontWeight: "600", fontSize: 14 },
    explainer: { color: "#64748b", fontSize: 12, marginTop: 4, fontStyle: "italic" },
    btnSync: { borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)" },
    btnText: { color: "#e9f0ff", fontWeight: "600", fontSize: 13 },
});
