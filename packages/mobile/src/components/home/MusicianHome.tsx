import {
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { QueryBoundary } from "../QueryBoundary";
import { trpc } from "../../trpc";
import { CardRow } from "./CardRow";
import { EntityCard } from "./Card";
import { ChipRow } from "./ChipRow";

const INSTRUMENTS = [
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

export function MusicianHome() {
  return (
    <ScrollView>
      <QueryBoundary>
        <BandsRow />
      </QueryBoundary>

      <Text style={styles.sectionTitle}>Your instruments</Text>
      <ChipRow chips={INSTRUMENTS} />
    </ScrollView>
  );
}

function BandsRow() {
  const router = useRouter();
  const { data: bands } = useSuspenseQuery(trpc.bands.list.queryOptions());

  return (
    <CardRow title="Your bands">
      {bands.map((band) => (
        <EntityCard
          key={band.id}
          onPress={() => {
            router.navigate(`/band/${band.id}`);
          }}
        >
          <Image
            source={{ uri: band.imageUrl ?? undefined }}
            style={[styles.thumbnail, { backgroundColor: "#1a1a1f" }]}
          />
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {band.name}
            </Text>
          </View>
        </EntityCard>
      ))}
    </CardRow>
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
