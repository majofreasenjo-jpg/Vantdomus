import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Card } from "../components/Card";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../config";
import { chatAssistant } from "../lib/api";

export function ChatScreen() {
  const [hid, setHid] = useState<string>("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "Hola. Soy VantDomus. Pregúntame por el estado del hogar, alertas, tareas o salud." }
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
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 80}
      >
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.h1}>Chat</Text>
          <Text style={styles.muted}>{hid}</Text>

          <Card title="Conversación">
            {messages.map((m, idx) => (
              <View key={idx} style={[styles.bubble, m.role === "user" ? styles.user : styles.assistant]}>
                <Text style={styles.bubbleText}>{m.content}</Text>
              </View>
            ))}
            {loading ? <ActivityIndicator style={{ marginTop: 10 }} /> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </Card>
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Escribe aquí…"
            placeholderTextColor="#6f829b"
            style={styles.input}
            onSubmitEditing={send}
          />
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={send}>
            <Text style={styles.btnText}>Enviar</Text>
          </Pressable>
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
  bubble: { padding: 10, borderRadius: 14, marginTop: 8, borderWidth: 1, borderColor: "rgba(31,42,58,0.6)" },
  user: { alignSelf: "flex-end", backgroundColor: "rgba(91,124,250,0.18)", borderColor: "rgba(91,124,250,0.5)" },
  assistant: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.03)" },
  bubbleText: { color: "#e9f0ff" },
  inputBar: { flexDirection: "row", padding: 12, borderTopWidth: 1, borderTopColor: "#1f2a3a", backgroundColor: "#0b0f17" },
  input: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: "#1f2a3a", backgroundColor: "rgba(255,255,255,0.03)", color: "#e9f0ff", marginRight: 10 },
  btn: { borderWidth: 1, borderColor: "#1f2a3a", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.03)" },
  btnPrimary: { borderColor: "rgba(91,124,250,0.5)", backgroundColor: "rgba(91,124,250,0.18)" },
  btnText: { color: "#e9f0ff", fontWeight: "700" },
});
