import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
      <PostRequestCta />

      <QueryBoundary>
        <BandsRow />
      </QueryBoundary>

      <Text style={styles.sectionTitle}>Your instruments</Text>
      <ChipRow chips={INSTRUMENTS} />
    </ScrollView>
  );
}

function PostRequestCta() {
  const router = useRouter();
  return (
    <View style={styles.ctaWrap}>
      <Pressable
        onPress={() => router.navigate("/post-request")}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        accessibilityRole="button"
        accessibilityLabel="Post a request to find a musician for one of your bands"
      >
        <View style={styles.ctaIcon}>
          <Ionicons name="megaphone-outline" size={20} color="#fff" />
        </View>
        <View style={styles.ctaBody}>
          <Text style={styles.ctaTitle}>Post request</Text>
          <Text style={styles.ctaSubtitle}>
            Find a musician for one of your bands
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#fff" />
      </Pressable>
    </View>
  );
}

function BandsRow() {
  const router = useRouter();
  const { data: bands } = useSuspenseQuery(trpc.bands.listMine.queryOptions());

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
  ctaWrap: { paddingHorizontal: 20, marginBottom: 24 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#6c63ff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  ctaPressed: { opacity: 0.85 },
  ctaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  ctaBody: { flex: 1 },
  ctaTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  ctaSubtitle: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 },
});
