import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MusicianHome } from "../../../src/components/home/MusicianHome";
import { PromoterHome } from "../../../src/components/home/PromoterHome";
import { RecordingEngineerHome } from "../../../src/components/home/RecordingEngineerHome";
import { SoundEngineerHome } from "../../../src/components/home/SoundEngineerHome";
import { VenueRepHome } from "../../../src/components/home/VenueRepHome";
import { useUser, type UserContextType } from "../../../src/user/UserContext";
import { Tabs, useNavigation } from "expo-router";
import { DrawerActions } from "@react-navigation/native";

const CONTEXT_VIEWS: Record<UserContextType, React.ComponentType> = {
  musician: MusicianHome,
  sound_engineer: SoundEngineerHome,
  recording_engineer: RecordingEngineerHome,
  promoter: PromoterHome,
  venue_rep: VenueRepHome,
};

export default function Home() {
  const { user, currentContext } = useUser();
  const navigation = useNavigation();

  function openDrawer() {
    navigation.dispatch(DrawerActions.openDrawer());
  }

  const displayName = user.firstName ?? user.username;
  const ContextView = CONTEXT_VIEWS[currentContext];

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "top"]}>
      {/* <Tabs.Screen
        options={{
          headerTitle: `Welcome ${displayName}`,
        }}
      /> */}
      <View style={styles.welcomeWrap}>
        <Text style={styles.welcome}>Welcome {displayName}</Text>
        <TouchableOpacity
          onPress={openDrawer}
          style={{ paddingHorizontal: 16 }}
          accessibilityRole="button"
          accessibilityLabel="Open profile menu"
        >
          <Text style={{ fontSize: 22 }}>👤</Text>
        </TouchableOpacity>
      </View>
      <ContextView />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f11" },
  welcomeWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  welcome: { color: "#fff", fontSize: 28, fontWeight: "700" },
});
