import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Card } from "../components/Card";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../config";
import { getPersonHealthTimeline, healthCheckin, setAdherencePlan } from "../lib/api";
import { useTaxonomy, getViewLabel } from "../context/TaxonomyContext";

// Renderiza fechas ISO al formato local del usuario.
// Ej: "2026-06-10T08:00:00Z" → "10 jun · 08:00"
function formatEventDate(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-CL", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function HealthScreen({ route }: any) {
  const { tax } = useTaxonomy();
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
  }, [hid]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: tax.theme?.bg || "#0b0f17" }]} contentContainerStyle={{ padding: 16, width: "100%", maxWidth: 640, alignSelf: "center", minHeight: "100%" }}>
      <Text style={styles.h1}>{tax.health}</Text>
      <Text style={styles.muted}>{name || personId}</Text>

      <Card title={getViewLabel(tax, "health_card", "Protocolos Operativos")}>
        <View style={styles.row}>
          <TextInput
            value={med}
            onChangeText={setMed}
            style={styles.input}
            placeholder={getViewLabel(tax, "health_input_placeholder", "Protocolo / Check")}
            placeholderTextColor="#6f829b"
          />
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={async () => { await setAdherencePlan(hid, personId, med, "08:00,20:00", "tap"); await refresh(); }}
          >
            <Text style={styles.btnText}>{getViewLabel(tax, "health_plan_btn", "Definir Plan")}</Text>
          </Pressable>
        </View>
        <Text style={styles.muted}>
          {tax.family_mode ? "Recordatorios: 08:00 y 20:00" : "Default: 08:00,20:00 · tap"}
        </Text>
      </Card>

      <Card title={tax.family_mode
        ? getViewLabel(tax, "health_checkin_title", "¿Cómo va con la pastilla?")
        : getViewLabel(tax, "health_checkin", "Control en Terreno")
      }>
        <View style={styles.row}>
          <Pressable
            style={[styles.btn, styles.btnPrimary, { borderColor: tax.theme?.primary }]}
            onPress={async () => { await healthCheckin(hid, personId, med, "taken"); await refresh(); }}
          >
            <Text style={[styles.btnText, { color: tax.theme?.primary }]}>
              {getViewLabel(tax, "health_taken", "Seguro / OK")}
            </Text>
          </Pressable>
          <Pressable
            style={styles.btn}
            onPress={async () => { await healthCheckin(hid, personId, med, "missed"); await refresh(); }}
          >
            <Text style={styles.btnText}>
              {getViewLabel(tax, "health_missed", "Riesgo / Fallo")}
            </Text>
          </Pressable>
        </View>
        {error ? (
          <Text style={styles.error}>
            {tax.family_mode
              ? "No se pudo guardar el registro — probá de nuevo en unos segundos."
              : error
            }
          </Text>
        ) : null}
      </Card>

      <Card title={getViewLabel(tax, "health_log", "Historial de Novedades")}>
        {loading ? <ActivityIndicator /> : null}
        {items.map((it) => (
          <View key={it.id} style={styles.item}>
            <Text style={styles.itemTitle}>{it.summary}</Text>
            <Text style={styles.muted}>{formatEventDate(it.occurred_at)}</Text>
          </View>
        ))}
        {!loading && items.length === 0 ? (
          <Text style={styles.muted}>
            {tax.family_mode
              ? "Aún no hay registros. Cuando marques una pastilla aparecerá acá."
              : "Sin eventos."
            }
          </Text>
        ) : null}
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
