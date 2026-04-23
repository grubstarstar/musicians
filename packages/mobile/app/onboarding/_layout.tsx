import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "../../src/auth/AuthContext";

// MUS-89: onboarding wizard is a separate segment from `(app)` — it must be
// reachable after signup but before the user has an active context/role, so
// it sits outside the drawer-mounted `(app)` group. This layout enforces
// auth (bouncing anonymous visitors back to /login) and exposes the step
// screens as a plain Stack with no header (each step owns its own chrome).
export default function OnboardingLayout() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color="#6c63ff" />
      </View>
    );
  }
  if (status === "unauthenticated") {
    return <Redirect href="/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="role-picker" />
      <Stack.Screen name="musician" />
      <Stack.Screen name="promoter" />
      {/*
        MUS-91: placeholder destination for the "Join existing promoter
        group" option on promoter step-2. Sibling ticket replaces it with
        the real picker / request form.
      */}
      <Stack.Screen name="promoter-join" />
      {/*
        MUS-90: placeholder for the "Join existing band" sub-flow off the
        musician step-2 screen. The real picker / join-request form lands
        in a sibling ticket; the route path is registered here so step-2
        can push to it.
      */}
      <Stack.Screen name="join-band" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f0f11",
  },
});
