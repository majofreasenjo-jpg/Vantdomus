/**
 * Sprint VG+2 — Mobile PersonLibraryScreen.
 *
 * Versión mobile de la biblioteca por persona. Más simple que la web:
 * tabs implícitos via secciones (Evidencia / Memoria / Funciones), todo
 * en scroll vertical.
 */

import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../config";
import { getPersonLibrary, listUnitFunctions } from "../lib/api";
import { useTaxonomy } from "../context/TaxonomyContext";

const EVIDENCE_LABELS: Record<string, string> = {
  checkin_confirmed: "✓ Check-in confirmado",
  checkin_missed: "✗ Check-in omitido",
  voice_confirmation: "🎙 Voz",
  photo_evidence: "📷 Foto",
  caregiver_confirmation: "👤 Cuidador",
  document_uploaded: "📄 Documento",
  assignment_completed: "✓ Entrega",
  quiz_completed: "✓ Prueba",
  medication_taken: "💊 Medicamento tomado",
  medication_missed: "❌ Medicamento omitido",
  appointment_attended: "✓ Asistió",
  appointment_missed: "❌ Faltó",
  calm_session_completed: "🌿 Calma",
  study_session_completed: "📚 Estudio",
  reward_granted: "🎁 Reconocimiento",
  alert_triggered: "⚠️ Alerta",
  ai_summary: "🤖 Resumen IA",
  manual_note: "📝 Nota",
  negative_outcome: "❗ No funcionó",
  improvement_detected: "📈 Mejora",
};

const MEMORY_LABELS: Record<string, string> = {
  preference: "🌸 Preferencia",
  routine_pattern: "🔁 Rutina",
  study_pattern: "📚 Patrón estudio",
  calm_strategy: "🌿 Calma",
  motivation_pattern: "✨ Motivación",
  risk_pattern: "⚠️ Riesgo",
  social_connection: "📞 Vínculo",
  negative_learning: "❗ No funcionó",
  improvement: "📈 Mejora",
  caregiver_note: "👤 Nota cuidador",
  family_story: "🏡 Historia",
  health_context: "🩺 Salud",
  operational_context: "⚙ Operacional",
};

const NEGATIVE_EVIDENCE = new Set([
  "checkin_missed", "medication_missed", "appointment_missed",
  "negative_outcome", "alert_triggered",
]);

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
  } catch {
    return iso || "";
  }
}

