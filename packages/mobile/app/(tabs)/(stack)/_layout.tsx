import { DrawerActions } from "@react-navigation/native";
import { Stack, useNavigation } from "expo-router";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

export default function StackRoot() {
  const navigation = useNavigation();

  function openDrawer() {
    navigation.dispatch(DrawerActions.openDrawer());
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // tabBarStyle: {
        //   backgroundColor: "#0f0f11",
        // },
        // tabBarActiveTintColor: "#ffffff",
        // tabBarInactiveTintColor: "#rgba(255, 255, 255, 0.8)",
      }}
    >
      <Stack.Screen name="index" options={{}} />
    </Stack>
  );
}
