import { useSuspenseQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return <BandNotFound />;
  }

  return (
    <QueryBoundary notFoundFallback={<BandNotFound />}>
      <BandScreenInner id={parsedId} />
    </QueryBoundary>
  );
}

function BandScreenInner({ id }: { id: number }) {
  const router = useRouter();
  const { data } = useSuspenseQuery(trpc.bands.getById.queryOptions({ id }));
  const { background, textColor } = useImageColors(
    data.imageUrl ?? "",
    HERO_FALLBACK,
  );

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
});
