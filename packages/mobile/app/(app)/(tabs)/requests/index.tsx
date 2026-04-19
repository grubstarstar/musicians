import { useSuspenseQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { QueryBoundary } from "../../../../src/components/QueryBoundary";
import { trpc, queryClient } from "../../../../src/trpc";
import { formatRelative } from "../../../../src/utils/formatRelative";

export default function RequestsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "top"]}>
      <View style={styles.headerWrap}>
        <Text style={styles.heading}>Notices</Text>
        <Text style={styles.subheading}>
          Bands looking for musicians right now
        </Text>
      </View>
      <QueryBoundary>
        <RequestsList />
      </QueryBoundary>
    </SafeAreaView>
  );
}

function RequestsList() {
  const queryOptions = trpc.requests.list.queryOptions({
    kind: "musician-for-band",
  });
  const { data } = useSuspenseQuery(queryOptions);
  const [refreshing, setRefreshing] = useState(false);

  // `useSuspenseQuery.refetch` exists but going through `queryClient` keeps
  // the call site uniform with how we'd invalidate from elsewhere and
  // avoids tangling with the Suspense render cycle.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: queryOptions.queryKey });
    } finally {
      setRefreshing(false);
    }
  }, [queryOptions.queryKey]);

  // `now` is captured once per render; that's fine here because relative
  // labels are only read at paint time. If we needed a ticking clock we'd
  // reach for a state interval instead.
  const now = new Date();

  if (data.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>No notices right now</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6c63ff"
          colors={["#6c63ff"]}
        />
      }
      renderItem={({ item }) => {
        // The query is filtered to `musician-for-band` server-side, but the
        // return shape is the wider polymorphic union (MUS-56). Narrow here
        // so the TS discriminated union collapses to the musician branch and
        // `band` is non-null (musician-for-band rows always anchor to a band).
        const { details, band } = item;
        if (details.kind !== "musician-for-band" || band === null) {
          return null;
        }
        return (
          <RequestRow
            id={item.id}
            bandName={band.name}
            bandImageUrl={band.imageUrl}
            instrument={details.instrument}
            rehearsalCommitment={details.rehearsalCommitment}
            createdAt={new Date(item.createdAt)}
            now={now}
          />
        );
      }}
    />
  );
}

interface RequestRowProps {
  id: number;
  bandName: string;
  bandImageUrl: string | null;
  instrument: string;
  rehearsalCommitment: string | undefined;
  createdAt: Date;
  now: Date;
}

function RequestRow({
  id,
  bandName,
  bandImageUrl,
  instrument,
  rehearsalCommitment,
  createdAt,
  now,
}: RequestRowProps) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => {
        // Nested route inside the Opportunities tab's own stack (MUS-62) so
        // Back pops to this list rather than falling through to the Home tab.
        router.navigate(`/requests/${id}`);
      }}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open request from ${bandName} for ${instrument}`}
    >
      <Image
        source={{ uri: bandImageUrl ?? undefined }}
        style={styles.avatar}
      />
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={styles.bandName} numberOfLines={1}>
            {bandName}
          </Text>
          <Text style={styles.timeAgo}>{formatRelative(createdAt, now)}</Text>
        </View>
        <View style={styles.metaRow}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{instrument}</Text>
          </View>
          {rehearsalCommitment && (
            <Text style={styles.rehearsalText} numberOfLines={1}>
              {rehearsalCommitment}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f11" },
  headerWrap: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  heading: { color: "#fff", fontSize: 28, fontWeight: "700" },
  subheading: { color: "#7a7a85", fontSize: 14, marginTop: 4 },
  listContent: { paddingHorizontal: 20, paddingBottom: 32 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1f",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    minHeight: 72,
    gap: 12,
  },
  rowPressed: { opacity: 0.7 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#0f0f11",
  },
  rowBody: { flex: 1, justifyContent: "center", gap: 6 },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  bandName: { color: "#fff", fontSize: 16, fontWeight: "600", flexShrink: 1 },
  timeAgo: { color: "#7a7a85", fontSize: 12, fontWeight: "500" },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  pill: {
    backgroundColor: "#6c63ff",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pillText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  rehearsalText: { color: "#c8c8d0", fontSize: 13, flexShrink: 1 },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyText: { color: "#7a7a85", fontSize: 15, textAlign: "center" },
});
