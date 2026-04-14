import { Tabs } from "expo-router";
import { Text } from "react-native";

type TabIconProps = { focused: boolean };

function makeIcon(emoji: string) {
  return function TabIcon({ focused }: TabIconProps) {
    return (
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
    );
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#6c63ff",
        tabBarInactiveTintColor: "#8a8a92",
        tabBarStyle: {
          backgroundColor: "#1a1a1f",
          borderTopColor: "#2a2a32",
        },
        headerStyle: { backgroundColor: "#1a1a1f" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: makeIcon("🏠") }}
      />
      <Tabs.Screen
        name="architecture"
        options={{ title: "Day 1 · Architecture", tabBarIcon: makeIcon("🧩") }}
      />
      <Tabs.Screen
        name="routing"
        options={{
          title: "Day 2 · Routing",
          tabBarIcon: makeIcon("🧭"),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="concurrent"
        options={{
          title: "Day 3 · React 18",
          tabBarIcon: makeIcon("⚡️"),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="daily"
        options={{
          title: "Day 6 · Daily",
          tabBarIcon: makeIcon("🛠️"),
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
