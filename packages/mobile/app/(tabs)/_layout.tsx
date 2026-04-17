import { DrawerActions } from "@react-navigation/native";
import { Tabs, useNavigation } from "expo-router";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

export default function TabsRoots() {
  const navigation = useNavigation();

  function openDrawer() {
    navigation.dispatch(DrawerActions.openDrawer());
  }

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
          tabBarIcon: () => (
            <Text
              style={{
                color: "#fff",
              }}
            >
              🎶
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="ai-chat"
        options={{
          tabBarLabel: "Query",
          tabBarIcon: () => (
            <Text
              style={{
                color: "#fff",
              }}
            >
              🤖
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="expo-ui-demo"
        options={{
          tabBarLabel: "Expo UI",
          tabBarIcon: () => (
            <Text
              style={{
                color: "#fff",
              }}
            >
              🎶
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="controls-demo"
        options={{
          tabBarLabel: "Controls",
          tabBarIcon: () => (
            <Text
              style={{
                color: "#fff",
              }}
            >
              🎺
            </Text>
          ),
        }}
      />
    </Tabs>
  );
}
