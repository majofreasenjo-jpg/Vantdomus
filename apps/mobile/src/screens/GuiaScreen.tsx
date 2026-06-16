/**
 * Sprint VG+2 — Mobile GuiaScreen.
 *
 * Lista las UnitFunctions del household activo agrupadas por categoría
 * y dentro de cada categoría por persona. Cards con badges para
 * AI pendiente, evidencia requerida y prioridad.
 */

import React, { useEffect, useState, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../config";
import { listUnitFunctions, getDashboard, confirmUnitFunction, patchUnitFunction } from "../lib/api";
import { useTaxonomy, getViewLabel } from "../context/TaxonomyContext";

// Mapeo de categoría → emoji + label familiar
const CATEGORY_META: Record<string, { emoji: string; familyLabel: string; defaultLabel: string }> = {
  study: { emoji: "📚", familyLabel: "Estudio", defaultLabel: "Estudio" },
  medication: { emoji: "💊", familyLabel: "Medicamentos", defaultLabel: "Medicación" },
  health_routine: { emoji: "🩺", familyLabel: "Salud y controles", defaultLabel: "Salud" },
  hygiene: { emoji: "🧼", familyLabel: "Higiene", defaultLabel: "Higiene" },
  nutrition: { emoji: "🥗", familyLabel: "Alimentación", defaultLabel: "Nutrición" },
  sleep: { emoji: "🛌", familyLabel: "Descanso", defaultLabel: "Sueño" },
  home_chore: { emoji: "🏡", familyLabel: "Tareas del hogar", defaultLabel: "Tareas hogar" },
  appointment: { emoji: "📅", familyLabel: "Citas", defaultLabel: "Citas" },
  document_deadline: { emoji: "📄", familyLabel: "Documentos", defaultLabel: "Vencimientos" },
  finance: { emoji: "💰", familyLabel: "Cuentas y gastos", defaultLabel: "Finanzas" },
  social_connection: { emoji: "📞", familyLabel: "Vínculos", defaultLabel: "Conexión social" },
  calm_regulation: { emoji: "🌿", familyLabel: "Calma", defaultLabel: "Regulación" },
  exercise: { emoji: "🏃", familyLabel: "Movimiento", defaultLabel: "Ejercicio" },
  caregiver_task: { emoji: "🤝", familyLabel: "Cuidado", defaultLabel: "Tarea cuidador" },
  work_task: { emoji: "💼", familyLabel: "Trabajo", defaultLabel: "Trabajo" },
  operational_protocol: { emoji: "🔒", familyLabel: "Protocolo", defaultLabel: "Protocolo operacional" },
  safety_check: { emoji: "✅", familyLabel: "Verificación", defaultLabel: "Verificación de seguridad" },
};

function fmtDueDate(iso: string | null | undefined, family: boolean): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (family) {
      if (diffDays === 0) return "Hoy";
      if (diffDays === 1) return "Mañana";
      if (diffDays === -1) return "Ayer";
      if (diffDays > 0 && diffDays <= 7) return `En ${diffDays} días`;
      if (diffDays < 0 && diffDays >= -7) return `Hace ${-diffDays} días`;
    }
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
  } catch {
    return iso || "";
  }
}

