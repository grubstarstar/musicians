import { Redirect } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "../../src/auth/AuthContext";
import { AppDrawer } from "../../src/components/AppDrawer";
import { UserProvider } from "../../src/user/UserContext";

export default function AppLayout() {
  const { status } = useAuth();

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
