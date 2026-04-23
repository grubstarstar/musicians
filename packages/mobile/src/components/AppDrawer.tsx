import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import {
  CONTEXT_LABELS,
  useUser,
  type UserContextType,
} from "../user/UserContext";

export function AppDrawer(props: DrawerContentComponentProps) {
  const { user, currentContext, setCurrentContext } = useUser();
  const { logout } = useAuth();
  const router = useRouter();
  const displayName = user.firstName ?? user.username;
  const showSwitcher = user.availableContexts.length > 1;

  function handleSelect(next: UserContextType) {
    setCurrentContext(next);
    props.navigation.closeDrawer();
  }

  function handleEditProfile() {
    // MUS-93: reuse the onboarding screen for later edits. `?mode=edit`
    // switches the screen into "load existing row, save changes" copy and
    // preloads the profile fields under a <QueryBoundary>.
    props.navigation.closeDrawer();
    router.navigate("/onboarding/session-musician?mode=edit");
  }

  async function handleLogout() {
    // Close the drawer first so the user sees it dismiss while logout runs.
    // AuthContext flips status -> unauthenticated, the (app) layout re-renders
    // and redirects to /login; no explicit navigation needed here.
    props.navigation.closeDrawer();
    await logout();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.username}>@{user.username}</Text>
      </View>

      {showSwitcher && (
        <View>
          <Text style={styles.sectionLabel}>Using app as</Text>
          {user.availableContexts.map((c) => {
            const selected = c === currentContext;
            return (
              <TouchableOpacity
                key={c}
                style={styles.row}
                onPress={() => handleSelect(c)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.rowLabel}>{CONTEXT_LABELS[c]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.spacer} />

      <TouchableOpacity
        testID="drawer-edit-profile"
        style={styles.editProfile}
        onPress={handleEditProfile}
        accessibilityRole="button"
      >
        <Text style={styles.editProfileLabel}>Edit profile</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.logout}
        onPress={handleLogout}
        accessibilityRole="button"
      >
        <Text style={styles.logoutLabel}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f11",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  header: { marginBottom: 32 },
  name: { color: "#fff", fontSize: 22, fontWeight: "700" },
  username: { color: "#7a7a85", fontSize: 14, marginTop: 2 },
  sectionLabel: {
    color: "#7a7a85",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#7a7a85",
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: "#6c63ff" },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6c63ff",
  },
  rowLabel: { color: "#fff", fontSize: 16 },
  spacer: { flex: 1 },
  editProfile: {
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#2a2a30",
  },
  editProfileLabel: { color: "#fff", fontSize: 16, fontWeight: "600" },
  logout: {
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#2a2a30",
  },
  logoutLabel: { color: "#ff6b6b", fontSize: 16, fontWeight: "600" },
});
