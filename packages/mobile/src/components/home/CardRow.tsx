import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

interface CardRowProps {
  title: string;
  children: ReactNode;
}

export function CardRow({ title, children }: CardRowProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 28 },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingLeft: 20,
    paddingRight: 12,
  },
});
