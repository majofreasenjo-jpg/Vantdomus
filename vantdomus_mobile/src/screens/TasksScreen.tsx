import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../config";
import { createTask, listTasks, markTaskDone } from "../lib/api";

export function TasksScreen() {
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

  useEffect(() => { refresh(); }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.h1}>Tasks</Text>
      <Text style={styles.muted}>{hid}</Text>

      <Card title="Crear">
        <View style={styles.row}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Nueva tarea"
            placeholderTextColor="#6f829b"
            style={styles.input}
          />
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={async () => {
              if (!title.trim()) return;
              await createTask(hid, { title: title.trim(), priority: "medium" });
              setTitle("");
              await refresh();
            }}
          >
            <Text style={styles.btnText}>Crear</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      <Card title="Listado">
        {loading ? <ActivityIndicator /> : null}
        {items.map((t) => (
          <View key={t.id} style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{t.title}</Text>
              <View style={styles.row}>
                <Pill text={t.priority} tone={t.priority === "high" ? "bad" : t.priority === "medium" ? "warn" : "muted"} />
                <Text style={styles.muted}>{t.status}</Text>
              </View>
            </View>
            {t.status !== "done" ? (
              <Pressable style={styles.btn} onPress={async () => { await markTaskDone(hid, t.id); await refresh(); }}>
                <Text style={styles.btnText}>Done</Text>
              </Pressable>
            ) : (
              <Pill text="done" tone="good" />
            )}
          </View>
        ))}
        {!loading && items.length === 0 ? <Text style={styles.muted}>Sin tareas.</Text> : null}
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
});
