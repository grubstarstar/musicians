import "react-native-gesture-handler";
import { Drawer } from "expo-router/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppDrawer } from "../src/components/AppDrawer";
import { UserProvider } from "../src/user/UserContext";

export default function RootLayout() {
  return (
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
  );
}
