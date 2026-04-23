import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// MUS-89 placeholder for the promoter step-2 screen. The real implementation
// lands in MUS-91. Keeping the route path stable (`/onboarding/promoter`) so
// MUS-89's role-picker routing doesn't need to be retouched when the real
// screen arrives — MUS-91 replaces the body of this file in place.
export default function PromoterOnboardingStub() {
  return (
    <SafeAreaView
      style={styles.container}
      edges={["left", "right", "top", "bottom"]}
      testID="onboarding-promoter-stub"
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Promoter step 2 — coming soon</Text>
        <Text style={styles.subtitle}>
          This screen is a placeholder while MUS-91 is being built.
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
