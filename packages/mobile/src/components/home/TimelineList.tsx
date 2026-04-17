import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

const SHORT_DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export interface TimelineItem {
  eventDatetime: Date;
  content: ReactNode;
}

interface TimelineListProps {
  items: TimelineItem[];
}

export function TimelineList({ items }: TimelineListProps) {
  return (
    <View style={styles.container}>
      <View style={styles.list}>
        {items.map((item, i) => (
          <View
            key={i}
            style={[styles.row, i < items.length - 1 && styles.rowBorder]}
          >
            <View style={styles.dateChip}>
              <Text style={styles.dateLabel}>
                {SHORT_DAYS[item.eventDatetime.getDay()]}
              </Text>
              <Text style={styles.dateSublabel}>
                {SHORT_MONTHS[item.eventDatetime.getMonth()]}{" "}
                {item.eventDatetime.getDate()}
              </Text>
            </View>
            <View style={styles.details}>{item.content}</View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 28, paddingHorizontal: 20 },
  list: {
    backgroundColor: "#1a1a1f",
    borderRadius: 12,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2a2a30",
  },
  dateChip: {
    width: 52,
    alignItems: "center",
    marginRight: 14,
  },
  dateLabel: {
    color: "#6c63ff",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  dateSublabel: {
    color: "#7a7a85",
    fontSize: 12,
    marginTop: 1,
  },
  details: { flex: 1 },
});
