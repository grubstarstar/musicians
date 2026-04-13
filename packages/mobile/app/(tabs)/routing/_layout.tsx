import { Stack } from "expo-router";

export default function RoutingLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#1a1a1f" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "600" },
        contentStyle: { backgroundColor: "#0f0f11" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Day 2 · Routing" }} />
      <Stack.Screen name="[id]" options={{ title: "Concept detail" }} />
    </Stack>
  );
}
