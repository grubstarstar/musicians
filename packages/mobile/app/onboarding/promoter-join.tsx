import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// MUS-91 placeholder for the "Join existing promoter group" branch. The real
// picker / request form lands in a sibling ticket. This screen exists so the
// promoter step-2 routing has a real destination — easier to navigate, easier
// to drive from Maestro than an inline Alert. When the sibling ticket lands,
// it can either replace this file in place or redirect from here, depending
// on whether the picker also wants the `(app)` shell.
export default function PromoterJoinPlaceholder() {
  const router = useRouter();
  return (
    <SafeAreaView
      style={styles.container}
      edges={["left", "right", "top", "bottom"]}
      testID="onboarding-promoter-join-placeholder"
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="onboarding-promoter-join-back"
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </Pressable>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Join a promoter group</Text>
        <Text style={styles.subtitle}>
          Coming soon. We&apos;re building the picker and request flow in a
          follow-up. For now, head back and pick another option.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f11" },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    color: "#7a7a85",
    fontSize: 15,
    marginTop: 12,
    textAlign: "center",
    lineHeight: 22,
  },
});
