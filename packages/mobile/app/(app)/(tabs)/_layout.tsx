import { Entypo, FontAwesome6, Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function TabsRoots() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0f0f11",
        },
        tabBarActiveTintColor: "#ffffff",
        tabBarInactiveTintColor: "#rgba(255, 255, 255, 0.8)",
      }}
    >
      <Tabs.Screen
        name="(stack)"
        options={{
          tabBarLabel: "Home",
          tabBarIcon: () => <Entypo name="home" size={22} color="white" />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          tabBarLabel: "Notices",
          tabBarIcon: () => (
            <Ionicons name="newspaper-outline" size={22} color="white" />
          ),
        }}
      />
      <Tabs.Screen
        name="my-requests"
        options={{
          tabBarLabel: "My requests",
          tabBarIcon: () => (
            <FontAwesome6 name="bullhorn" size={20} color="white" />
          ),
        }}
      />
      <Tabs.Screen
        name="applied"
        options={{
          tabBarLabel: "Applied",
          tabBarIcon: () => (
            <Ionicons name="paper-plane-outline" size={22} color="white" />
          ),
        }}
      />
      <Tabs.Screen
        name="ai-chat"
        options={{
          tabBarLabel: "Query",
          tabBarIcon: () => <Entypo name="chat" size={22} color="white" />,
        }}
      />
    </Tabs>
  );
}
