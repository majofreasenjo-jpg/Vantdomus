import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Card } from "../components/Card";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../config";
import { getDashboard } from "../lib/api";

export function PersonsScreen({ navigation }: any) {
  const [hid, setHid] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [persons, setPersons] = useState<any[]>([]);
  const [error, setError] = useState("");

  const refresh = async () => {
    setError("");
    setLoading(true);
    try {
      const d = await getDashboard(hid);
      setPersons(d.persons || []);
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
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.h1}>Cuadrilla Operativa</Text>
      <Text style={styles.muted}>{hid}</Text>

      <Card title="Listado">
        {loading ? <ActivityIndicator /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {persons.map((p) => (
          <Pressable
            key={p.id}
            style={styles.personBtn}
            onPress={() => navigation.navigate("Health", { personId: p.id })}
          >
            <View>
              <Text style={styles.personName}>{p.display_name}</Text>
              <Text style={styles.muted}>{p.relation || "Sin Cargo Asignado"}</Text>
            </View>
            <Text style={styles.muted}>Ver</Text>
          </Pressable>
        ))}

        {!loading && persons.length === 0 ? <Text style={styles.muted}>Sin personal asignado a la cuadrilla.</Text> : null}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f17" },
  h1: { color: "#e9f0ff", fontSize: 26, fontWeight: "900" },
  muted: { color: "#93a4b8", marginTop: 4 },
  error: { color: "#ff5c7a", marginTop: 10 },
  personBtn: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderTopWidth: 1, borderTopColor: "rgba(31,42,58,0.6)" },
  personName: { color: "#e9f0ff", fontWeight: "900" },
});