export function PersonLibraryScreen({ route, navigation }: any) {
  const { tax } = useTaxonomy();
  const isFamily = Boolean(tax?.family_mode);
  const { personId, personName } = route.params || {};
  const [hid, setHid] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [memory, setMemory] = useState<any[]>([]);
  const [functions, setFunctions] = useState<any[]>([]);
  const [tab, setTab] = useState<"evidencia" | "memoria" | "funciones">("evidencia");

  useEffect(() => {
    (async () => {
      const v = await AsyncStorage.getItem(STORAGE_KEYS.householdId) || process.env.EXPO_PUBLIC_DEFAULT_HOUSEHOLD_ID;
      if (v) setHid(v);
      else setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!hid || !personId) return;
    (async () => {
      setLoading(true);
      try {
        const [lib, fns] = await Promise.all([
          getPersonLibrary(personId, hid),
          listUnitFunctions(hid, { person_id: personId, limit: 200 }),
        ]);
        setEvidence(lib.evidence_items || []);
        setMemory(lib.memory_items || []);
        setFunctions(fns.items || []);
      } catch {}
      setLoading(false);
    })();
  }, [hid, personId]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: tax?.theme?.bg || "#0b0f17" }]}
      contentContainerStyle={{ padding: 16, width: "100%", maxWidth: 640, alignSelf: "center", minHeight: "100%" }}
    >
      <Text style={styles.h1}>
        {isFamily ? "Biblioteca de" : "Biblioteca técnica de"} {personName || "persona"}
      </Text>
      <Text style={styles.muted}>
        {isFamily
          ? "Todo lo que aprendimos sobre el cuidado y las rutinas."
          : "Trazabilidad de cumplimiento, evidencia y aprendizaje."}
      </Text>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {(["evidencia", "memoria", "funciones"] as const).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, tab === t ? styles.tabActive : null]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t ? styles.tabTextActive : null]}>
              {t === "evidencia" ? "Evidencia" : t === "memoria" ? "Memoria" : "Funciones"}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 20 }} /> : null}

      {/* Evidencia */}
      {tab === "evidencia" && !loading ? (
        <Card title={`${evidence.length} registros`}>
          {evidence.length === 0 ? (
            <Text style={styles.muted}>Sin evidencia registrada todavía.</Text>
          ) : (
            evidence.map((e) => {
              const isNeg = NEGATIVE_EVIDENCE.has(e.evidence_type);
              return (
                <View key={e.id} style={[styles.evItem, isNeg ? styles.evItemNeg : null]}>
                  <View style={styles.row}>
                    <Pill text={EVIDENCE_LABELS[e.evidence_type] || e.evidence_type} tone={isNeg ? "bad" : "good"} />
                    <Text style={styles.muted}>{fmtDate(e.created_at)}</Text>
                  </View>
                  {e.text_content ? <Text style={styles.itemText}>{e.text_content}</Text> : null}
                </View>
              );
            })
          )}
        </Card>
      ) : null}

      {/* Memoria */}
      {tab === "memoria" && !loading ? (
        <Card title={`${memory.length} memorias`}>
          {memory.length === 0 ? (
            <Text style={styles.muted}>
              {isFamily
                ? "Aún no hay memorias guardadas. Aparecen cuando el asistente o vos detectan algo importante."
                : "Sin memorias estructuradas."}
            </Text>
          ) : (
            memory.map((m) => {
              const isNeg = m.memory_type === "negative_learning" || m.memory_type === "risk_pattern";
              return (
                <View key={m.id} style={styles.memItem}>
                  <View style={styles.row}>
                    <Pill text={MEMORY_LABELS[m.memory_type] || m.memory_type} tone={isNeg ? "warn" : "good"} />
                    <Text style={styles.muted}>{Math.round((m.importance || 0) * 100)}%</Text>
                  </View>
                  <Text style={styles.itemText}>{m.content}</Text>
                </View>
              );
            })
          )}
        </Card>
      ) : null}

      {/* Funciones */}
      {tab === "funciones" && !loading ? (
        <Card title={`${functions.length} funciones de ${personName}`}>
          {functions.length === 0 ? (
            <Text style={styles.muted}>Sin funciones asignadas todavía.</Text>
          ) : (
            functions.map((f) => (
              <View key={f.id} style={styles.fnItem}>
                <Text style={styles.itemText}>{f.title}</Text>
                <View style={styles.row}>
                  <Pill text={f.category} tone="muted" />
                  <Pill text={f.status} tone={f.status === "done" ? "good" : "muted"} />
                </View>
              </View>
            ))
          )}
        </Card>
      ) : null}

      {isFamily ? (
        <Text style={styles.footer}>
          Esta biblioteca queda en tu hogar. La IA solo accede a lo que el rol permite.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f17" },
  h1: { color: "#e9f0ff", fontSize: 24, fontWeight: "900" },
  muted: { color: "#93a4b8", marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  tabsRow: { flexDirection: "row", gap: 8, marginTop: 16, marginBottom: 12 },
  tab: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
    borderWidth: 1, borderColor: "#1f2a3a",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  tabActive: { borderColor: "#10b981", backgroundColor: "rgba(16,185,129,.18)" },
  tabText: { color: "#93a4b8", fontWeight: "700", fontSize: 13 },
  tabTextActive: { color: "#e9f0ff" },
  evItem: {
    paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: "rgba(31,42,58,0.6)",
  },
  evItemNeg: { backgroundColor: "rgba(255,92,122,.05)" },
  memItem: {
    paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: "rgba(31,42,58,0.6)",
  },
  fnItem: {
    paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: "rgba(31,42,58,0.6)",
  },
  itemText: { color: "#e9f0ff", fontSize: 14, lineHeight: 20, marginTop: 6 },
  footer: { color: "#93a4b8", fontSize: 12, marginTop: 16, textAlign: "center" },
});
