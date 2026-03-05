import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Card } from "../components/Card";
import { login, register, listHouseholds } from "../lib/api";
import { STORAGE_KEYS } from "../config";

export function AuthScreen({ navigation }: any) {
  const [email, setEmail] = useState("test@demo.com");
  const [password, setPassword] = useState("demo123");
  const [error, setError] = useState("");

  const doLogin = async () => {
    setError("");
    try {
      const res = await login(email.trim(), password);
      const token = res.access_token;
      await AsyncStorage.setItem(STORAGE_KEYS.token, token);

      const hh = await listHouseholds();
      const first = (hh.items || [])[0];
      if (first?.id) {
        await AsyncStorage.setItem(STORAGE_KEYS.householdId, first.id);
        navigation.reset({ index: 0, routes: [{ name: "Dashboard" }] });
      } else {
        navigation.navigate("PickHousehold");
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  const doRegister = async () => {
    setError("");
    try {
      await register(email.trim(), password);
      await doLogin();
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  return (
    <View style={styles.container}>
      <View style={{ padding: 16 }}>
        <Text style={styles.h1}>VantDomus</Text>
        <Text style={styles.muted}>Login / Register</Text>

        <Card title="Acceso">
          <TextInput value={email} onChangeText={setEmail} placeholder="email" placeholderTextColor="#6f829b" style={styles.input} autoCapitalize="none" />
          <TextInput value={password} onChangeText={setPassword} placeholder="password" placeholderTextColor="#6f829b" style={styles.input} secureTextEntry />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={{ flexDirection: "row", marginTop: 10 }}>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={doLogin}><Text style={styles.btnText}>Login</Text></Pressable>
            <Pressable style={styles.btn} onPress={doRegister}><Text style={styles.btnText}>Register</Text></Pressable>
          </View>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f17" },
  h1: { color: "#e9f0ff", fontSize: 30, fontWeight: "900" },
  muted: { color: "#93a4b8", marginTop: 6, marginBottom: 10 },
  error: { color: "#ff5c7a", marginTop: 10 },
  input: { width: "100%", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: "#1f2a3a", backgroundColor: "rgba(255,255,255,0.03)", color: "#e9f0ff", marginTop: 10 },
  btn: { borderWidth: 1, borderColor: "#1f2a3a", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.03)", marginRight: 10 },
  btnPrimary: { borderColor: "rgba(91,124,250,0.5)", backgroundColor: "rgba(91,124,250,0.18)" },
  btnText: { color: "#e9f0ff", fontWeight: "700" },
});
