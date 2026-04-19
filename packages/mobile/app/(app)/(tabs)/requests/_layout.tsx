import { Stack } from "expo-router";

/**
 * Own stack for the Opportunities tab so that pushing the request detail
 * screen from the list pops back to the list on Back (rather than falling
 * through to the Home stack — MUS-62). Matches the pattern used by the Home
 * tab's `(stack)` group.
 */
export default function RequestsStackRoot() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" options={{}} />
    </Stack>
  );
}
