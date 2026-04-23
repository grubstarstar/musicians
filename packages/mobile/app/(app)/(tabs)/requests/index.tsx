import { Ionicons } from "@expo/vector-icons";
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
  // MUS-58: the Notices / Opportunities tab now surfaces every request kind.
  // Individual rows render differently per kind (see RequestRow below) and
  // the caller's own rows are filtered server-side (MUS-61).
  const queryOptions = trpc.requests.list.queryOptions({});
  const { data } = useSuspenseQuery(queryOptions);
  // Matches are a secondary surface on this screen — we show a card at the
  // top pointing users with an open `gig-for-band` post at the gig-slot
  // requests that would match it (MUS-57).
  const matchesQueryOptions = trpc.matches.listForUser.queryOptions();
  const { data: allMatches } = useSuspenseQuery(matchesQueryOptions);
  const gigForBandMatches = allMatches.filter(
    (m) =>
      m.myRequest.kind === "gig-for-band" &&
      m.counterpart.kind === "band-for-gig-slot",
  );
  const [refreshing, setRefreshing] = useState(false);

  // `useSuspenseQuery.refetch` exists but going through `queryClient` keeps
  // the call site uniform with how we'd invalidate from elsewhere and
  // avoids tangling with the Suspense render cycle.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryOptions.queryKey }),
        queryClient.invalidateQueries({
          queryKey: matchesQueryOptions.queryKey,
        }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryOptions.queryKey, matchesQueryOptions.queryKey]);

  // `now` is captured once per render; that's fine here because relative
  // labels are only read at paint time. If we needed a ticking clock we'd
  // reach for a state interval instead.
  const now = new Date();

  if (data.length === 0 && gigForBandMatches.length === 0) {
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
      ListHeaderComponent={
        gigForBandMatches.length > 0 ? (
          <GigForBandMatchesCard matches={gigForBandMatches} />
        ) : null
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6c63ff"
          colors={["#6c63ff"]}
        />
      }
      renderItem={({ item }) => (
        <RequestRow
          id={item.id}
          kind={item.kind}
          details={item.details}
          band={item.band}
          gig={item.anchorGig}
          createdAt={new Date(item.createdAt)}
          now={now}
        />
      )}
    />
  );
}

// --- Match suggestion card -----------------------------------------------

type GigForBandMatch = {
  counterpart: {
    id: number;
    gigVenueName: string | null;
    gigDatetime: Date | string | null;
  };
};

