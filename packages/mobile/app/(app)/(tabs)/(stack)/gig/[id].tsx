import { useSuspenseQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { QueryBoundary } from "../../../../../src/components/QueryBoundary";
import { trpc } from "../../../../../src/trpc";
import {
  formatGigDatetime,
  formatGigStatusLabel,
  formatSetLabel,
  organiserDisplayName,
} from "../../../../../src/utils/formatGigHeader";

/**
 * Gig detail route (MUS-104). Renders the header (venue-as-title, datetime,
 * organiser, status), the slot list in `set_order` asc, and a per-slot `+`
 * CTA on open slots — but only for the organiser. Non-organisers see the
 * same list without the action affordance.
 *
 * Follows the CLAUDE.md "Mobile data fetching" convention:
 *   - invalid-input short-circuit (`Number.isNaN(id)`) stays OUTSIDE the
 *     boundary so the query never fires for garbage ids;
 *   - inside, `useSuspenseQuery` gives non-nullable data and the boundary
 *     routes tRPC NOT_FOUND to the dedicated gig-not-found fallback;
 *   - any other error gets the default retry UI from `QueryBoundary`.
 */
export default function GigScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return <GigNotFound />;
  }

  return (
    <QueryBoundary notFoundFallback={<GigNotFound />}>
      <GigScreenInner id={parsedId} />
    </QueryBoundary>
  );
}

