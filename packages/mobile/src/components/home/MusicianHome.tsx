import {
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
  const router = useRouter();
  const { data: bands, isLoading } = useQuery(trpc.bands.list.queryOptions());

  return (
    <ScrollView>
      <CardRow title="Your bands">
        {isLoading && <ActivityIndicator color="#6c63ff" style={styles.loader} />}
        {bands?.map((band) => (
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
  loader: { marginLeft: 20 },
});
