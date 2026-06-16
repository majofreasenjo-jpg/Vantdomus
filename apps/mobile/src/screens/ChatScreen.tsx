import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Card } from "../components/Card";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../config";
import { chatAssistant } from "../lib/api";
import { useTaxonomy, getViewLabel } from "../context/TaxonomyContext";

export function ChatScreen() {
  const { tax } = useTaxonomy();
  const [hid, setHid] = useState<string>("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Saludo inicial calibrado al preset (familia → cálido, default → operacional).
  const welcomeMessage = getViewLabel(
    tax,
    "chat_welcome",
    "Hola. Soy VantDomus. Pregúntame por el estado del hogar, alertas, tareas o salud."
  );
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: welcomeMessage },
  ]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.householdId) || process.env.EXPO_PUBLIC_DEFAULT_HOUSEHOLD_ID;
      if (val) setHid(val);
    })();
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setError("");
    const next = [...messages, { role: "user", content: text } as any];
    setMessages(next);
    setLoading(true);
    try {
      const res = await chatAssistant(hid, next.filter(m => m.role !== "assistant").map(m => ({ role: "user", content: m.content })));
      setMessages([...next, { role: "assistant", content: res.reply } as any]);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: tax.theme?.bg || "#0b0f17" }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 80}
      >
        <ScrollView contentContainerStyle={{ padding: 16, width: "100%", maxWidth: 640, alignSelf: "center", minHeight: "100%" }}>
          <Text style={styles.h1}>{getViewLabel(tax, "chat_title", "Asistente")}</Text>
          <Text style={styles.muted}>{getViewLabel(tax, "chat_subtitle", "Hacé tu consulta.")}</Text>

          <Card title={tax.family_mode ? "Conversación" : "Transmisiones"}>
            {messages.map((m, idx) => (
              <View key={idx} style={[styles.bubble, m.role === "user" ? [styles.user, { backgroundColor: tax.theme?.primary + "30", borderColor: tax.theme?.primary }] : styles.assistant]}>
                <Text style={styles.bubbleText}>{m.content}</Text>
              </View>
            ))}
            {loading ? <ActivityIndicator style={{ marginTop: 10 }} /> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </Card>
        </ScrollView>

        <View style={styles.inputOuter}>
          <View style={styles.inputBar}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={
                tax.family_mode
                  ? getViewLabel(tax, "chat_input_placeholder", "¿En qué te ayudo?")
                  : `Orden operativa para ${tax.unit}…`
              }
              placeholderTextColor="#6f829b"
              style={styles.input}
              onSubmitEditing={send}
            />
            <Pressable style={[styles.btn, styles.btnPrimary, { borderColor: tax.theme?.primary, backgroundColor: tax.theme?.primary }]} onPress={send}>
              <Text style={[styles.btnText, { color: "white" }]}>Enviar</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f17" },
  h1: { color: "#e9f0ff", fontSize: 26, fontWeight: "900" },
  muted: { color: "#93a4b8", marginTop: 4 },
  error: { color: "#ff5c7a", marginTop: 10 },
  bubble: { padding: 14, borderRadius: 16, marginTop: 8, borderWidth: 1, borderColor: "rgba(31,42,58,0.7)" },
  user: { alignSelf: "flex-end", backgroundColor: "rgba(91,124,250,0.18)", borderColor: "rgba(91,124,250,0.5)" },
  assistant: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.04)" },
  bubbleText: { color: "#e9f0ff", fontSize: 16, lineHeight: 22 },
  inputOuter: { backgroundColor: "rgba(11,15,23,0.9)", borderTopWidth: 1, borderTopColor: "#1f2a3a" },
  inputBar: { flexDirection: "row", padding: 12, width: "100%", maxWidth: 640, alignSelf: "center", alignItems: "center" },
  input: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: "#1f2a3a", backgroundColor: "rgba(255,255,255,0.03)", color: "#e9f0ff", marginRight: 10, fontSize: 16 },
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5 },
  btnPrimary: { borderColor: "rgba(91,124,250,0.5)", backgroundColor: "rgba(91,124,250,0.18)", borderWidth: 1 },
  btnText: { color: "#e9f0ff", fontWeight: "800" },
});
