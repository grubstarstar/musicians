import { Redirect } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "../../src/auth/AuthContext";
import { AppDrawer } from "../../src/components/AppDrawer";
import { UserProvider } from "../../src/user/UserContext";

export default function AppLayout() {
  const { status, user } = useAuth();

  // While we're resolving a stored token, show a minimal splash so we don't
  // flash the login screen. The root layout also gates on this, but checking
  // here keeps this group self-contained.
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

  // MUS-89: an authenticated user with no roles yet is mid-onboarding —
  // bounce them into the role-picker instead of Home. This catches the
  // cold-launch case (token resolves to a user whose `users.roles` is still
  // empty because signup hasn't yet flowed through the wizard) that the
  // signup screen's `router.replace("/onboarding/role-picker")` only handles
  // on the freshly-registered in-memory path. MUS-94 will layer on the
  // richer resume-to-last-step logic; for now, picking-the-role is the only
  // step that durably mutates server state, so "no roles" == "must pick".
  // `users.roles` is free-text (MUS-86), so a length check is the right
  // guard — no enum validation here.
  if (user && user.roles.length === 0) {
    return <Redirect href="/onboarding/role-picker" />;
  }

  return (
    <UserProvider>
      <Drawer
        drawerContent={(props) => <AppDrawer {...props} />}
        screenOptions={{
          headerShown: false,
          drawerPosition: "right",
          drawerType: "front",
          drawerStyle: { backgroundColor: "#0f0f11", width: 280 },
        }}
      >
        <Drawer.Screen name="(tabs)" options={{ headerShown: false }} />
      </Drawer>
    </UserProvider>
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
