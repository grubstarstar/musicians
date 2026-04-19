import type { AppRouter } from "@musicians/shared";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
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
import { queryClient, trpc } from "../../../../src/trpc";
import { deriveAppliedRowHeader } from "../../../../src/utils/appliedRowHeader";
import {
  formatEoiStateLabel,
  getEoiStateColor,
} from "../../../../src/utils/eoiLabels";
import { formatRelative } from "../../../../src/utils/formatRelative";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type MyEoiRow = RouterOutputs["expressionsOfInterest"]["listMine"][number];

export default function AppliedScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "top"]}>
      <View style={styles.headerWrap}>
        <Text style={styles.heading}>Applied</Text>
        <Text style={styles.subheading}>
          Expressions of interest you&apos;ve sent
        </Text>
      </View>
      <QueryBoundary>
        <AppliedList />
      </QueryBoundary>
    </SafeAreaView>
  );
}

function AppliedList() {
  const queryOptions = trpc.expressionsOfInterest.listMine.queryOptions();
  const { data } = useSuspenseQuery(queryOptions);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: queryOptions.queryKey });
    } finally {
      setRefreshing(false);
    }
  }, [queryOptions.queryKey]);

  // `now` is captured once per render; relative labels only read at paint time.
  const now = new Date();

  if (data.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>
          You haven&apos;t applied to anything yet.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.eoi.id)}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6c63ff"
          colors={["#6c63ff"]}
        />
      }
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item }) => <AppliedRow row={item} now={now} />}
    />
  );
}

interface AppliedRowProps {
  row: MyEoiRow;
  now: Date;
}

function AppliedRow({ row, now }: AppliedRowProps) {
  const router = useRouter();
  const { eoi, request } = row;
  const header = deriveAppliedRowHeader(request);

  const createdAt = new Date(eoi.createdAt);
  const decidedAt = eoi.decidedAt ? new Date(eoi.decidedAt) : null;

  return (
    <Pressable
      onPress={() => {
        // Navigate inside the Applied stack so back-nav returns here rather
        // than jumping to the Home/Notices stack that also hosts request detail.
        router.navigate(`/applied/${request.id}`);
      }}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open application to ${header.title}`}
    >
      <Image
        source={{ uri: header.imageUrl ?? undefined }}
        style={styles.avatar}
      />
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={styles.title} numberOfLines={1}>
            {header.title}
          </Text>
          <View
            style={[
              styles.statePill,
              { backgroundColor: getEoiStateColor(eoi.state) },
            ]}
          >
            <Text style={styles.statePillText}>
              {formatEoiStateLabel(eoi.state)}
            </Text>
          </View>
        </View>
        {header.subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {header.subtitle}
          </Text>
        )}
        <Text style={styles.meta}>
          Applied {formatRelative(createdAt, now)}
          {decidedAt ? ` · Decided ${formatRelative(decidedAt, now)}` : ""}
        </Text>
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
  rowBody: { flex: 1, justifyContent: "center", gap: 4 },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: { color: "#fff", fontSize: 16, fontWeight: "600", flexShrink: 1 },
  subtitle: { color: "#c8c8d0", fontSize: 13 },
  meta: { color: "#7a7a85", fontSize: 12 },
  statePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statePillText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyText: { color: "#7a7a85", fontSize: 15, textAlign: "center" },
});
