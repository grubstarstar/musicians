import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ChipRow } from "./ChipRow";
import { TimelineList } from "./TimelineList";

const SESSIONS = [
  { day: "FRI", time: "8pm", band: "The Skylarks", venue: "Fox & Firkin" },
  { day: "SAT", time: "9pm", band: "Night Owls", venue: "The Lexington" },
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
          label: s.day,
          sublabel: s.time,
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
