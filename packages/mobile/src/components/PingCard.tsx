import { useSuspenseQuery } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { trpc } from "../trpc";
import { QueryBoundary } from "./QueryBoundary";

export function PingCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>API ping</Text>
      <QueryBoundary loadingFallback={<ActivityIndicator color="#6c63ff" />}>
        <PingText />
      </QueryBoundary>
    </View>
  );
}

function PingText() {
  const { data } = useSuspenseQuery(trpc.system.ping.queryOptions());
  return (
    <Text style={styles.ok}>
      OK — {new Date(data.at).toLocaleTimeString()}
    </Text>
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
});
