import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// MUS-90 placeholder for the "Join an existing band" sub-flow off the
// musician step-2 screen. The real band picker / join-request form lands in
// a sibling ticket; this screen exists so the routing wiring out of step-2
// can be exercised end-to-end (qa-automate flow) without us having to
// special-case the tile. Replaced in place by the sibling ticket — keep the
// route path stable.
export default function JoinBandStub() {
  const router = useRouter();
  return (
    <SafeAreaView
      style={styles.container}
      edges={["left", "right", "top", "bottom"]}
      testID="onboarding-join-band-stub"
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Join a band — coming soon</Text>
        <Text style={styles.subtitle}>
          We&apos;re building the band-picker and join-request flow next.
          For now, head back and pick another path.
        </Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="onboarding-join-band-back"
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f11" },
  inner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 16,
  },
  title: {
    color: "#fff",
    fontSize: 22,
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
  backButton: {
    marginTop: 24,
    backgroundColor: "#6c63ff",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 8,
    alignItems: "center",
  },
  backButtonPressed: { opacity: 0.8 },
  backButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
