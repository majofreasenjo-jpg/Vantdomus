import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../config";
import { createTask, listTasks, markTaskDone } from "../lib/api";
import { useTaxonomy, getViewLabel } from "../context/TaxonomyContext";

// Categorías Kanban en mobile (3 columnas).
// Mapeo desde los status string del backend hacia la columna visual:
//   "open" → Por hacer
//   "in_progress" → En curso
//   "done" → Hecho
const KANBAN_COLUMNS = [
  { key: "open", family_label: "Por hacer", default_label: "Por hacer", emoji: "📌" },
  { key: "in_progress", family_label: "En curso", default_label: "En curso", emoji: "⏳" },
  { key: "done", family_label: "Hecho", default_label: "Completado", emoji: "✓" },
] as const;

function fmtDueDate(iso: string | null | undefined, family: boolean): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (family) {
      if (diffDays === 0) return "Hoy";
      if (diffDays === 1) return "Mañana";
      if (diffDays === -1) return "Ayer";
      if (diffDays > 0 && diffDays <= 7) return `En ${diffDays} días`;
      if (diffDays < 0 && diffDays >= -7) return `Hace ${-diffDays} días`;
    }
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

export function TasksScreen() {
  const { tax } = useTaxonomy();
  const [hid, setHid] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    setError("");
    setLoading(true);
    try {
      const t = await listTasks(hid);
      setItems(t.items || []);
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
      <Text style={styles.h1}>{tax.tasks}</Text>
      {!tax.family_mode ? <Text style={styles.muted}>{hid}</Text> : null}

      <Card title={getViewLabel(tax, "tasks_create", "Crear")}>
        <View style={styles.row}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={
              tax.family_mode
                ? "Nueva tarea (ej. Comprar pan)"
                : `Nueva ${tax.tasks.toLowerCase()}`
            }
            placeholderTextColor="#6f829b"
            style={styles.input}
          />
          <Pressable
            style={[styles.btn, styles.btnPrimary, { borderColor: tax.theme?.primary, backgroundColor: tax.theme?.primary }]}
            onPress={async () => {
              if (!title.trim()) return;
              await createTask(hid, { title: title.trim(), priority: "medium" });
              setTitle("");
              await refresh();
            }}
          >
            <Text style={styles.btnText}>{tax.family_mode ? "Agregar" : "Crear"}</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      {/* Kanban-style 3 columnas stacked vertically.
          Cada columna agrupa tareas por status. Si family_mode,
          se usa copy y emoji familiar; sino el tono operacional. */}
      {!loading ? (
        <>
          {KANBAN_COLUMNS.map((col) => {
            const colItems = items.filter((t) => {
              // "open" agrupa también tareas sin status definido
              if (col.key === "open") {
                return !t.status || t.status === "open";
              }
              return t.status === col.key;
            });
            const colLabel = tax.family_mode ? col.family_label : col.default_label;
            return (
              <Card
                key={col.key}
                title={`${col.emoji}  ${colLabel}  ·  ${colItems.length}`}
              >
                {colItems.length === 0 ? (
                  <Text style={styles.muted}>
                    {col.key === "done"
                      ? (tax.family_mode ? "Aún no marcaron nada como hecho." : "Sin completadas.")
                      : col.key === "in_progress"
                      ? (tax.family_mode ? "Nadie está trabajando en algo ahora mismo." : "Sin en curso.")
                      : (tax.family_mode ? "Todo en orden 🌱" : "Sin pendientes.")}
                  </Text>
                ) : null}
                {colItems.map((t) => (
                  <View key={t.id} style={styles.item}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{t.title}</Text>
                      <View style={styles.row}>
                        <Pill
                          text={tax.family_mode
                            ? (t.priority === "high" ? "urgente" : t.priority === "medium" ? "normal" : "tranqui")
                            : t.priority
                          }
                          tone={t.priority === "high" ? "bad" : t.priority === "medium" ? "warn" : "muted"}
                        />
                        {t.due_at ? (
                          <Text style={styles.muted}>
                            {fmtDueDate(t.due_at, tax.family_mode)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {col.key !== "done" ? (
                      <Pressable
                        style={styles.btn}
                        onPress={async () => { await markTaskDone(hid, t.id); await refresh(); }}
                      >
                        <Text style={styles.btnText}>
                          {tax.family_mode ? "✓ Hecho" : getViewLabel(tax, "tasks_done_btn", "Done")}
                        </Text>
                      </Pressable>
                    ) : (
                      <Pill text={tax.family_mode ? "✓" : "done"} tone="good" />
                    )}
                  </View>
                ))}
              </Card>
            );
          })}
          {items.length === 0 ? (
            <Card title="">
              <Text style={styles.muted}>
                {getViewLabel(tax, "tasks_empty", `Sin ${tax.tasks.toLowerCase()} asignadas.`)}
              </Text>
            </Card>
          ) : null}
        </>
      ) : (
        <ActivityIndicator style={{ marginTop: 24 }} />
      )}
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
  btnText: { color: "#e9f0ff", fontWeight: "700", textAlign: "center" },
  item: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "rgba(31,42,58,0.6)" },
  itemTitle: { color: "#e9f0ff", fontWeight: "800", marginBottom: 4 },
});
