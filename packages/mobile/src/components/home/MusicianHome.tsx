import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { EntityCard } from "./Card";
import { CardRow } from "./CardRow";
import { ChipRow } from "./ChipRow";
import { TimelineList } from "./TimelineList";
import { CollapsibleSection } from "../CollapsibleSection";
import { mockBands } from "../../data/mockBands";
import {
  Entypo,
  FontAwesome5,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";

const BANDS = [
  {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    name: "The Skylarks",
    color: "#6c63ff",
    image: "https://picsum.photos/seed/skylarks/320/160",
  },
  {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    name: "Night Owls",
    color: "#ff6b6b",
    image: "https://picsum.photos/seed/nightowls/320/160",
  },
  {
    id: "9c6d1e2a-3b4f-5a68-87c9-d0e1f2a3b4c5",
    name: "Velvet Rum",
    color: "#4caf50",
    image: "https://picsum.photos/seed/velvetrum/320/160",
  },
  {
    id: "d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a",
    name: "Solar Flare",
    color: "#ff9800",
    image: "https://picsum.photos/seed/solarflare/320/160",
  },
  {
    id: "e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b",
    name: "Pale Blue",
    color: "#03a9f4",
    image: "https://picsum.photos/seed/sunshine42/320/160",
  },
  {
    id: "f6a7b8c9-d0e1-2f3a-4b5c-6d7e8f9a0b1c",
    name: "Rust & Bone",
    color: "#8d6e63",
    image: "https://picsum.photos/seed/rustbone/320/160",
  },
  {
    id: "a7b8c9d0-e1f2-3a4b-5c6d-7e8f9a0b1c2d",
    name: "Lit. Allusions",
    color: "#c2185b",
    image: "https://picsum.photos/seed/90sindie/320/160",
  },
];

const INSTRUMENTS = [
  // {
  //   label: "Guitar",
  //   icon: <FontAwesome5 name="guitar" size={24} color="white" />,
  // },
  // {
  //   label: "Vocals",
  //   icon: <Entypo name="modern-mic" size={24} color="white" />,
  // },
  // {
  //   label: "Bass",
  //   icon: <FontAwesome5 name="guitar" size={24} color="white" />,
  // },
  {
    label: "Keyboard",
    icon: <MaterialIcons name="piano" size={24} color="white" />,
  },
  {
    label: "Trumpet",
    icon: <MaterialCommunityIcons name="trumpet" size={24} color="white" />,
  },
  {
    label: "Saxophone (Tenor)",
    icon: <MaterialCommunityIcons name="saxophone" size={24} color="white" />,
  },
];

const upcomingEvents = BANDS.flatMap((band) => {
  const profile = mockBands[band.id];
  if (!profile) return [];
  return profile.events.map((event) => ({
    ...event,
    bandName: band.name,
    bandColor: band.color,
  }));
});

export function MusicianHome() {
  const router = useRouter();
  return (
    <ScrollView>
      <CardRow title="Your bands">
        {BANDS.map((band) => (
          <EntityCard
            key={band.id}
            onPress={() => {
              router.navigate(`/band/${band.id}`);
            }}
          >
            <Image
              source={{ uri: band.image }}
              style={[styles.thumbnail, { backgroundColor: band.color }]}
            />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {band.name}
              </Text>
            </View>
          </EntityCard>
        ))}
      </CardRow>

      <Text style={styles.sectionTitle}>Your instruments</Text>
      <ChipRow chips={INSTRUMENTS} />

      {upcomingEvents.length > 0 && (
        <CollapsibleSection title="Upcoming events">
          <TimelineList
            items={upcomingEvents.map((e) => ({
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
                  <View style={styles.eventMeta}>
                    <View
                      style={[styles.bandDot, { backgroundColor: e.bandColor }]}
                    />
                    <Text style={styles.eventBand}>{e.bandName}</Text>
                    {e.doors && (
                      <Text style={styles.eventDoors}> · Doors {e.doors}</Text>
                    )}
                  </View>
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
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  thumbnail: { height: 80 },
  cardBody: { padding: 12 },
  cardTitle: { color: "#fff", fontSize: 14, fontWeight: "600" },
  eventHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  eventVenue: { color: "#fff", fontSize: 14, fontWeight: "600" },
  rehearsalBadge: {
    backgroundColor: "#2a2a30",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rehearsalBadgeText: { color: "#a0a0b0", fontSize: 11, fontWeight: "600" },
  eventMeta: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  bandDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  eventBand: { color: "#c8c8d0", fontSize: 13 },
  eventDoors: { color: "#7a7a85", fontSize: 13 },
});
