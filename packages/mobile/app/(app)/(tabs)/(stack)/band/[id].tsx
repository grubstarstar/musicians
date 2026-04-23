import { useSuspenseQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { CollapsibleSection } from "../../../../../src/components/CollapsibleSection";
import { QueryBoundary } from "../../../../../src/components/QueryBoundary";
import { TimelineList } from "../../../../../src/components/home/TimelineList";
import { TrackList } from "../../../../../src/components/band/TrackList";
import { ChipRow } from "../../../../../src/components/home/ChipRow";
import { useImageColors } from "../../../../../src/hooks/useImageColors";
import { trpc } from "../../../../../src/trpc";

const HERO_FALLBACK = "#0f0f11";

export default function BandScreen() {
  const { id, new: newParam } = useLocalSearchParams<{
    id: string;
    new?: string;
  }>();
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return <BandNotFound />;
  }

  // MUS-92: capture `?new=1` once at mount. The param drives the
  // "Add members" CTA, but it's a one-shot UI hint — once consumed, we
  // strip it from the URL (see BandScreenInner) so navigating away and
  // back doesn't re-show it.
  const isNewBand = newParam === "1";

  return (
    <QueryBoundary notFoundFallback={<BandNotFound />}>
      <BandScreenInner id={parsedId} initialIsNewBand={isNewBand} />
    </QueryBoundary>
  );
}

function BandScreenInner({
  id,
  initialIsNewBand,
}: {
  id: number;
  initialIsNewBand: boolean;
}) {
  const router = useRouter();
  const { data } = useSuspenseQuery(trpc.bands.getById.queryOptions({ id }));
  const { data: me } = useSuspenseQuery(trpc.system.whoami.queryOptions());
  const { background, textColor } = useImageColors(
    data.imageUrl ?? "",
    HERO_FALLBACK,
  );

  // CTA visibility is captured at mount and never re-read from the URL —
  // see the comment block in `BandScreen` for why. We also strip `?new=1`
  // from the URL on first render so leaving and returning via a fresh
  // navigation never re-shows the CTA. `setParams({ new: undefined })`
  // updates expo-router's internal URL state without a navigation event.
  const [showAddMembersCta, setShowAddMembersCta] = useState(
    initialIsNewBand && me.id === String(data.createdByUserId),
  );
  useEffect(() => {
    if (initialIsNewBand) {
      router.setParams({ new: undefined });
    }
  }, [initialIsNewBand, router]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: background }]}>
      <View style={styles.heroWrapper}>
        <Image
          source={{ uri: data.imageUrl ?? undefined }}
          style={[styles.hero, { backgroundColor: HERO_FALLBACK }]}
        />
        <LinearGradient
          locations={[0, 0.3, 0.7]}
          colors={["rgba(0,0,0,0)", `${background}80`, background]}
          style={styles.heroGradient}
        />
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={36} color="#fff" />
        </Pressable>
        <Text style={[styles.heroName, { color: textColor }]}>{data.name}</Text>
      </View>

      {/* MUS-92: only shown to the creator immediately after a name-first
          create flow lands here with `?new=1`. The action itself is out of
          scope for MUS-92 — for now it routes the user into the existing
          MUS-70 post-request flow as `musician-for-band`, which is the
          closest "find me a member" affordance the app has today. The CTA
          state is one-shot: dismissing it (or navigating away and back)
          removes it from the screen permanently. */}
      {showAddMembersCta && (
        <AddMembersCta
          onPress={() => {
            setShowAddMembersCta(false);
            router.navigate(
              `/post-request?kind=musician-for-band&bandId=${id}`,
            );
          }}
          onDismiss={() => setShowAddMembersCta(false)}
        />
      )}

      {/* MUS-70: in-context entry point — seeds the post-request form with
          this band pre-selected as a `musician-for-band` request. Placed
          alongside the Members section since "find a new musician" is its
          natural companion. The ticket calls for a single CTA on the band
          page, not per-instrument. */}
      <PostRequestCta
        onPress={() =>
          router.navigate(
            `/post-request?kind=musician-for-band&bandId=${id}`,
          )
        }
      />

      {data.members.length > 0 && (
        <CollapsibleSection
          title="Members"
          textStyleOverride={{ color: textColor }}
        >
          <ChipRow
            chips={data.members.map((m) => ({ label: memberDisplayName(m) }))}
          />
        </CollapsibleSection>
      )}

      {data.tracks.length > 0 && (
        <CollapsibleSection
          title="Tracks"
          textStyleOverride={{ color: textColor }}
        >
          <TrackList tracks={data.tracks} />
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title="Upcoming rehearsals"
        textStyleOverride={{ color: textColor }}
      >
        {/* Independent QueryBoundary so rehearsals can load/fail separately
            from the band profile; matches the project's mobile Suspense
            pattern. */}
        <QueryBoundary>
          <UpcomingRehearsals bandId={id} />
        </QueryBoundary>
      </CollapsibleSection>
    </ScrollView>
  );
}

/**
 * MUS-70 in-context post-request entry point for the band page.
 *
 * Rendered as a compact `+ Find a musician` row so it reads as an action
 * affordance rather than navigation; `testID` is stable (`post-request-cta-band`)
 * so the qa-automate flow can target it without relying on visible text.
 */
