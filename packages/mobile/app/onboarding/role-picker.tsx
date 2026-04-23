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
import { useAuth } from "../../src/auth/AuthContext";
import { trpc } from "../../src/trpc";

// MUS-89: first step of the onboarding wizard. The user picks one of the
// available roles; submitting appends it to `users.roles` via
// `onboarding.setRole` and routes to the matching step-2 screen. Only
// `musician` / `promoter` are offered at launch per the ticket.
//
// Kept deliberately simple:
//   - selection state is local (plain useState). The AC requires it to
//     persist across back/next navigation *within the wizard*; this screen
//     is the wizard root so "back" from step-2 returns here and re-picks
//     via router.back(), which preserves the component and therefore the
//     state without any extra plumbing.
//   - Next is disabled until a role is selected (matches AC and avoids a
//     confusing tap that silently does nothing).
//   - setRole is idempotent server-side, so a stutter-tap is safe.
type OnboardingRole = "musician" | "promoter";

interface RoleOption {
  id: OnboardingRole;
  copy: string;
  testID: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  { id: "musician", copy: "As a musician", testID: "onboarding-role-musician" },
  { id: "promoter", copy: "As a promoter", testID: "onboarding-role-promoter" },
];

export default function RolePickerScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [selected, setSelected] = useState<OnboardingRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setRole = useMutation(
    trpc.onboarding.setRole.mutationOptions({
      onSuccess: async (_data, variables) => {
        // MUS-92: sync AuthContext with the server's now-populated `roles`
        // before navigating. Otherwise any subsequent navigation into the
        // (app) group (e.g. the create-entity deep link from the musician
        // step-2 placeholder) sees stale `user.roles = []` and the layout
        // guard at (app)/_layout.tsx bounces the user straight back here.
        // Awaited so the navigation below sees the fresh state.
        await refreshUser();
        // Route to the matching step-2 screen. `replace` so "back" doesn't
        // land on the picker after the role is already recorded — the wizard
        // advances; if the user needs to change their mind, the add-role
        // follow-up ticket handles that from settings.
        router.replace(`/onboarding/${variables.role}`);
      },
      onError: (err) => {
        setError(err.message);
      },
    }),
  );

  const canSubmit = selected !== null && !setRole.isPending;

  function handleNext() {
    if (!canSubmit || selected === null) return;
    setError(null);
    setRole.mutate({ role: selected });
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={["left", "right", "top", "bottom"]}
      testID="onboarding-role-picker"
    >
      <View style={styles.inner}>
        <Text style={styles.title}>What brings you here?</Text>
        <Text style={styles.subtitle}>
          Pick the role that best fits how you&apos;ll use Musicians. You can
          add more later from settings.
        </Text>

        <View
          style={styles.options}
          accessibilityRole="radiogroup"
          accessibilityLabel="Choose your role"
        >
          {ROLE_OPTIONS.map((option) => {
            const isSelected = selected === option.id;
            return (
              <Pressable
                key={option.id}
                testID={option.testID}
                onPress={() => setSelected(option.id)}
                style={({ pressed }) => [
                  styles.option,
                  isSelected && styles.optionSelected,
                  pressed && styles.optionPressed,
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={option.copy}
              >
                <View
                  style={[styles.radio, isSelected && styles.radioSelected]}
                >
                  {isSelected && <View style={styles.radioDot} />}
                </View>
                <Text
                  style={[
                    styles.optionText,
                    isSelected && styles.optionTextSelected,
                  ]}
                >
                  {option.copy}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error && (
          <Text
            style={styles.error}
            accessibilityRole="alert"
            testID="onboarding-role-error"
          >
            {error}
          </Text>
        )}

        <Pressable
          testID="onboarding-role-next"
          onPress={handleNext}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.nextButton,
            !canSubmit && styles.nextButtonDisabled,
            pressed && canSubmit && styles.nextButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Next"
          accessibilityState={{
            disabled: !canSubmit,
            busy: setRole.isPending,
          }}
        >
          {setRole.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.nextButtonText}>Next</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f11" },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: "space-between",
  },
  title: { color: "#fff", fontSize: 28, fontWeight: "700" },
  subtitle: {
    color: "#7a7a85",
    fontSize: 16,
    marginTop: 12,
    marginBottom: 32,
    lineHeight: 22,
  },
  options: { flex: 1, gap: 12 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1f",
    borderWidth: 1,
    borderColor: "#2a2a30",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 14,
  },
  optionPressed: { opacity: 0.85 },
  optionSelected: {
    borderColor: "#6c63ff",
    backgroundColor: "#1f1b3a",
  },
  optionText: { color: "#fff", fontSize: 18, fontWeight: "500" },
  optionTextSelected: { color: "#fff", fontWeight: "600" },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#4a4a52",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: "#6c63ff" },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#6c63ff",
  },
  error: { color: "#ff6b6b", fontSize: 14, marginTop: 12 },
  nextButton: {
    backgroundColor: "#6c63ff",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  nextButtonPressed: { opacity: 0.8 },
  nextButtonDisabled: { opacity: 0.4 },
  nextButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
