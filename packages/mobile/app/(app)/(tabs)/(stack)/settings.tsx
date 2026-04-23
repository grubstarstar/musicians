import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../../../src/auth/AuthContext";
import { computeAddableRoles } from "../../../../src/utils/computeAddableRoles";

// MUS-95: Settings screen reached from the drawer (AppDrawer "Settings" row).
// The first (and currently only) concern on this screen is the "Add role"
// action, which lets a user with a single role append the other one — e.g. a
// promoter who also wants to be a musician.
//
// The screen deliberately stays shallow rather than reaching for a richer
// settings framework: the ticket scope is just "settings exposes an Add role
// action". More settings rows will be added by follow-up tickets; for now the
// component is a thin list of actions with a back button.
//
// If the user already has every addable role, the "Add role" row becomes
// inactive and we render a short zero-state so the flow dead-ends cleanly
// rather than pushing into an empty picker. This matches the picker screen's
// own zero-state but is more user-friendly because the user never leaves
// settings only to bounce back.

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  // AuthContext guarantees `user` is non-null inside the (app) group (the
  // layout redirects unauthenticated visitors to /login before this screen
  // renders). Defensive fallback keeps TypeScript happy.
  const currentRoles = user?.roles ?? [];
  const addableRoles = computeAddableRoles(currentRoles);
  const canAddRole = addableRoles.length > 0;

  function handleAddRole() {
    if (!canAddRole) return;
    // `push` (not `replace`) so the back stack from the picker / step-2 /
    // post-step-2 screens can return to settings. The picker itself also
    // uses `push` when navigating forward to the step-2 sub-flow, so the
    // full chain stays navigable with a single back press at each step.
    router.push("/add-role");
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={["left", "right", "top", "bottom"]}
      testID="settings-screen"
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="settings-back"
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.body}>
        <Pressable
          testID="settings-add-role"
          onPress={handleAddRole}
          disabled={!canAddRole}
          accessibilityRole="button"
          accessibilityLabel="Add role"
          accessibilityState={{ disabled: !canAddRole }}
          style={({ pressed }) => [
            styles.row,
            !canAddRole && styles.rowDisabled,
            pressed && canAddRole && styles.rowPressed,
          ]}
        >
          <View style={styles.rowTextBlock}>
            <Text style={styles.rowLabel}>Add role</Text>
            <Text style={styles.rowHelp}>
              {canAddRole
                ? "Do more on Musicians by adding another way you use the app."
                : "You've already added every available role."}
            </Text>
          </View>
          {canAddRole && (
            <Ionicons name="chevron-forward" size={20} color="#7a7a85" />
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f11" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1f",
    borderWidth: 1,
    borderColor: "#2a2a30",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  rowDisabled: { opacity: 0.55 },
  rowPressed: { opacity: 0.85 },
  rowTextBlock: { flex: 1 },
  rowLabel: { color: "#fff", fontSize: 17, fontWeight: "600" },
  rowHelp: {
    color: "#7a7a85",
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
});
