import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../config";
import { applyAssistant, getAssistant, getDashboard, registerPushToken } from "../lib/api";
import { registerForPushToken } from "../lib/push";

function toneForHSI(hsi: number): "good" | "warn" | "bad" {
  if (hsi >= 80) return "good";
  if (hsi >= 60) return "warn";
  return "bad";
}

export function DashboardScreen({ navigation }: any) {
  const [hid, setHid] = useState<string>("");

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
      <View style={styles.center}>
        <Text style={styles.h1}>Config faltante</Text>
        <Text style={styles.muted}>Define EXPO_PUBLIC_DEFAULT_HOUSEHOLD_ID en .env</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.h1}>Dashboard</Text>
      <Text style={styles.muted}>{hid}</Text>

      {loading ? <ActivityIndicator style={{ marginTop: 12 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {dash ? (
        <>
          <Card title="Stability">
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.big}>{hsi}</Text>
                <Pill text={tone === "good" ? "Stable" : tone === "warn" ? "At Risk" : "Critical"} tone={tone} />
              </View>
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={refresh}>
                <Text style={styles.btnText}>Refresh</Text>
              </Pressable>
            </View>
            <View style={{ marginTop: 10 }}>
              <Text style={styles.muted}>Health {f?.health_score ?? 0} · Tasks {f?.task_score ?? 0} · Finance {f?.finance_score ?? 0}</Text>
            </View>
          </Card>

          <Card title="Planning Assistant">
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
            )) : <Text style={styles.muted}>No hay recomendaciones abiertas.</Text>}
          </Card>

          <Card title="Navegar">
            <View style={styles.row}>
              <Pressable style={styles.btn} onPress={() => navigation.navigate("Tasks")}>
                <Text style={styles.btnText}>Tasks</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={() => navigation.navigate("Finance")}>
                <Text style={styles.btnText}>Finance</Text>
              </Pressable>
            </View>
            <View style={[styles.row, { marginTop: 10 }]}>
              <Pressable style={styles.btn} onPress={() => navigation.navigate("Persons")}>
                <Text style={styles.btnText}>Persons</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={() => navigation.navigate("Chat")}>
                <Text style={styles.btnText}>Chat</Text>
              </Pressable>
            </View>
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
  btn: { borderWidth: 1, borderColor: "#1f2a3a", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.03)", marginRight: 10 },
  btnPrimary: { borderColor: "rgba(91,124,250,0.5)", backgroundColor: "rgba(91,124,250,0.18)" },
  btnText: { color: "#e9f0ff", fontWeight: "700" },
  reco: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(31,42,58,0.6)" },
  recoTitle: { color: "#e9f0ff", fontSize: 15, fontWeight: "800", marginTop: 6 },
});