function GigForBandMatchesCard({ matches }: { matches: GigForBandMatch[] }) {
  const router = useRouter();
  return (
    <View style={styles.matchCard}>
      <Text style={styles.matchCardTitle}>
        {matches.length} gig slot{matches.length === 1 ? "" : "s"} match your
        gig-for-band post
      </Text>
      <Text style={styles.matchCardBody}>Tap to open and express interest.</Text>
      <View style={styles.matchList}>
        {matches.slice(0, 5).map((m) => {
          const venue = m.counterpart.gigVenueName ?? "a venue";
          const date = formatCounterpartDate(m.counterpart.gigDatetime);
          return (
            <Pressable
              key={m.counterpart.id}
              onPress={() => router.navigate(`/request/${m.counterpart.id}`)}
              style={({ pressed }) => [
                styles.matchRow,
                pressed && styles.matchRowPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`View gig slot at ${venue}${date ? ` on ${date}` : ""}`}
            >
              <Text style={styles.matchRowText} numberOfLines={1}>
                {venue}
                {date ? ` • ${date}` : ""}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#7a7a85" />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function formatCounterpartDate(
  datetime: Date | string | null,
): string {
  if (datetime === null) return "";
  const d = typeof datetime === "string" ? new Date(datetime) : datetime;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Polymorphic row shape: we pass the already-shaped details + anchor through
// from the server and pick render fields by `kind`. The server keeps a
// per-kind discriminated union of `details` so we can narrow safely here.
type RowDetails =
  | { kind: "musician-for-band"; instrument: string; rehearsalCommitment?: string }
  | { kind: "band-for-gig-slot"; setLength?: number; feeOffered?: number; gigId: number }
  | { kind: "gig-for-band"; bandId: number; targetDate: string; area?: string; feeAsked?: number }
  | { kind: "night-at-venue"; concept: string; possibleDates: string[] }
  | { kind: "promoter-for-venue-night"; venueId: number; proposedDate: string; concept?: string }
  | { kind: "band-for-musician"; instrument: string; availability?: string; demosUrl?: string }
  | { kind: "band_join"; bandId: number }
  | { kind: "promoter_group_join"; promoterGroupId: number };

interface RequestRowProps {
  id: number;
  kind: RowDetails["kind"];
  details: RowDetails;
  band: { id: number; name: string; imageUrl: string | null } | null;
  gig: { id: number; datetime: Date | string; venue: { id: number; name: string } } | null;
  createdAt: Date;
  now: Date;
}

function RequestRow({ id, details, band, gig, createdAt, now }: RequestRowProps) {
  const router = useRouter();
  const content = rowContentFor(details, band, gig);
  return (
    <Pressable
      onPress={() => {
        // Nested route inside the Opportunities tab's own stack (MUS-62) so
        // Back pops to this list rather than falling through to the Home tab.
        router.navigate(`/requests/${id}`);
      }}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={content.accessibilityLabel}
    >
      <Image
        source={{ uri: content.avatarUrl ?? undefined }}
        style={styles.avatar}
      />
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={styles.bandName} numberOfLines={1}>
            {content.title}
          </Text>
          <Text style={styles.timeAgo}>{formatRelative(createdAt, now)}</Text>
        </View>
        <View style={styles.metaRow}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{content.pill}</Text>
          </View>
          {content.subtitle && (
            <Text style={styles.rehearsalText} numberOfLines={1}>
              {content.subtitle}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

interface RowContent {
  title: string;
  pill: string;
  subtitle: string | null;
  avatarUrl: string | null;
  accessibilityLabel: string;
}

/** Compute the label strings for a row from the kind-specific details. Kept
 *  inline here (rather than shared) because each kind has its own copy. */
function rowContentFor(
  details: RowDetails,
  band: { name: string; imageUrl: string | null } | null,
  gig: { datetime: Date | string; venue: { name: string } } | null,
): RowContent {
  switch (details.kind) {
    case "musician-for-band": {
      const title = band?.name ?? "A band";
      return {
        title,
        pill: details.instrument,
        subtitle: details.rehearsalCommitment ?? null,
        avatarUrl: band?.imageUrl ?? null,
        accessibilityLabel: `Open request from ${title} for ${details.instrument}`,
      };
    }
    case "band-for-gig-slot": {
      const when = gig ? formatDate(gig.datetime) : "";
      const venue = gig?.venue.name ?? "a venue";
      return {
        title: `Gig slot at ${venue}`,
        pill: "Slot",
        subtitle: when || null,
        avatarUrl: null,
        accessibilityLabel: `Open gig-slot request at ${venue}${when ? ` on ${when}` : ""}`,
      };
    }
    case "gig-for-band": {
      const title = band?.name ?? "A band";
      return {
        title,
        pill: "Wants a gig",
        subtitle: details.targetDate,
        avatarUrl: band?.imageUrl ?? null,
        accessibilityLabel: `Open ${title} looking for a gig on ${details.targetDate}`,
      };
    }
    case "night-at-venue": {
      return {
        title: details.concept,
        pill: "Night",
        subtitle:
          details.possibleDates.length > 0
            ? details.possibleDates.slice(0, 3).join(", ") +
              (details.possibleDates.length > 3 ? " …" : "")
            : null,
        avatarUrl: null,
        accessibilityLabel: `Open night concept ${details.concept}`,
      };
    }
    case "promoter-for-venue-night": {
      return {
        title: details.concept ?? "Venue is free",
        pill: details.proposedDate,
        subtitle: null,
        avatarUrl: null,
        accessibilityLabel: `Open venue free on ${details.proposedDate}`,
      };
    }
    case "band-for-musician": {
      return {
        title: `Musician — ${details.instrument}`,
        pill: details.instrument,
        subtitle: details.availability ?? null,
        avatarUrl: null,
        accessibilityLabel: `Open musician looking for a band — ${details.instrument}`,
      };
    }
    case "band_join": {
      // MUS-87: a user asking to join a specific band. `band` (the anchor) is
      // the target band; it's fine to reference the anchored row directly
      // because `band_join` always sets `anchor_band_id`.
      const title = band?.name ?? "A band";
      return {
        title,
        pill: "Join request",
        subtitle: null,
        avatarUrl: band?.imageUrl ?? null,
        accessibilityLabel: `Open request to join ${title}`,
      };
    }
    case "promoter_group_join": {
      // MUS-88: a user asking to join a specific promoter group. No anchor
      // column for promoter groups on `requests`, so we can't embed the
      // group name without a second lookup — renders a generic title for
      // this slice (the list surface is backend-only per AC; onboarding UI
      // that posts these requests lives in sibling tickets under MUS-84).
      return {
        title: "Promoter group",
        pill: "Join request",
        subtitle: null,
        avatarUrl: null,
        accessibilityLabel: "Open request to join a promoter group",
      };
    }
  }
}

function formatDate(datetime: Date | string): string {
  const d = typeof datetime === "string" ? new Date(datetime) : datetime;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
  matchCard: {
    padding: 14,
    backgroundColor: "#1a1a1f",
    borderRadius: 12,
    gap: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#6c63ff",
  },
  matchCardTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  matchCardBody: { color: "#7a7a85", fontSize: 13 },
  matchList: { gap: 6, marginTop: 4 },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#22222a",
    borderRadius: 8,
    gap: 8,
  },
  matchRowPressed: { opacity: 0.7 },
  matchRowText: { color: "#fff", fontSize: 14, flexShrink: 1 },
});
