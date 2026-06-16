import React from "react";
import { Text, StyleSheet } from "react-native";

export function Pill({ text, tone }: { text: string; tone?: "good"|"warn"|"bad"|"muted" }) {
  const s = [styles.pill];
  if (tone === "good") s.push(styles.good);
  if (tone === "warn") s.push(styles.warn);
  if (tone === "bad") s.push(styles.bad);
  return <Text style={s}>{text}</Text>;
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1f2a3a",
    color: "#93a4b8",
    fontSize: 12,
    marginRight: 8,
  },
  good: { color: "#31d07a", borderColor: "rgba(49,208,122,0.35)" },
  warn: { color: "#ffcc66", borderColor: "rgba(255,204,102,0.35)" },
  bad: { color: "#ff5c7a", borderColor: "rgba(255,92,122,0.35)" },
});