function PostRequestCta({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      testID="post-request-cta-band"
      accessibilityRole="button"
      accessibilityLabel="Find a musician for this band"
      style={({ pressed }) => [
        styles.postRequestCta,
        pressed && styles.postRequestCtaPressed,
      ]}
    >
      <View style={styles.postRequestIcon}>
        <Ionicons name="add" size={20} color="#fff" />
      </View>
      <Text style={styles.postRequestLabel}>Find a musician</Text>
    </Pressable>
  );
}

/**
 * MUS-92 first-load "Add members" CTA. Visible only when the screen was
 * landed on with `?new=1` AND the viewer is the band's creator. Dismiss is
 * one-shot — once tapped (or once the user navigates away), the CTA is
 * gone for good on this band profile. Two actions:
 *   - the primary tap routes into the post-request flow seeded for this
 *     band, since that's the only "find a member" affordance on the app
 *     today;
 *   - the dismiss `x` lets the user opt out without going through the
 *     post-request form. Both paths set `showAddMembersCta=false` in the
 *     parent.
 */
function AddMembersCta({
  onPress,
  onDismiss,
}: {
  onPress: () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={styles.addMembersWrapper} testID="add-members-cta">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Add members to your new band"
        testID="add-members-cta-action"
        style={({ pressed }) => [
          styles.addMembersBtn,
          pressed && styles.addMembersBtnPressed,
        ]}
      >
        <View style={styles.addMembersIcon}>
          <Ionicons name="person-add" size={20} color="#fff" />
        </View>
        <View style={styles.addMembersText}>
          <Text style={styles.addMembersTitle}>Add members</Text>
          <Text style={styles.addMembersBlurb}>
            Your band is set up. Invite the rest of the lineup.
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss add members"
        testID="add-members-cta-dismiss"
        style={styles.addMembersDismiss}
        hitSlop={8}
      >
        <Ionicons name="close" size={20} color="#c8c8d0" />
      </Pressable>
    </View>
  );
}

function UpcomingRehearsals({ bandId }: { bandId: number }) {
  const { data } = useSuspenseQuery(
    trpc.rehearsals.upcomingForBand.queryOptions({ bandId }),
  );

  if (data.length === 0) {
    return <Text style={styles.empty}>No upcoming rehearsals.</Text>;
  }

  return (
    <TimelineList
      items={data.map((e) => ({
        eventDatetime: new Date(e.datetime),
        content: (
          <View>
            <View style={styles.eventHeader}>
              <Text style={styles.eventVenue}>{e.venue}</Text>
              <View style={styles.rehearsalBadge}>
                <Text style={styles.rehearsalBadgeText}>Rehearsal</Text>
              </View>
            </View>
            {e.doors && <Text style={styles.eventDoors}>Doors {e.doors}</Text>}
          </View>
        ),
      }))}
    />
  );
}

function memberDisplayName(m: {
  username: string;
  firstName: string | null;
  lastName: string | null;
}): string {
  const full = [m.firstName, m.lastName].filter(Boolean).join(" ").trim();
  return full || m.username;
}

function BandNotFound() {
  return (
    <View style={styles.notFound}>
      <Text style={styles.notFoundText}>Band not found</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f11" },
  heroWrapper: {
    height: 200,
    justifyContent: "flex-end",
    padding: 20,
    marginBottom: 24,
  },
  hero: {
    ...StyleSheet.absoluteFillObject,
  },
  heroGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 160,
    zIndex: 1,
  },
  heroName: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "800",
    zIndex: 2,
  },
  backBtn: {
    position: "absolute",
    top: 52,
    left: 16,
    borderRadius: 32,
    zIndex: 2,
  },
  notFound: {
    flex: 1,
    backgroundColor: "#0f0f11",
    alignItems: "center",
    justifyContent: "center",
  },
  notFoundText: { color: "#7a7a85", fontSize: 16 },
  empty: { color: "#7a7a85", fontSize: 14, paddingHorizontal: 20, paddingVertical: 8 },
  eventHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  eventVenue: { color: "#fff", fontSize: 14, fontWeight: "600" },
  eventDoors: { color: "#c8c8d0", fontSize: 13, marginTop: 2 },
  rehearsalBadge: {
    backgroundColor: "#2a2a30",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rehearsalBadgeText: { color: "#a0a0b0", fontSize: 11, fontWeight: "600" },
  postRequestCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#6c63ff",
    borderRadius: 10,
  },
  postRequestCtaPressed: { opacity: 0.85 },
  postRequestIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  postRequestLabel: { color: "#fff", fontSize: 15, fontWeight: "600" },
  // MUS-92 — first-load Add members CTA. Bigger / more prominent than
  // PostRequestCta because it's a one-shot onboarding affordance, but
  // still consistent with the dark-surface card pattern.
  addMembersWrapper: {
    flexDirection: "row",
    alignItems: "stretch",
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: "#1a1a1f",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#6c63ff",
    overflow: "hidden",
  },
  addMembersBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  addMembersBtnPressed: { opacity: 0.85 },
  addMembersIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6c63ff",
  },
  addMembersText: { flex: 1 },
  addMembersTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  addMembersBlurb: { color: "#c8c8d0", fontSize: 12, marginTop: 2 },
  addMembersDismiss: {
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
  },
});
