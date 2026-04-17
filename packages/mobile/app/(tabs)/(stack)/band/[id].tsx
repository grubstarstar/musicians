import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { ChipRow } from "../../../../src/components/home/ChipRow";
import { CollapsibleSection } from "../../../../src/components/CollapsibleSection";
import { TimelineList } from "../../../../src/components/home/TimelineList";
import { TrackList } from "../../../../src/components/band/TrackList";
import { mockBands } from "../../../../src/data/mockBands";
import { useImageColors } from "../../../../src/hooks/useImageColors";

export default function BandScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const band = mockBands[id];
  const { background, textColor } = useImageColors(
    band?.image ?? "",
    band?.color ?? "#0f0f11"
  );

  if (!band) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Band not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: background }]}>
      {/* Hero banner */}
      <View style={styles.heroWrapper}>
        <Image
          source={{ uri: band.image }}
          style={[styles.hero, { backgroundColor: band.color }]}
        />
        <LinearGradient
          locations={[0, 0.3, 0.7]}
          colors={["rgba(0,0,0,0)", `${background}80`, background]}
          style={styles.heroGradient}
        />
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={36} color="#fff" />
        </Pressable>
        <Text style={[styles.heroName, { color: textColor }]}>{band.name}</Text>
      </View>

      {/* Members */}
      <CollapsibleSection
        title="Members"
        textStyleOverride={{ color: textColor }}
      >
        <ChipRow chips={band.members.map((m) => ({ label: m.name }))} />
      </CollapsibleSection>

      {/* Tracks */}
      {band.tracks.length > 0 && (
        <CollapsibleSection
          title="Tracks"
          textStyleOverride={{ color: textColor }}
        >
          <TrackList tracks={band.tracks} />
        </CollapsibleSection>
      )}

      {/* Upcoming events */}
      {band.events.length > 0 && (
        <CollapsibleSection
          title="Upcoming events"
          textStyleOverride={{ color: textColor }}
        >
          <TimelineList
            items={band.events.map((e) => ({
              eventDatetime: e.datetime,
              content: (
                <View>
                  <View style={styles.eventHeader}>
                    <Text style={styles.eventVenue}>{e.venue}</Text>
                    {e.type === "rehearsal" && (
                      <View style={styles.rehearsalBadge}>
                        <Text style={styles.rehearsalBadgeText}>Rehearsal</Text>
                      </View>
                    )}
                  </View>
                  {e.doors && (
                    <Text style={styles.eventDoors}>Doors {e.doors}</Text>
                  )}
                </View>
              ),
            }))}
          />
        </CollapsibleSection>
      )}
    </ScrollView>
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
  backText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  notFound: {
    flex: 1,
    backgroundColor: "#0f0f11",
    alignItems: "center",
    justifyContent: "center",
  },
  notFoundText: { color: "#7a7a85", fontSize: 16 },
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
