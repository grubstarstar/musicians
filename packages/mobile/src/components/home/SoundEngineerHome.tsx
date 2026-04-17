import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ChipRow } from "./ChipRow";
import { TimelineList } from "./TimelineList";

const SESSIONS = [
  { datetime: new Date(2026, 4, 1), band: "The Skylarks", venue: "Fox & Firkin" },
  { datetime: new Date(2026, 4, 2), band: "Night Owls", venue: "The Lexington" },
];

const GEAR_CHECKLIST = [
  { label: "Mixing desk patched", icon: "✓" },
  { label: "Monitors tested", icon: "✓" },
  { label: "Cable run checked", icon: "○" },
];

export function SoundEngineerHome() {
  return (
    <ScrollView>
      <Text style={styles.sectionTitle}>Upcoming sessions</Text>
      <TimelineList
        items={SESSIONS.map((s) => ({
          eventDatetime: s.datetime,
          content: (
            <View>
              <Text style={styles.primary}>{s.band}</Text>
              <Text style={styles.secondary}>{s.venue}</Text>
            </View>
          ),
        }))}
      />

      <Text style={styles.sectionTitle}>Gear checklist</Text>
      <ChipRow chips={GEAR_CHECKLIST} />
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
});
