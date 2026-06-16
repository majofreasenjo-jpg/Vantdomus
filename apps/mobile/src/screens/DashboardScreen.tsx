import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../config";
import { applyAssistant, getAssistant, getDashboard, registerPushToken } from "../lib/api";
import { registerForPushToken } from "../lib/push";
import { useTaxonomy, getViewLabel } from "../context/TaxonomyContext";

function greetingForHour(): string {
  const h = new Date().getHours();
  if (h < 6) return "Hola";
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function toneForHSI(hsi: number): "good" | "warn" | "bad" {
  if (hsi >= 80) return "good";
  if (hsi >= 60) return "warn";
  return "bad";
}

export function DashboardScreen({ navigation }: any) {
  const [hid, setHid] = useState<string>("");
  const { tax, setTaxonomy } = useTaxonomy();

  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState<any>(null);
  const [asst, setAsst] = useState<any>({ items: [] });
  const [error, setError] = useState<string>("");

  const refresh = async () => {
    setError("");
    setLoading(true);
    try {
      const d = await getDashboard(hid);
      const a = await getAssistant(hid, false);
      setDash(d);
      setAsst(a);
      // Inyectar el context si viene de la db
      if (d?.household?.meta?.industry_preset) {
        setTaxonomy(d.household.meta.industry_preset);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.householdId) || process.env.EXPO_PUBLIC_DEFAULT_HOUSEHOLD_ID;
      if (val) setHid(val);
      else setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!hid) return;
    refresh();
    (async () => {
      try {
        const reg = await registerForPushToken();
        if (reg && reg.token) {
          await registerPushToken(hid, reg.platform, reg.token, reg.deviceName);
        }
      } catch { }
    })();
  }, [hid]);

  const f = dash?.features;
  const hsi = f?.hsi ?? 0;
  const tone = toneForHSI(hsi);

  if (!hid) {
    return (
      <View style={[styles.center, { backgroundColor: tax.theme?.bg || "#0b0f17" }]}>
        <Text style={styles.h1}>
          {tax.family_mode ? "Falta configurar tu hogar 🏡" : "Config faltante"}
        </Text>
        <Text style={styles.muted}>
          {tax.family_mode
            ? "Entrá al panel web, creá tu hogar y volvé acá."
            : "Define EXPO_PUBLIC_DEFAULT_HOUSEHOLD_ID en .env"}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: tax.theme?.bg || "#0b0f17" }]} contentContainerStyle={{ padding: 16, width: "100%", maxWidth: 640, alignSelf: "center", minHeight: "100%" }}>
      <Text style={styles.h1}>
        {tax.family_mode
          ? `${greetingForHour()}${dash?.household?.meta?.family_name ? ", " + dash.household.meta.family_name : ""} 🏡`
          : getViewLabel(tax, "dashboard_title", "Dashboard")
        }
      </Text>
      {/* Solo mostrar UUIDs cuando NO es modo familia. En familia no le pedimos al usuario que vea identificadores técnicos. */}
      {!tax.family_mode ? <Text style={styles.muted}>{hid}</Text> : null}

      {loading ? <ActivityIndicator style={{ marginTop: 12 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {dash ? (
        <>
          <Card title={tax.kpi?.osi || "Operational Stability Index (OSI)"}>
            <View style={styles.rowBetween}>
              <View>
                <View style={styles.row}>
                  <Text style={styles.big}>{hsi}%</Text>
                  {!tax.family_mode ? (
                    <Text style={[styles.muted, { marginLeft: 8, alignSelf: "flex-end", marginBottom: 6 }]}>
                      ±{f?.hsi_margin ?? 0}% (Conf. 95%)
                    </Text>
                  ) : null}
                </View>
                <View style={{ alignSelf: "flex-start", marginTop: 4 }}>
                  <Pill
                    text={
                      tax.family_mode
                        ? (tone === "good" ? "Todo bien" : tone === "warn" ? "Atención" : "Necesita ayuda")
                        : (tone === "good" ? "Stable" : tone === "warn" ? "At Risk" : "Critical")
                    }
                    tone={tone}
                  />
                </View>
              </View>
              <Pressable style={[styles.btn, styles.btnPrimary, { alignSelf: "flex-start" }]} onPress={refresh}>
                <Text style={styles.btnText}>{tax.family_mode ? "Actualizar" : "Refresh"}</Text>
              </Pressable>
            </View>
            <View style={{ marginTop: 14 }}>
              <Text style={styles.statLine}>
                <Text style={styles.statLabel}>{tax.health}</Text> {f?.health_score ?? 0}% <Text style={styles.marginText}>±{f?.health_margin ?? 0}%</Text>
              </Text>
              <Text style={styles.statLine}>
                <Text style={styles.statLabel}>{tax.tasks}</Text> {f?.task_score ?? 0}% <Text style={styles.marginText}>±{f?.task_margin ?? 0}%</Text>
              </Text>
              <Text style={styles.statLine}>
                <Text style={styles.statLabel}>{tax.finance}</Text> {f?.finance_score ?? 0}% <Text style={styles.marginText}>±{f?.finance_margin ?? 0}%</Text>
              </Text>
            </View>
          </Card>

          <Card title={tax.family_mode ? "Sugerencias del asistente" : "Planning Assistant"}>
            {asst?.items?.length ? asst.items.slice(0, 5).map((r: any) => (
              <View key={r.id} style={styles.reco}>
                <View style={styles.row}>
                  <Pill text={r.kind} />
                  <Pill text={`impact ${r.impact}`} tone="warn" />
                </View>
                <Text style={styles.recoTitle}>{r.title}</Text>
                <Text style={styles.muted}>{r.rationale}</Text>
                <Pressable
                  style={[styles.btn, styles.btnPrimary, { marginTop: 10, alignSelf: "flex-start" }]}
                  onPress={async () => { await applyAssistant(hid, r.id); await refresh(); }}
                >
                  <Text style={styles.btnText}>Aplicar</Text>
                </Pressable>
              </View>
            )) : (
              <Text style={styles.muted}>
                {tax.family_mode
                  ? "No hay sugerencias por ahora. Cuando aparezcan oportunidades de ayudarte aparecerán acá."
                  : "No hay recomendaciones abiertas."}
              </Text>
            )}
          </Card>

          <Card title={tax.family_mode ? "Accesos rápidos" : "Navegar"}>
            <View style={styles.row}>
              <Pressable style={styles.btn} onPress={() => navigation.navigate("Tasks")}>
                <Text style={styles.btnText}>{tax.tasks}</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={() => navigation.navigate("Finance")}>
                <Text style={styles.btnText}>{tax.finance}</Text>
              </Pressable>
            </View>
            <View style={[styles.row, { marginTop: 10 }]}>
              <Pressable style={styles.btn} onPress={() => navigation.navigate("Persons")}>
                <Text style={styles.btnText}>{tax.persons}</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={() => navigation.navigate("Chat")}>
                <Text style={styles.btnText}>
                  {tax.family_mode ? "Asistente" : "Chat AI"}
                </Text>
              </Pressable>
            </View>

            {/* El "Command Center B2B" solo aparece cuando NO es modo familia.
                Para una familia, ese botón rompe la inmersión y revela la
                naturaleza B2B del producto. */}
            {!tax.family_mode ? (
              <View style={[styles.row, { marginTop: 12 }]}>
                <Pressable style={[styles.btn, { width: "100%", justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,215,0,0.1)", borderColor: "rgba(255,215,0,0.3)" }]} onPress={() => navigation.navigate("Ceo")}>
                  <Text style={[styles.btnText, { color: "#fbbf24" }]}>🌐 Entrar al B2B Command Center</Text>
                </Pressable>
              </View>
            ) : null}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f17" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0b0f17", padding: 16 },
  h1: { color: "#e9f0ff", fontSize: 26, fontWeight: "900" },
  muted: { color: "#93a4b8", marginTop: 4 },
  error: { color: "#ff5c7a", marginTop: 12 },
  big: { color: "#e9f0ff", fontSize: 40, fontWeight: "900" },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  btn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.04)", marginRight: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5 },
  btnPrimary: { borderColor: "rgba(91,124,250,0.5)", backgroundColor: "rgba(91,124,250,0.18)" },
  btnText: { color: "#e9f0ff", fontWeight: "800" },
  reco: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(31,42,58,0.6)" },
  recoTitle: { color: "#e9f0ff", fontSize: 15, fontWeight: "800", marginTop: 6 },
  statLine: { color: "#e9f0ff", fontSize: 15, marginBottom: 4 },
  statLabel: { color: "#93a4b8", fontWeight: "600", width: 140 },
  marginText: { color: "#93a4b8", fontSize: 13 },
});
