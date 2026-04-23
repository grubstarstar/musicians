import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../../../src/auth/AuthContext";
import { trpc } from "../../../../src/trpc";
import {
  computeAddableRoles,
  type AddableRole,
} from "../../../../src/utils/computeAddableRoles";

// MUS-95: "Add role" picker reached from the Settings screen. Lists the roles
// the caller doesn't yet have, calls the idempotent `users.addRole` mutation
// on pick, then routes to the corresponding step-2 sub-flow so the user can
// configure the thing that backs the new role (a band, a promoter group, a
// session profile).
//
// Reuses the onboarding step-2 screens (/onboarding/musician and
// /onboarding/promoter) rather than forking a "settings-mode" copy — the
// four-option (musician) / three-option (promoter) routing is identical
// whether the role was picked during first-run onboarding or added later. See
// the `feedback_no_duplicate_logic` note in user memory: push shared concerns
// into the component, don't repeat in callers. The step-2 screens do not
// themselves mutate the role (the role was already appended here) so there's
// no double-write risk.
//
// Navigation shape:
//   - Settings → (push) /add-role → (mutation success, push) /onboarding/<role>
//     → (push) <step-2's downstream>
// A single back press at each step walks back up the chain. We use `push`
// rather than `replace` so the user can abort at any point by going back and
// the only committed change is the roles append (which is what the AC
// explicitly requires).
//
// Cancelling: the mutation only fires when a tile is tapped. If the user
// backs out from this screen without tapping, no append happens — satisfies
// the AC "cancelling partway does not add the role".

const ROLE_COPY: Record<AddableRole, { title: string; subtitle: string }> = {
  musician: {
    title: "As a musician",
    subtitle: "Join bands, get session work, post to gigs.",
  },
  promoter: {
    title: "As a promoter",
    subtitle: "Run shows, book bands, work with venues.",
  },
};

export default function AddRoleScreen() {
  const router = useRouter();
  const { user, setRoles } = useAuth();
  const currentRoles = user?.roles ?? [];
  const addableRoles = computeAddableRoles(currentRoles);

  const [error, setError] = useState<string | null>(null);
  // Track which role the user tapped so we can show a spinner on just that
  // tile instead of a global overlay — matches the role-picker UX during
  // first-run onboarding, where the Next button goes busy but the tile list
  // stays interactive until the mutation resolves.
  const [pendingRole, setPendingRole] = useState<AddableRole | null>(null);

  const addRole = useMutation(
    trpc.users.addRole.mutationOptions({
      onSuccess: (data, variables) => {
        // Sync AuthContext synchronously from the mutation return value
        // BEFORE navigating. This matches the MUS-92 pattern (see
        // role-picker.tsx for the detailed rationale): any `(app)`-group
        // layout guard that reads `user.roles` — current or future, e.g.
        // MUS-94's step-2-completion gate — must see the appended role the
        // same tick we navigate, otherwise a re-evaluation mid-navigation
        // can bounce the user to the wrong screen.
        setRoles(data.roles);
        // Route to the matching step-2 screen. `push` so back-from-step-2
        // returns to the picker; back-from-picker returns to settings.
        router.push(`/onboarding/${variables.role}`);
      },
      onError: (err) => {
        setPendingRole(null);
        setError(err.message);
      },
    }),
  );

  function handlePick(role: AddableRole) {
    if (addRole.isPending) return;
    setError(null);
    setPendingRole(role);
    addRole.mutate({ role });
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={["left", "right", "top", "bottom"]}
      testID="add-role-picker"
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="add-role-back"
          style={styles.backBtn}
          disabled={addRole.isPending}
        >
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Add a role</Text>
      </View>

      <View style={styles.body}>
        {addableRoles.length === 0 ? (
          <View style={styles.zeroState} testID="add-role-zero-state">
            <Text style={styles.zeroStateTitle}>You&apos;re all set.</Text>
            <Text style={styles.zeroStateSubtitle}>
              You&apos;ve already added every available role. We&apos;ll let
              you know when we add more.
            </Text>
          </View>
        ) : (
          <View
            style={styles.options}
            accessibilityRole="radiogroup"
            accessibilityLabel="Choose a role to add"
          >
            {addableRoles.map((role) => {
              const copy = ROLE_COPY[role];
              const isPending = pendingRole === role && addRole.isPending;
              return (
                <Pressable
                  key={role}
                  testID={`add-role-option-${role}`}
                  onPress={() => handlePick(role)}
                  disabled={addRole.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={copy.title}
                  accessibilityState={{ busy: isPending }}
                  style={({ pressed }) => [
                    styles.option,
                    pressed && !addRole.isPending && styles.optionPressed,
                    addRole.isPending &&
                      !isPending &&
                      styles.optionInactive,
                  ]}
                >
                  <View style={styles.optionTextBlock}>
                    <Text style={styles.optionTitle}>{copy.title}</Text>
                    <Text style={styles.optionSubtitle}>{copy.subtitle}</Text>
                  </View>
                  {isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#7a7a85"
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {error && (
          <Text
            style={styles.error}
            accessibilityRole="alert"
            testID="add-role-error"
          >
            {error}
          </Text>
        )}
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
  options: { gap: 12 },
  option: {
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
  optionPressed: { opacity: 0.85 },
  optionInactive: { opacity: 0.5 },
  optionTextBlock: { flex: 1 },
  optionTitle: { color: "#fff", fontSize: 17, fontWeight: "600" },
  optionSubtitle: {
    color: "#7a7a85",
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  zeroState: {
    paddingVertical: 32,
    alignItems: "center",
  },
  zeroStateTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  zeroStateSubtitle: {
    color: "#7a7a85",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  error: { color: "#ff6b6b", fontSize: 14, marginTop: 16 },
});
