import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useProtectedRoute } from "../lib/auth";

function RootNavigator() {
  useProtectedRoute();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="about"
        options={{
          headerShown: true,
          title: "About",
          headerStyle: { backgroundColor: "#1a1a1f" },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "600" },
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </AuthProvider>
  );
}
