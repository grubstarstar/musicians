import { Entypo, Ionicons } from "@expo/vector-icons";
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
        name="ai-chat"
        options={{
          tabBarLabel: "Query",
          tabBarIcon: () => <Entypo name="chat" size={22} color="white" />,
        }}
      />
    </Tabs>
  );
}
