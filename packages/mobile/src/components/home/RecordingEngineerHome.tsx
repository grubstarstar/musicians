import { ScrollView, StyleSheet, Text, View } from "react-native";
import { EntityCard } from "./Card";
import { CardRow } from "./CardRow";
import { TimelineList } from "./TimelineList";

const PROJECTS = [
  { band: "Night Owls", detail: "LP mix (3/10 tracks)", color: "#ff6b6b" },
  { band: "The Skylarks", detail: "Single tracking", color: "#6c63ff" },
];

const STUDIO_BOOKINGS = [
  { datetime: new Date(2026, 4, 6), room: "Room A" },
  { datetime: new Date(2026, 4, 7), room: "Room B" },
];

export function RecordingEngineerHome() {
  return (
    <ScrollView>
      <CardRow title="Active projects">
        {PROJECTS.map((p) => (
          <EntityCard key={p.band}>
            <View style={[styles.thumbnail, { backgroundColor: p.color }]} />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {p.band}
              </Text>
              <Text style={styles.secondary}>{p.detail}</Text>
            </View>
          </EntityCard>
        ))}
      </CardRow>

      <Text style={styles.sectionTitle}>Studio bookings</Text>
      <TimelineList
        items={STUDIO_BOOKINGS.map((b) => ({
          eventDatetime: b.datetime,
          content: (
            <View>
              <Text style={styles.cardTitle}>{b.room}</Text>
            </View>
          ),
        }))}
      />
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
  secondary: { color: "#c8c8d0", fontSize: 13, marginTop: 4 },
});
