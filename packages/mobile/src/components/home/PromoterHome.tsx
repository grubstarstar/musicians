import { ScrollView, StyleSheet, Text, View } from "react-native";
import { EntityCard } from "./Card";
import { CardRow } from "./CardRow";
import { TimelineList } from "./TimelineList";

const BOOKING_REQUESTS = [
  { band: "The Skylarks", status: "awaiting" as const, color: "#6c63ff" },
  { band: "Night Owls", status: "confirmed" as const, color: "#ff6b6b" },
];

const UPCOMING_SHOWS = [
  { day: "SAT", date: "May 2", band: "Night Owls", venue: "The Lexington" },
  { day: "FRI", date: "May 8", band: "The Skylarks", venue: "Fox & Firkin" },
];

export function PromoterHome() {
  return (
    <ScrollView>
      <CardRow title="Booking requests">
        {BOOKING_REQUESTS.map((req) => (
          <EntityCard key={req.band}>
            <View style={[styles.thumbnail, { backgroundColor: req.color }]} />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {req.band}
              </Text>
              <View
                style={[
                  styles.statusPill,
                  req.status === "confirmed"
                    ? styles.pillConfirmed
                    : styles.pillAwaiting,
                ]}
              >
                <Text style={styles.pillText}>
                  {req.status === "confirmed" ? "Confirmed" : "Awaiting"}
                </Text>
              </View>
            </View>
          </EntityCard>
        ))}
      </CardRow>

      <Text style={styles.sectionTitle}>Upcoming shows</Text>
      <TimelineList
        items={UPCOMING_SHOWS.map((show) => ({
          label: show.day,
          sublabel: show.date,
          content: (
            <View>
              <Text style={styles.cardTitle}>{show.band}</Text>
              <Text style={styles.secondary}>{show.venue}</Text>
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
  secondary: { color: "#c8c8d0", fontSize: 13, marginTop: 2 },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 8,
  },
  pillConfirmed: { backgroundColor: "rgba(76, 175, 80, 0.2)" },
  pillAwaiting: { backgroundColor: "rgba(255, 152, 0, 0.2)" },
  pillText: { color: "#fff", fontSize: 11, fontWeight: "600" },
});
