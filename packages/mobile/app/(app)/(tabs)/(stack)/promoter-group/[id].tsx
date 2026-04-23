import { useSuspenseQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { QueryBoundary } from "../../../../../src/components/QueryBoundary";
import { trpc } from "../../../../../src/trpc";

/**
 * Promoter group detail route (MUS-100). View-only — lists the group's
 * venues and its members. Lives inside the home-tab stack so the iOS back
 * gesture returns to PromoterHome.
 *
 * Follows the CLAUDE.md "Mobile data fetching" convention:
 *   - invalid-input short-circuit (`Number.isNaN(id)`) stays OUTSIDE the
 *     boundary since the query never fires;
 *   - inside, `useSuspenseQuery` gives non-nullable `data` and the boundary
 *     routes tRPC NOT_FOUND to the dedicated not-found fallback;
 *   - any other error gets the default retry UI from `QueryBoundary`.
 *
 * Deep-linking into `/promoter-group/<id>` works out of the box — the route
 * renders this same screen whether arrived at via row tap or direct URL.
 */
export default function PromoterGroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return <PromoterGroupNotFound />;
  }

  return (
    <QueryBoundary notFoundFallback={<PromoterGroupNotFound />}>
      <PromoterGroupScreenInner id={parsedId} />
    </QueryBoundary>
  );
}

function PromoterGroupScreenInner({ id }: { id: number }) {
  const router = useRouter();
  const { data } = useSuspenseQuery(
    trpc.promoterGroups.get.queryOptions({ id }),
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={32} color="#fff" />
        </Pressable>
        <Text testID="promoter-group-title" style={styles.title}>
          {data.name}
        </Text>
      </View>

      <View style={styles.section}>
        <Text
          testID="promoter-group-venues-section-header"
          style={styles.sectionTitle}
        >
          Venues
        </Text>
        {data.venues.length === 0 ? (
          <Text style={styles.empty}>No venues yet</Text>
        ) : (
          <View style={styles.list}>
            {data.venues.map((venue, i) => (
              <View
                key={venue.id}
                style={[
                  styles.venueRow,
                  i < data.venues.length - 1 && styles.rowBorder,
                ]}
              >
                <Text style={styles.venueName}>{venue.name}</Text>
                <Text style={styles.venueAddress}>{venue.address}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text
          testID="promoter-group-members-section-header"
          style={styles.sectionTitle}
        >
          Members
        </Text>
        {data.members.length === 0 ? (
          // The membership check on the server guarantees the caller sees at
          // least themselves here, so this branch is defensive — a future
          // schema change could surface an empty list and we don't want the
          // UI to collapse silently.
          <Text style={styles.empty}>No members yet</Text>
        ) : (
          <View style={styles.list}>
            {data.members.map((member, i) => (
              <View
                key={member.userId}
                testID={`promoter-group-member-${member.userId}`}
                style={[
                  styles.memberRow,
                  i < data.members.length - 1 && styles.rowBorder,
                ]}
              >
                <Text style={styles.memberName}>
                  {memberDisplayName(member)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

/**
 * UserContext display-name convention: firstName when present, falling back to
 * username. Inlined here (rather than imported from somewhere shared) because
 * it matches the band detail screen's local `memberDisplayName` exactly — the
 * two screens have diverged semantics (firstName vs firstName+lastName) and
 * consolidating them is out of scope for MUS-100. The band screen uses
 * firstName+lastName; the ticket's AC explicitly specifies firstName fallback
 * for this screen.
 */
function memberDisplayName(m: {
  username: string;
  firstName: string | null;
}): string {
  return m.firstName?.trim() || m.username;
}

function PromoterGroupNotFound() {
  const router = useRouter();
  return (
    <View style={styles.notFound}>
      <Pressable
        onPress={() => router.back()}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={32} color="#fff" />
      </Pressable>
      <Text style={styles.notFoundText}>Promoter group not found</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f11" },
  header: {
    paddingTop: 52,
    paddingBottom: 24,
    paddingHorizontal: 20,
    backgroundColor: "#0f0f11",
  },
  backBtn: {
    position: "absolute",
    top: 52,
    left: 16,
    zIndex: 2,
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 32,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  list: {
    backgroundColor: "#1a1a1f",
    borderRadius: 12,
    overflow: "hidden",
    marginHorizontal: 20,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2a2a30",
  },
  venueRow: {
    padding: 14,
  },
  venueName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  venueAddress: {
    color: "#7a7a85",
    fontSize: 13,
  },
  memberRow: {
    padding: 14,
  },
  memberName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
  },
  empty: {
    color: "#7a7a85",
    fontSize: 13,
    fontStyle: "italic",
    paddingHorizontal: 20,
  },
  notFound: {
    flex: 1,
    backgroundColor: "#0f0f11",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  notFoundText: { color: "#7a7a85", fontSize: 16 },
});
