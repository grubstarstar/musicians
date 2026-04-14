import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useProtectedRoute } from "../lib/auth";

// One QueryClient per app. Defaults here are deliberately opinionated — the
// library's own defaults lean to web assumptions (refetchOnWindowFocus etc.)
// which don't map cleanly onto RN.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // data is "fresh" for 30s — no auto-refetch during that window
      gcTime: 5 * 60_000, // unused cache entries evicted after 5 minutes
      retry: 1, // one retry on failure, then surface the error
      refetchOnWindowFocus: false, // RN has no "window focus" event in the web sense
    },
  },
});

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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}