function GigScreenInner({ id }: { id: number }) {
  const router = useRouter();
  const { data } = useSuspenseQuery(trpc.gigs.getById.queryOptions({ id }));
  const { data: me } = useSuspenseQuery(trpc.system.whoami.queryOptions());

  // Organiser-only affordances. `me.id` is a string (JWT `sub`), the gig's
  // organiser id is a number — normalise before comparing. Mirrors the same
  // pattern used by the band + promoter-group screens.
  const isOrganiser = me.id === String(data.organiser.id);

  return (
    <ScrollView
      style={styles.container}
      testID="gig-detail-screen"
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={32} color="#fff" />
        </Pressable>

        {/* The schema has no `title` column on gigs today — we render the
            venue name as the screen title, which is how promoters refer to
            gigs in practice ("that Dog & Duck show"). When a title column
            lands, swap this to `data.title ?? data.venue.name`. */}
        <Text style={styles.title}>{data.venue.name}</Text>

        <View style={styles.metaRow}>
          {/* tRPC serialises `Date` fields as ISO strings over the wire even
              though the server types them as `Date`. Coerce defensively — the
              rehearsals + my-requests screens follow the same pattern. */}
          <Text style={styles.metaText}>
            {formatGigDatetime(new Date(data.datetime))}
          </Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>
              {formatGigStatusLabel(data.status)}
            </Text>
          </View>
        </View>

        <Text style={styles.organiserLine}>
          Organised by {organiserDisplayName(data.organiser)}
        </Text>
      </View>

      <View style={styles.slotsSection}>
        <Text style={styles.sectionTitle}>Lineup</Text>
        <View style={styles.slotsList}>
          {data.slots.map((slot, i) => (
            <SlotRow
              key={slot.id}
              slot={slot}
              // `position` is the 1-based index into the sorted slot list —
              // what the UI renders as "Set 1/2/3". `setOrder` stays the
              // underlying storage value, which is what we pin the testID to
              // so qa-automate can target rows regardless of whether the
              // fixture stores 0- or 1-based set_order values.
              position={i + 1}
              isLast={i === data.slots.length - 1}
              isOrganiser={isOrganiser}
              onOpenBand={() =>
                slot.band && router.push(`/band/${slot.band.id}`)
              }
              onPostRequest={() =>
                router.navigate(
                  `/post-request?kind=band-for-gig-slot&slotId=${slot.id}`,
                )
              }
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

interface SlotRowProps {
  slot: {
    id: number;
    setOrder: number;
    bandId: number | null;
    band: { id: number; name: string } | null;
    genre: { id: number; slug: string; name: string } | null;
  };
  position: number;
  isLast: boolean;
  isOrganiser: boolean;
  onOpenBand: () => void;
  onPostRequest: () => void;
}

/**
 * Single slot row. The row's visual + interactive shape depends on two axes:
 *
 *   - filled (band non-null) vs open (band null);
 *   - viewer is organiser vs not.
 *
 * Filled slots tap through to the band regardless of viewer. Open slots
 * render the `+` CTA only when the viewer organises the gig — MUS-77 will
 * consume the `slotId` param on the post-request form to pre-fill fields;
 * this ticket only emits the URL. Non-organisers on an open slot see the
 * row without any affordance (the slot is information, not an action).
 */
function SlotRow({
  slot,
  position,
  isLast,
  isOrganiser,
  onOpenBand,
  onPostRequest,
}: SlotRowProps) {
  // testID uses the 1-based `position` for predictability — the `set_order`
  // column is 0-based in the MUS-56 seed but not constrained at the schema
  // level. Using position means qa-automate can always target the first
  // slot as `gig-slot-row-1`, second as `-2`, etc., matching the visible
  // "Set 1 / Set 2" labels.
  const testID = `gig-slot-row-${position}`;
  const rowBaseStyle = [
    styles.slotRow,
    !isLast && styles.slotRowBorder,
  ];

  const content = (
    <>
      <View style={styles.slotLeftCol}>
        <Text style={styles.slotSetLabel}>{formatSetLabel(position)}</Text>
        {slot.genre && (
          <View style={styles.genrePill}>
            <Text style={styles.genrePillText}>{slot.genre.name}</Text>
          </View>
        )}
      </View>

      <View style={styles.slotRightCol}>
        {slot.band ? (
          <Text style={styles.bandName} numberOfLines={1}>
            {slot.band.name}
          </Text>
        ) : (
          <Text style={styles.openSlotLabel}>Open slot</Text>
        )}
      </View>

      {slot.band === null && isOrganiser && (
        <Pressable
          onPress={onPostRequest}
          testID="post-request-cta-gig-slot"
          accessibilityRole="button"
          accessibilityLabel="Post request for this slot"
          style={({ pressed }) => [
            styles.ctaBtn,
            pressed && styles.ctaBtnPressed,
          ]}
          hitSlop={8}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      )}
    </>
  );

  // Filled rows are a single tappable unit (routes to band detail). Open
  // rows are non-tappable at the row level — the `+` CTA carries the only
  // interaction for organisers, and non-organisers see an inert row.
  if (slot.band) {
    return (
      <Pressable
        testID={testID}
        onPress={onOpenBand}
        accessibilityRole="button"
        accessibilityLabel={`Open ${slot.band.name}`}
        style={({ pressed }) => [...rowBaseStyle, pressed && styles.slotRowPressed]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View testID={testID} style={rowBaseStyle}>
      {content}
    </View>
  );
}

function GigNotFound() {
  return (
    <View style={styles.notFound}>
      <Text style={styles.notFoundText}>Gig not found</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f11" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 24,
  },
  backBtn: {
    position: "absolute",
    top: 52,
    left: 12,
    zIndex: 2,
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 24,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  metaText: { color: "#c8c8d0", fontSize: 14 },
  statusPill: {
    backgroundColor: "rgba(108, 99, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusPillText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  organiserLine: {
    color: "#7a7a85",
    fontSize: 13,
    marginTop: 10,
  },
  slotsSection: { marginBottom: 28 },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  slotsList: {
    backgroundColor: "#1a1a1f",
    borderRadius: 12,
    overflow: "hidden",
    marginHorizontal: 20,
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  slotRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2a2a30",
  },
  slotRowPressed: { opacity: 0.6 },
  slotLeftCol: {
    width: 100,
    gap: 6,
  },
  slotSetLabel: {
    color: "#6c63ff",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  genrePill: {
    alignSelf: "flex-start",
    backgroundColor: "#2a2a30",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  genrePillText: {
    color: "#c8c8d0",
    fontSize: 11,
    fontWeight: "600",
  },
  slotRightCol: { flex: 1 },
  bandName: { color: "#fff", fontSize: 15, fontWeight: "600" },
  openSlotLabel: {
    color: "#7a7a85",
    fontSize: 14,
    fontStyle: "italic",
  },
  ctaBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6c63ff",
  },
  ctaBtnPressed: { opacity: 0.85 },
  notFound: {
    flex: 1,
    backgroundColor: "#0f0f11",
    alignItems: "center",
    justifyContent: "center",
  },
  notFoundText: { color: "#7a7a85", fontSize: 16 },
});
