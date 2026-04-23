import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// MUS-89 placeholder for the musician step-2 screen. The real implementation
// lands in MUS-90. Keeping the route path stable (`/onboarding/musician`) so
// MUS-89's role-picker routing doesn't need to be retouched when the real
// screen arrives — MUS-90 replaces the body of this file in place.
export default function MusicianOnboardingStub() {
  return (
    <SafeAreaView
      style={styles.container}
      edges={["left", "right", "top", "bottom"]}
      testID="onboarding-musician-stub"
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Musician step 2 — coming soon</Text>
        <Text style={styles.subtitle}>
          This screen is a placeholder while MUS-90 is being built.
        </Text>
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
  },
});
