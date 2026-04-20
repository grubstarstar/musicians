import { Stack } from "expo-router";

/**
 * My requests owns its own navigation stack so the new-request flow pushed
 * from here (my-requests/post-request) returns to this list on back, rather
 * than bouncing over to the Home stack that also hosts post-request.
 */
export default function MyRequestsStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="post-request" />
    </Stack>
  );
}
