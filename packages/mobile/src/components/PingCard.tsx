import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { trpc } from "../trpc";

export function PingCard() {
  const { data, isLoading, error } = useQuery(trpc.system.ping.queryOptions());

  return (
    <View style={styles.card}>
      <Text style={styles.title}>API ping</Text>
      {isLoading && <ActivityIndicator color="#6c63ff" />}
      {error && <Text style={styles.error}>Error: {error.message}</Text>}
      {data && (
        <Text style={styles.ok}>
          OK — {new Date(data.at).toLocaleTimeString()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1a1a1f",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  title: {
    color: "#6c63ff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  ok: { color: "#8ce2a7", fontSize: 14 },
  error: { color: "#ff6b6b", fontSize: 14 },
});
