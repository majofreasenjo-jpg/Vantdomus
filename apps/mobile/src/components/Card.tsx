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
    backgroundColor: "rgba(18,26,38,0.8)",
    borderColor: "rgba(31,42,58,0.7)",
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8,
  },
  title: {
    color: "#93a4b8",
    fontSize: 13,
    marginBottom: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
});
