import { useState } from "react";
import type { ReactNode } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  textStyleOverride?: StyleProp<TextStyle>;
  defaultOpen?: boolean;
}

export function CollapsibleSection({
  title,
  children,
  textStyleOverride,
  defaultOpen = true,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={styles.header}
        hitSlop={4}
      >
        <Text style={[styles.title, textStyleOverride]}>{title}</Text>
        <Ionicons
          name={open ? "chevron-down" : "chevron-forward"}
          size={18}
          color="#7a7a85"
        />
      </Pressable>
      {open && children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
