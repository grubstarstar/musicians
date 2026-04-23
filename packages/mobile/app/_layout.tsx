import "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "../src/auth/AuthContext";
import { queryClient } from "../src/trpc";

export default function RootLayout() {
  // Root only wires infrastructure providers and the top-level navigator.
  // The auth gate (redirect to /login vs mount the drawer) lives inside the
  // `(app)` group layout so this file stays dumb about auth state.
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(app)" />
            <Stack.Screen
              name="login"
              options={{
                gestureEnabled: false,
                animationTypeForReplace: "pop",
              }}
            />
            <Stack.Screen
              name="signup"
              options={{
                gestureEnabled: false,
                animationTypeForReplace: "pop",
              }}
            />
            {/*
              MUS-89: onboarding wizard (role picker + per-role step-2 screens).
              Lives outside `(app)` because it runs before the drawer-mounted
              shell is meaningful (no active role = nothing to render on
              Home). gestureEnabled false matches the login/signup auth gates
              — the user should move forward via explicit Next, not swipe-back.
            */}
            <Stack.Screen
              name="onboarding"
              options={{
                gestureEnabled: false,
                animationTypeForReplace: "pop",
              }}
            />
          </Stack>
        </AuthProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
