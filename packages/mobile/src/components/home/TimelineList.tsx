import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

interface TimelineItem {
  label: string;
  sublabel?: string;
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
              <Text style={styles.dateLabel}>{item.label}</Text>
              {item.sublabel && (
                <Text style={styles.dateSublabel}>{item.sublabel}</Text>
              )}
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
