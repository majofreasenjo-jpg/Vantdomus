import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../config";
import { addExpense, listExpenses } from "../lib/api";
import { useTaxonomy } from "../context/TaxonomyContext";

// Categorías para el modo familia. Cuando se agregue selector visual queda
// listo. Por ahora elige una categoría por defecto coherente con el preset.
const FAMILY_DEFAULT_CATEGORY = "groceries";
const FAMILY_DEFAULT_CURRENCY = "CLP";

// Formato amigable de moneda (ej. $145.000 CLP, $45 USD).
function fmtMoney(amount: number, currency: string): string {
  try {
    const formatter = new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: currency || "CLP",
      maximumFractionDigits: currency === "CLP" ? 0 : 2,
    });
    return formatter.format(amount);
  } catch {
    return `${amount} ${currency || ""}`.trim();
  }
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-CL", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return iso;
  }
}

// Tags amistosos por categoría (modo familia). Cuando family_mode=false caemos
// al string crudo del backend.
const FAMILY_CATEGORY_LABEL: Record<string, string> = {
  groceries: "Supermercado",
  health: "Salud",
  pharmacy: "Farmacia",
  utilities: "Servicios",
  school: "Colegio",
  education: "Educación",
  senior: "Adulto mayor",
  general: "Hogar",
};

export function FinanceScreen() {
  const { tax } = useTaxonomy();
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
    <ScrollView style={[styles.container, { backgroundColor: tax.theme?.bg || "#0b0f17" }]} contentContainerStyle={{ padding: 16, width: "100%", maxWidth: 640, alignSelf: "center", minHeight: "100%" }}>
      <Text style={styles.h1}>{tax.finance}</Text>
      {!tax.family_mode ? <Text style={styles.muted}>{hid}</Text> : null}

      <Card title={tax.family_mode ? "Registrar un gasto" : "Registrar insumo"}>
        <View style={styles.row}>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder={tax.family_mode ? "Monto (ej. 12500)" : "Costo/Monto (ej 45)"}
            placeholderTextColor="#6f829b"
            keyboardType="numeric"
            style={styles.input}
          />
          <Pressable
            style={[styles.btn, styles.btnPrimary, { borderColor: tax.theme?.primary, backgroundColor: tax.theme?.primary }]}
            onPress={async () => {
              const v = Number(amount);
              if (!v || v <= 0) return;
              const currency = tax.family_mode ? FAMILY_DEFAULT_CURRENCY : "USD";
              const category = tax.family_mode ? FAMILY_DEFAULT_CATEGORY : "general";
              await addExpense(hid, { amount: v, currency, category });
              setAmount("");
              await refresh();
            }}
          >
            <Text style={styles.btnText}>Agregar</Text>
          </Pressable>
        </View>
        {tax.family_mode ? (
          <Text style={styles.muted}>Se registra en {FAMILY_DEFAULT_CURRENCY} bajo "{FAMILY_CATEGORY_LABEL[FAMILY_DEFAULT_CATEGORY]}". Cambiá la categoría desde el panel web.</Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      <Card title={tax.family_mode ? "Últimos gastos" : "Últimos movimientos"}>
        {loading ? <ActivityIndicator /> : null}
        {items.map((e) => {
          const categoryLabel = tax.family_mode
            ? (FAMILY_CATEGORY_LABEL[e.category] || e.category)
            : e.category;
          const isHealthRelated = ["pharmacy", "health"].includes(e.category);
          return (
            <View key={e.id} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{e.merchant || (tax.family_mode ? "Sin comercio" : "—")}</Text>
                <View style={styles.row}>
                  <Pill text={categoryLabel} tone={isHealthRelated ? "warn" : "muted"} />
                  <Text style={styles.muted}>{fmtDate(e.expense_at)}</Text>
                </View>
                {e.notes ? <Text style={styles.muted}>{e.notes}</Text> : null}
              </View>
              <Text style={styles.amount}>
                <Text style={{ fontWeight: "900" }}>{fmtMoney(e.amount, e.currency)}</Text>
              </Text>
            </View>
          );
        })}
        {!loading && items.length === 0 ? (
          <Text style={styles.muted}>
            {tax.family_mode
              ? "Sin gastos registrados todavía. Agregá el primero con el botón de arriba."
              : "Sin movimientos registrados."}
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
  btn: { borderWidth: 1, borderColor: "#1f2a3a", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.03)" },
  btnPrimary: { borderColor: "rgba(91,124,250,0.5)", backgroundColor: "rgba(91,124,250,0.18)" },
  btnText: { color: "#e9f0ff", fontWeight: "700" },
  item: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "rgba(31,42,58,0.6)" },
  itemTitle: { color: "#e9f0ff", fontWeight: "800", marginBottom: 4 },
  amount: { color: "#e9f0ff" },
});
