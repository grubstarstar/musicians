import "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";
import { Drawer } from "expo-router/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppDrawer } from "../src/components/AppDrawer";
import { queryClient } from "../src/trpc";
import { UserProvider } from "../src/user/UserContext";

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <UserProvider>
          <Drawer
            drawerContent={(props) => <AppDrawer {...props} />}
            screenOptions={{
              headerShown: false,
              drawerPosition: "right",
              drawerType: "front",
              drawerStyle: { backgroundColor: "#0f0f11", width: 280 },
            }}
          >
            <Drawer.Screen name="(tabs)" options={{ headerShown: false }} />
          </Drawer>
        </UserProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
