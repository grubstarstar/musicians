import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ChipRow } from "../../../../src/components/home/ChipRow";
import { CollapsibleSection } from "../../../../src/components/CollapsibleSection";
import { TimelineList } from "../../../../src/components/home/TimelineList";
import { TrackList } from "../../../../src/components/band/TrackList";
import { mockBands } from "../../../../src/data/mockBands";

export default function BandScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const band = mockBands[id];

  if (!band) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Band not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Hero banner */}
      <View style={[styles.hero, { backgroundColor: band.color }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={36} color="#fff" />
        </Pressable>
        <Text style={styles.heroName}>{band.name}</Text>
      </View>

      {/* Members */}
      <CollapsibleSection title="Members">
        <ChipRow chips={band.members.map((m) => ({ label: m.name }))} />
      </CollapsibleSection>

      {/* Tracks */}
      {band.tracks.length > 0 && (
        <CollapsibleSection title="Tracks">
          <TrackList tracks={band.tracks} />
        </CollapsibleSection>
      )}

      {/* Upcoming gigs */}
      {band.gigs.length > 0 && (
        <CollapsibleSection title="Upcoming gigs">
          <TimelineList
            items={band.gigs.map((g) => ({
              label: g.day,
              sublabel: g.date,
              content: (
                <View>
                  <Text style={styles.gigVenue}>{g.venue}</Text>
                  <Text style={styles.gigDoors}>Doors {g.doors}</Text>
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
  hero: {
    height: 200,
    justifyContent: "flex-end",
    padding: 20,
    marginBottom: 24,
  },
  heroName: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "800",
  },
  backBtn: {
    position: "absolute",
    top: 52,
    left: 16,
    borderRadius: 32,
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
  gigVenue: { color: "#fff", fontSize: 14, fontWeight: "600" },
  gigDoors: { color: "#c8c8d0", fontSize: 13, marginTop: 2 },
});
