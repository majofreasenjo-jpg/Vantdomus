import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Card } from "../components/Card";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../config";
import { getPersonHealthTimeline, healthCheckin, setAdherencePlan } from "../lib/api";

export function HealthScreen({ route }: any) {
  const [hid, setHid] = useState<string>("");
  const { personId } = route.params;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [med, setMed] = useState("Losartan");
  const [error, setError] = useState("");

  const refresh = async () => {
    setError("");
    setLoading(true);
    try {
      const d = await getPersonHealthTimeline(personId);
      setName(d.person.display_name);
      setItems(d.items || []);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.h1}>Health</Text>
      <Text style={styles.muted}>{name || personId}</Text>

      <Card title="Adherence Plan">
        <View style={styles.row}>
          <TextInput value={med} onChangeText={setMed} style={styles.input} placeholder="Medication" placeholderTextColor="#6f829b" />
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={async () => { await setAdherencePlan(hid, personId, med, "08:00,20:00", "tap"); await refresh(); }}>
            <Text style={styles.btnText}>Set Plan</Text>
          </Pressable>
        </View>
        <Text style={styles.muted}>Default: 08:00,20:00 · tap</Text>
      </Card>

      <Card title="Check-in">
        <View style={styles.row}>
          <Pressable style={styles.btn} onPress={async () => { await healthCheckin(hid, personId, med, "taken"); await refresh(); }}>
            <Text style={styles.btnText}>Taken</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={async () => { await healthCheckin(hid, personId, med, "missed"); await refresh(); }}>
            <Text style={styles.btnText}>Missed</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      <Card title="Timeline">
        {loading ? <ActivityIndicator /> : null}
        {items.map((it) => (
          <View key={it.id} style={styles.item}>
            <Text style={styles.itemTitle}>{it.summary}</Text>
            <Text style={styles.muted}>{it.occurred_at}</Text>
          </View>
        ))}
        {!loading && items.length === 0 ? <Text style={styles.muted}>Sin eventos.</Text> : null}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f17" },
  h1: { color: "#e9f0ff", fontSize: 26, fontWeight: "900" },
  muted: { color: "#93a4b8", marginTop: 4 },
  error: { color: "#ff5c7a", marginTop: 10 },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  input: { flex: 1, minWidth: 200, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: "#1f2a3a", backgroundColor: "rgba(255,255,255,0.03)", color: "#e9f0ff", marginRight: 10 },
  btn: { borderWidth: 1, borderColor: "#1f2a3a", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.03)", marginRight: 10, marginTop: 8 },
  btnPrimary: { borderColor: "rgba(91,124,250,0.5)", backgroundColor: "rgba(91,124,250,0.18)" },
  btnText: { color: "#e9f0ff", fontWeight: "700" },
  item: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: "rgba(31,42,58,0.6)" },
  itemTitle: { color: "#e9f0ff", fontWeight: "800" },
});
