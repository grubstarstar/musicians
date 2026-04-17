import { StyleSheet, Text, View } from "react-native";

interface Chip {
  label: string;
  color?: string;
  icon?: string;
}

interface ChipRowProps {
  chips: Chip[];
}

export function ChipRow({ chips }: ChipRowProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {chips.map((chip) => (
          <View key={chip.label} style={styles.chip}>
            {chip.icon && <Text style={styles.icon}>{chip.icon}</Text>}
            {chip.color && (
              <View style={[styles.dot, { backgroundColor: chip.color }]} />
            )}
            <Text style={styles.chipLabel}>{chip.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 28, paddingHorizontal: 20 },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1f",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  icon: { fontSize: 16 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  chipLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
});
