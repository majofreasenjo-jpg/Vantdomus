import React from "react";
import { View, Text, StyleSheet } from "react-native";

export function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#121a26",
    borderColor: "#1f2a3a",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  title: {
    color: "#93a4b8",
    fontSize: 12,
    marginBottom: 8,
    fontWeight: "700",
  },
});