export function GuiaScreen({ navigation }: any) {
  const { tax } = useTaxonomy();
  const [hid, setHid] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [persons, setPersons] = useState<any[]>([]);
  const [familyName, setFamilyName] = useState<string>("");
  const [error, setError] = useState("");

  const isFamily = Boolean(tax?.family_mode);

  useEffect(() => {
    (async () => {
      const v = await AsyncStorage.getItem(STORAGE_KEYS.householdId) || process.env.EXPO_PUBLIC_DEFAULT_HOUSEHOLD_ID;
      if (v) setHid(v);
      else setLoading(false);
    })();
  }, []);

  const refresh = async () => {
    setError("");
    try {
      const [list, dash] = await Promise.all([
        listUnitFunctions(hid, { limit: 200 }),
        getDashboard(hid),
      ]);
      setItems(list.items || []);
      setPersons(dash?.persons || []);
      setFamilyName(dash?.household?.meta?.family_name || "");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!hid) return;
    setLoading(true);
    refresh();
  }, [hid]);

  // Agrupar por categoría
  const grouped = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const f of items) {
      if (!m.has(f.category)) m.set(f.category, []);
      m.get(f.category)!.push(f);
    }
    return Array.from(m.entries());
  }, [items]);

  const stats = useMemo(() => {
    const aiPending = items.filter((f) => f.ai_needs_confirmation && !f.confirmed_at).length;
    const overdue = items.filter((f) => f.due_at && new Date(f.due_at) < new Date() && f.status !== "done").length;
    const done = items.filter((f) => f.status === "done").length;
    return { total: items.length, aiPending, overdue, done };
  }, [items]);

  const personName = (id: string) => persons.find((p) => p.id === id)?.display_name || "—";

  const onMarkDone = async (fnId: string) => {
    try {
      await patchUnitFunction(fnId, { status: "done" });
      await refresh();
    } catch {}
  };

  const onConfirm = async (fnId: string, confirmed: boolean) => {
    try {
      await confirmUnitFunction(fnId, confirmed);
      await refresh();
    } catch {}
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: tax?.theme?.bg || "#0b0f17" }]}
      contentContainerStyle={{ padding: 16, width: "100%", maxWidth: 640, alignSelf: "center", minHeight: "100%" }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); refresh(); }} />}
    >
      <Text style={styles.h1}>
        {isFamily
          ? `Tu Guía Familiar${familyName ? ` · ${familyName}` : ""}`
          : "VantGuide"}
      </Text>
      <Text style={styles.muted}>
        {isFamily
          ? "Todo lo que toca cumplir en tu hogar, agrupado por categoría."
          : "Funciones activas de tu unidad."}
      </Text>

      {/* KPIs */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Activas</Text>
          <Text style={styles.kpiBig}>{stats.total}</Text>
        </View>
        <View style={[styles.kpiCard, stats.aiPending > 0 ? styles.kpiWarn : null]}>
          <Text style={styles.kpiLabel}>✋ Confirmar IA</Text>
          <Text style={[styles.kpiBig, stats.aiPending > 0 ? { color: "#ffcc66" } : null]}>{stats.aiPending}</Text>
        </View>
        <View style={[styles.kpiCard, stats.overdue > 0 ? styles.kpiBad : null]}>
          <Text style={styles.kpiLabel}>Vencidas</Text>
          <Text style={[styles.kpiBig, stats.overdue > 0 ? { color: "#ff5c7a" } : null]}>{stats.overdue}</Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator style={{ marginTop: 20 }} /> : null}

      {!loading && items.length === 0 ? (
        <Card title={isFamily ? "Sin funciones todavía" : "Vacío"}>
          <Text style={styles.muted}>
            {isFamily
              ? "Cuando agregues medicamentos, rutinas o agenda escolar aparecerán acá."
              : "No hay unit_functions registradas."}
          </Text>
        </Card>
      ) : null}

      {grouped.map(([cat, fns]) => {
        const meta = CATEGORY_META[cat] || { emoji: "•", familyLabel: cat, defaultLabel: cat };
        const label = isFamily ? meta.familyLabel : meta.defaultLabel;
        return (
          <Card key={cat} title={`${meta.emoji}  ${label}  ·  ${fns.length}`}>
            {fns.map((f) => {
              const aiPending = !!(f.ai_needs_confirmation && !f.confirmed_at);
              const overdue = f.due_at && new Date(f.due_at) < new Date() && f.status !== "done";
              return (
                <View key={f.id} style={[styles.item, aiPending && styles.itemAiPending]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{f.title}</Text>
                    <View style={styles.row}>
                      <Pill
                        text={f.priority === "high" || f.priority === "urgent" ? "urgente" : f.priority === "medium" ? "media" : "tranqui"}
                        tone={f.priority === "urgent" || f.priority === "high" ? "bad" : f.priority === "medium" ? "warn" : "muted"}
                      />
                      {f.due_at ? (
                        <Text style={[styles.muted, overdue ? { color: "#ff5c7a" } : null]}>
                          {fmtDueDate(f.due_at, isFamily)}
                        </Text>
                      ) : null}
                      {f.person_id ? <Text style={styles.muted}>· {personName(f.person_id)}</Text> : null}
                    </View>
                    {aiPending ? (
                      <Text style={styles.aiHint}>✋ Sugerencia IA — falta confirmar</Text>
                    ) : null}
                  </View>

                  {aiPending ? (
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <Pressable style={[styles.btnSmall, styles.btnPrimary]} onPress={() => onConfirm(f.id, true)}>
                        <Text style={styles.btnText}>✓</Text>
                      </Pressable>
                      <Pressable style={styles.btnSmall} onPress={() => onConfirm(f.id, false)}>
                        <Text style={styles.btnText}>✗</Text>
                      </Pressable>
                    </View>
                  ) : f.status !== "done" ? (
                    <Pressable style={styles.btnSmall} onPress={() => onMarkDone(f.id)}>
                      <Text style={styles.btnText}>{isFamily ? "✓ Hecho" : "Done"}</Text>
                    </Pressable>
                  ) : (
                    <Pill text="✓" tone="good" />
                  )}
                </View>
              );
            })}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f17" },
  h1: { color: "#e9f0ff", fontSize: 24, fontWeight: "900" },
  muted: { color: "#93a4b8", marginTop: 4 },
  error: { color: "#ff5c7a", marginTop: 10 },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  kpiRow: { flexDirection: "row", gap: 8, marginTop: 16, marginBottom: 6 },
  kpiCard: {
    flex: 1, padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: "#1f2a3a",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  kpiWarn: { borderColor: "rgba(255,204,102,.4)" },
  kpiBad: { borderColor: "rgba(255,92,122,.4)" },
  kpiLabel: { color: "#93a4b8", fontSize: 11 },
  kpiBig: { color: "#e9f0ff", fontSize: 24, fontWeight: "900", marginTop: 4 },
  item: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: "rgba(31,42,58,0.6)",
    gap: 10,
  },
  itemAiPending: {
    backgroundColor: "rgba(255,204,102,.05)",
  },
  itemTitle: { color: "#e9f0ff", fontWeight: "700", marginBottom: 4 },
  aiHint: { color: "#ffcc66", fontSize: 12, marginTop: 4 },
  btnSmall: {
    borderWidth: 1, borderColor: "#1f2a3a",
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  btnPrimary: { borderColor: "rgba(49,208,122,.5)", backgroundColor: "rgba(49,208,122,.18)" },
  btnText: { color: "#e9f0ff", fontWeight: "700", textAlign: "center" },
});
