import { Stack } from "expo-router";

/**
 * Applied tab owns its own navigation stack so tapping into a row detail
 * (request/[id]) pushes inside this tab. Back-nav returns to the Applied list
 * rather than bouncing over to the Requests/Home tab stack that also hosts
 * request detail screens.
 */
export default function AppliedStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
