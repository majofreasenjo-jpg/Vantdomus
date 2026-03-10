import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../config";
import { addExpense, listExpenses } from "../lib/api";

export function FinanceScreen() {
  const [hid, setHid] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    setError("");
    setLoading(true);
    try {
      const e = await listExpenses(hid);
      setItems(e.items || []);
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
      <Text style={styles.h1}>Insumos/Presupuestos</Text>
      <Text style={styles.muted}>{hid}</Text>

      <Card title="Registrar insumo">
        <View style={styles.row}>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="Costo/Monto (ej 45)"
            placeholderTextColor="#6f829b"
            keyboardType="numeric"
            style={styles.input}
          />
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={async () => {
              const v = Number(amount);
              if (!v || v <= 0) return;
              await addExpense(hid, { amount: v, currency: "USD", category: "general" });
              setAmount("");
              await refresh();
            }}
          >
            <Text style={styles.btnText}>Agregar</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      <Card title="Últimos movimientos">
        {loading ? <ActivityIndicator /> : null}
        {items.map((e) => (
          <View key={e.id} style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{e.merchant || "—"}</Text>
              <View style={styles.row}>
                <Pill text={e.category} tone={e.category === "pharmacy" ? "warn" : "muted"} />
                <Text style={styles.muted}>{e.expense_at}</Text>
              </View>
            </View>
            <Text style={styles.amount}><Text style={{ fontWeight: "900" }}>{e.amount}</Text> <Text style={styles.muted}>{e.currency}</Text></Text>
          </View>
        ))}
        {!loading && items.length === 0 ? <Text style={styles.muted}>Sin movimientos registrados.</Text> : null}
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
  btn: { borderWidth: 1, borderColor: "#1f2a3a", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.03)" },
  btnPrimary: { borderColor: "rgba(91,124,250,0.5)", backgroundColor: "rgba(91,124,250,0.18)" },
  btnText: { color: "#e9f0ff", fontWeight: "700" },
  item: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "rgba(31,42,58,0.6)" },
  itemTitle: { color: "#e9f0ff", fontWeight: "800", marginBottom: 4 },
  amount: { color: "#e9f0ff" },
});
