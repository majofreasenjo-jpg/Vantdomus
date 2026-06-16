import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Card } from "../components/Card";
import { listHouseholds } from "../lib/api";
import { STORAGE_KEYS } from "../config";

export function PickHouseholdScreen({ navigation }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await listHouseholds();
      setItems(res.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  return (
    <View style={styles.container}>
      <View style={{ padding: 16 }}>
        <Text style={styles.h1}>Selecciona un hogar</Text>
        <Text style={styles.muted}>Elige el household para continuar.</Text>

        <Card title="Households">
          {loading ? <ActivityIndicator /> : null}
          {items.map((h) => (
            <Pressable
              key={h.id}
              style={styles.item}
              onPress={async () => {
                await AsyncStorage.setItem(STORAGE_KEYS.householdId, h.id);
                navigation.reset({ index: 0, routes: [{ name: "Dashboard" }] });
              }}
            >
              <Text style={styles.itemTitle}>{h.name}</Text>
              <Text style={styles.muted}>{h.id}</Text>
            </Pressable>
          ))}
          {!loading && items.length === 0 ? <Text style={styles.muted}>No hay households aún. Crea uno desde el panel web o API.</Text> : null}
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f17" },
  h1: { color: "#e9f0ff", fontSize: 26, fontWeight: "900" },
  muted: { color: "#93a4b8", marginTop: 6 },
  item: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: "rgba(31,42,58,0.6)" },
  itemTitle: { color: "#e9f0ff", fontWeight: "900" },
});
