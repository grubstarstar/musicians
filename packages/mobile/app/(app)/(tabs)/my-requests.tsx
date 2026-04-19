import { Ionicons } from "@expo/vector-icons";
import type { AppRouter } from "@musicians/shared";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { Image } from "expo-image";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { QueryBoundary } from "../../../src/components/QueryBoundary";
import { queryClient, trpc } from "../../../src/trpc";
import {
  formatEoiStateLabel,
  formatRequestStatusLabel,
  formatUserDisplayName,
  getEoiStateColor,
  getRequestStatusColor,
} from "../../../src/utils/eoiLabels";
import { formatRelative } from "../../../src/utils/formatRelative";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type MyRequest = RouterOutputs["requests"]["listMine"][number];
type MyEoi = MyRequest["eois"][number];

export default function MyRequestsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "top"]}>
      <ScreenHeader />
      <QueryBoundary>
        <MyRequestsList />
      </QueryBoundary>
    </SafeAreaView>
  );
}

function ScreenHeader() {
  return (
    <View style={styles.headerWrap}>
      <View style={styles.headerText}>
        <Text style={styles.heading}>My requests</Text>
        <Text style={styles.subheading}>
          Review expressions of interest on the requests you&apos;ve posted
        </Text>
      </View>
    </View>
  );
}

function MyRequestsList() {
  const queryOptions = trpc.requests.listMine.queryOptions();
  const { data } = useSuspenseQuery(queryOptions);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: queryOptions.queryKey });
    } finally {
      setRefreshing(false);
    }
  };

  const now = new Date();

  if (data.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>
          You haven&apos;t posted any requests yet.
        </Text>
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
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      renderItem={({ item }) => (
        <RequestCard
          request={item}
          now={now}
          refetchKey={queryOptions.queryKey}
        />
      )}
    />
  );
}

interface RequestCardProps {
  request: MyRequest;
  now: Date;
  refetchKey: unknown[];
}

function RequestCard({ request, now, refetchKey }: RequestCardProps) {
  const [expanded, setExpanded] = useState(true);
  const pendingCount = request.eois.filter((e) => e.state === "pending").length;

  // Surface whichever anchor applies to this request's kind. Musician-for-band
  // requests anchor to a band; band-for-gig-slot anchors to a gig at a venue.
  const header =
    request.anchorBand !== null
      ? {
          title: request.anchorBand.name,
          imageUrl: request.anchorBand.imageUrl,
        }
      : request.anchorGig !== null
        ? {
            title: `${request.anchorGig.venue.name} · ${new Date(request.anchorGig.datetime).toLocaleDateString()}`,
            imageUrl: null,
          }
        : { title: "Untitled request", imageUrl: null };

  const subtitle =
    request.details.kind === "musician-for-band"
      ? request.details.instrument
      : "Band needed for gig slot";

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.cardHeader, pressed && styles.pressed]}
      >
        <Image
          source={{ uri: header.imageUrl ?? undefined }}
          style={styles.bandThumb}
        />
        <View style={styles.cardHeaderBody}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.bandName} numberOfLines={1}>
              {header.title}
            </Text>
            <StatusPill status={request.status} />
          </View>
          <Text style={styles.cardSubtitle}>
            {subtitle}
            {pendingCount > 0 && ` · ${pendingCount} pending`}
          </Text>
          <Text style={styles.cardMeta}>
            {request.slotsFilled} / {request.slotCount} filled ·{" "}
            {formatRelative(new Date(request.createdAt), now)}
          </Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color="#7a7a85"
        />
      </Pressable>

      {expanded && (
        <View style={styles.eoiListWrap}>
          {request.eois.length === 0 ? (
            <Text style={styles.emptyEoi}>No expressions of interest yet.</Text>
          ) : (
            request.eois.map((eoi) => (
              <EoiRow key={eoi.id} eoi={eoi} refetchKey={refetchKey} />
            ))
          )}
        </View>
      )}
    </View>
  );
}

function StatusPill({ status }: { status: MyRequest["status"] }) {
  return (
    <View
      style={[
        styles.statusPill,
        { backgroundColor: getRequestStatusColor(status) },
      ]}
    >
      <Text style={styles.statusPillText}>
        {formatRequestStatusLabel(status)}
      </Text>
    </View>
  );
}

interface EoiRowProps {
  eoi: MyEoi;
  refetchKey: unknown[];
}

function EoiRow({ eoi, refetchKey }: EoiRowProps) {
  const [error, setError] = useState<string | null>(null);

  const respond = useMutation(
    trpc.expressionsOfInterest.respond.mutationOptions({
      onSuccess: () => {
        setError(null);
        queryClient.invalidateQueries({ queryKey: refetchKey });
      },
      onError: (err) => {
        setError(err.message);
      },
    }),
  );

  const deciding = respond.isPending;
  const pending = eoi.state === "pending";
  const name = formatUserDisplayName(eoi.targetUser);
  const notes =
    eoi.details?.kind === "musician-for-band" ? eoi.details.notes : undefined;

  return (
    <View style={styles.eoiRow}>
      <View style={styles.eoiHeaderRow}>
        <Text style={styles.eoiName} numberOfLines={1}>
          {name}
        </Text>
        {!pending && (
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
        )}
      </View>

      {notes && <Text style={styles.eoiNotes}>{notes}</Text>}

      {pending && (
        <View style={styles.eoiActionsRow}>
          <Pressable
            onPress={() =>
              respond.mutate({ eoiId: eoi.id, decision: "accepted" })
            }
            disabled={deciding}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.acceptBtn,
              pressed && !deciding && styles.pressed,
              deciding && styles.actionDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Accept expression of interest from ${name}`}
          >
            {deciding ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionText}>Accept</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() =>
              respond.mutate({ eoiId: eoi.id, decision: "rejected" })
            }
            disabled={deciding}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.rejectBtn,
              pressed && !deciding && styles.pressed,
              deciding && styles.actionDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Reject expression of interest from ${name}`}
          >
            {deciding ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionText}>Reject</Text>
            )}
          </Pressable>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f11" },
  headerWrap: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerText: { flex: 1 },
  heading: { color: "#fff", fontSize: 28, fontWeight: "700" },
  subheading: { color: "#7a7a85", fontSize: 14, marginTop: 4 },
  listContent: { paddingHorizontal: 20, paddingBottom: 32 },
  card: {
    backgroundColor: "#1a1a1f",
    borderRadius: 12,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
    minHeight: 72,
  },
  cardHeaderBody: { flex: 1 },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  bandThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#0f0f11",
  },
  bandName: { color: "#fff", fontSize: 16, fontWeight: "600", flexShrink: 1 },
  cardSubtitle: { color: "#c8c8d0", fontSize: 13, marginTop: 4 },
  cardMeta: { color: "#7a7a85", fontSize: 12, marginTop: 2 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusPillText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  eoiListWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#2a2a30",
  },
  eoiRow: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2a2a30",
    gap: 8,
  },
  eoiHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  eoiName: { color: "#fff", fontSize: 15, fontWeight: "600", flexShrink: 1 },
  eoiNotes: { color: "#c8c8d0", fontSize: 13, lineHeight: 18 },
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
  eoiActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptBtn: { backgroundColor: "#3fa66a" },
  rejectBtn: { backgroundColor: "#2a2a30" },
  actionText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  actionDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  error: { color: "#ff6b6b", fontSize: 13 },
  emptyEoi: {
    color: "#7a7a85",
    fontSize: 13,
    padding: 12,
    fontStyle: "italic",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyText: { color: "#7a7a85", fontSize: 15, textAlign: "center" },
});
