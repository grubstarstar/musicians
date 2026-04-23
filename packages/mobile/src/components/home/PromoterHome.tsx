import { useSuspenseQuery } from "@tanstack/react-query";
import type { AppRouter } from "@musicians/shared";
import type { inferRouterOutputs } from "@trpc/server";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { QueryBoundary } from "../QueryBoundary";
import { trpc } from "../../trpc";
import { EntityCard } from "./Card";
import { TimelineList } from "./TimelineList";

type PromoterGroupRow =
  inferRouterOutputs<AppRouter>["promoterGroups"]["listMine"][number];

const BOOKING_REQUESTS = [
  { band: "The Skylarks", status: "awaiting" as const, color: "#6c63ff" },
  { band: "Night Owls", status: "confirmed" as const, color: "#ff6b6b" },
];

const UPCOMING_SHOWS = [
  { datetime: new Date(2026, 4, 2), band: "Night Owls", venue: "The Lexington" },
  { datetime: new Date(2026, 4, 8), band: "The Skylarks", venue: "Fox & Firkin" },
];

export function PromoterHome() {
  return (
    <ScrollView>
      <QueryBoundary>
        <MyPromoterGroups />
      </QueryBoundary>

      <View style={styles.mockSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Booking requests</Text>
          <MockPill />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mockScrollContent}
        >
          {BOOKING_REQUESTS.map((req) => (
            <EntityCard key={req.band}>
              <View style={[styles.thumbnail, { backgroundColor: req.color }]} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {req.band}
                </Text>
                <View
                  style={[
                    styles.statusPill,
                    req.status === "confirmed"
                      ? styles.pillConfirmed
                      : styles.pillAwaiting,
                  ]}
                >
                  <Text style={styles.pillText}>
                    {req.status === "confirmed" ? "Confirmed" : "Awaiting"}
                  </Text>
                </View>
              </View>
            </EntityCard>
          ))}
        </ScrollView>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Upcoming shows</Text>
        <MockPill />
      </View>
      <TimelineList
        items={UPCOMING_SHOWS.map((show) => ({
          eventDatetime: show.datetime,
          content: (
            <View>
              <Text style={styles.cardTitle}>{show.band}</Text>
              <Text style={styles.secondary}>{show.venue}</Text>
            </View>
          ),
        }))}
      />
    </ScrollView>
  );
}

function MyPromoterGroups() {
  const { data: groups } = useSuspenseQuery(
    trpc.promoterGroups.listMine.queryOptions(),
  );

  if (groups.length === 0) {
    return (
      <View
        style={styles.emptyStateWrap}
        testID="promoter-groups-empty-state"
      >
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyStateTitle}>
            You're not part of any promoter groups yet
          </Text>
          <Text style={styles.emptyStateBody}>
            Promoter groups let you team up on bookings and share venues.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.groupsWrap}>
      <Text
        style={styles.sectionTitle}
        testID="promoter-groups-section-header"
      >
        My promoter groups
      </Text>
      <View style={styles.groupsList}>
        {groups.map((group, i) => (
          <PromoterGroupRowView
            key={group.id}
            group={group}
            isLast={i === groups.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

function PromoterGroupRowView({
  group,
  isLast,
}: {
  group: PromoterGroupRow;
  isLast: boolean;
}) {
  const router = useRouter();
  return (
    // MUS-100: the row is now the affordance into the group detail screen.
    // The testID is preserved on the Pressable so the MUS-97 flow (which
    // asserts the row's visibility) keeps working, and the MUS-100 flow taps
    // the same id to navigate. `router.push` (not `navigate`) so the back
    // gesture returns to PromoterHome without replacing history.
    <Pressable
      testID={`promoter-group-row-${group.id}`}
      onPress={() => router.push(`/promoter-group/${group.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${group.name}`}
      style={({ pressed }) => [
        styles.groupRow,
        !isLast && styles.groupRowBorder,
        pressed && styles.groupRowPressed,
      ]}
    >
      <Text style={styles.groupName}>{group.name}</Text>
      {group.venues.length === 0 ? (
        <Text style={styles.venueEmpty}>No venues yet</Text>
      ) : (
        <View style={styles.venueList}>
          {group.venues.map((venue) => (
            <View key={venue.id} style={styles.venueRow}>
              <Text style={styles.venueName}>{venue.name}</Text>
              <Text style={styles.venueAddress}>{venue.address}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

function MockPill() {
  return (
    <View style={styles.mockPill}>
      <Text style={styles.mockPillText}>Mock data</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 20,
  },
  thumbnail: { height: 80 },
  cardBody: { padding: 12 },
  cardTitle: { color: "#fff", fontSize: 14, fontWeight: "600" },
  secondary: { color: "#c8c8d0", fontSize: 13, marginTop: 2 },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 8,
  },
  pillConfirmed: { backgroundColor: "rgba(76, 175, 80, 0.2)" },
  pillAwaiting: { backgroundColor: "rgba(255, 152, 0, 0.2)" },
  pillText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  mockSection: { marginBottom: 28 },
  mockScrollContent: {
    paddingLeft: 20,
    paddingRight: 12,
  },
  mockPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 12,
  },
  mockPillText: {
    color: "#7a7a85",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  groupsWrap: { marginBottom: 28 },
  groupsList: {
    backgroundColor: "#1a1a1f",
    borderRadius: 12,
    overflow: "hidden",
    marginHorizontal: 20,
  },
  groupRow: {
    padding: 14,
  },
  groupRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2a2a30",
  },
  groupRowPressed: { opacity: 0.6 },
  groupName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  venueList: { gap: 6 },
  venueRow: {},
  venueName: { color: "#fff", fontSize: 14, fontWeight: "500" },
  venueAddress: { color: "#7a7a85", fontSize: 12, marginTop: 1 },
  venueEmpty: {
    color: "#7a7a85",
    fontSize: 13,
    fontStyle: "italic",
  },
  emptyStateWrap: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  emptyStateCard: {
    backgroundColor: "#1a1a1f",
    borderRadius: 12,
    padding: 16,
  },
  emptyStateTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 6,
  },
  emptyStateBody: {
    color: "#7a7a85",
    fontSize: 13,
    lineHeight: 18,
  },
});
