import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { EntityCard } from "./Card";
import { CardRow } from "./CardRow";
import { ChipRow } from "./ChipRow";

const BANDS = [
  {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    name: "The Skylarks",
    color: "#6c63ff",
  },
  {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    name: "Night Owls",
    color: "#ff6b6b",
  },
  {
    id: "9c6d1e2a-3b4f-5a68-87c9-d0e1f2a3b4c5",
    name: "Velvet Rum",
    color: "#4caf50",
  },
];

const INSTRUMENTS = [
  { label: "Guitar", icon: "🎸" },
  { label: "Vocals", icon: "🎤" },
  { label: "Bass", icon: "🎸" },
  { label: "Keyboard", icon: "🎹" },
];

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
            <View style={[styles.thumbnail, { backgroundColor: band.color }]} />
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
});
