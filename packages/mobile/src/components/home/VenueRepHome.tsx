import { ScrollView, StyleSheet, Text, View } from "react-native";
import { TimelineList } from "./TimelineList";

const SCHEDULE = [
  { datetime: new Date(2026, 4, 1), band: "The Skylarks", doors: "7pm" },
  { datetime: new Date(2026, 4, 2), band: "Night Owls", doors: "8pm" },
  { datetime: new Date(2026, 4, 10), band: null, doors: null },
  { datetime: new Date(2026, 4, 12), band: null, doors: null },
  { datetime: new Date(2026, 4, 6), band: "Velvet Rum", doors: "7:30pm" },
];

export function VenueRepHome() {
  return (
    <ScrollView>
      <Text style={styles.sectionTitle}>Schedule</Text>
      <TimelineList
        items={SCHEDULE.map((s) => ({
          eventDatetime: s.datetime,
          content: s.band ? (
            <View>
              <Text style={styles.primary}>{s.band}</Text>
              <Text style={styles.secondary}>Doors {s.doors}</Text>
            </View>
          ) : (
            <View>
              <Text style={styles.muted}>Unbooked</Text>
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
  primary: { color: "#fff", fontSize: 14, fontWeight: "600" },
  secondary: { color: "#c8c8d0", fontSize: 13, marginTop: 2 },
  muted: { color: "#7a7a85", fontSize: 14, fontStyle: "italic" },
});
