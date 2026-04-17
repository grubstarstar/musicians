import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

interface EntityCardProps {
  width?: number;
  onPress?: () => void;
  children: ReactNode;
}

export function EntityCard({
  width = 160,
  children,
  onPress,
}: EntityCardProps) {
  const main = <View style={[styles.card, { width }]}>{children}</View>;

  if (onPress) {
    return <Pressable onPress={onPress}>{main}</Pressable>;
  } else {
    return main;
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1a1a1f",
    borderRadius: 12,
    overflow: "hidden",
    marginRight: 12,
  },
});
