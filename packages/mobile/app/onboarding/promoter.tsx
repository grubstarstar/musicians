import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// MUS-91: second step of the onboarding wizard for users who picked
// "As a promoter" on the role picker. Mirrors the musician step-2 (MUS-90)
// minus the session option: the three branches are
//   - "Create a promoter group" → name-first create-entity sub-flow
//   - "Join existing promoter group" → group picker (sibling ticket; this
//     ticket routes to a stub screen at /onboarding/promoter-join)
//   - "I'm a solo promoter" → solo variant of the create-entity sub-flow
//
// By the time the user lands here, the role-picker has already appended
// `promoter` to `users.roles` via the `onboarding.setRole` mutation and
// synced AuthContext (see role-picker.tsx). So this screen only routes; it
// does not need to mutate server state.
//
// Selection-survives-back is achieved by:
//   - Using `router.push` (not `router.replace`) when navigating forward,
//     so this screen instance stays mounted in the back stack.
//   - Going back from the destination via `router.back()` returns to the
//     same instance with `useState` intact. The role-picker's onSuccess
//     uses `router.replace`, so a back gesture from this screen exits the
//     wizard segment entirely (matches the wizard "no going back to the
//     role choice once you've committed" behaviour established in MUS-89).

type PromoterOption = "create-group" | "join-group" | "solo";

interface OptionConfig {
  id: PromoterOption;
  title: string;
  subtitle: string;
  testID: string;
}

const OPTIONS: OptionConfig[] = [
  {
    id: "create-group",
    title: "Create a promoter group",
    subtitle: "Set up a new promoter group you'll run with others.",
    testID: "onboarding-promoter-step2-create-group",
  },
  {
    id: "join-group",
    title: "Join existing promoter group",
    subtitle: "Find a group already on Musicians and ask to join.",
    testID: "onboarding-promoter-step2-join-group",
  },
  {
    id: "solo",
    title: "I'm a solo promoter",
    subtitle: "Promote shows on your own — no group needed.",
    testID: "onboarding-promoter-step2-solo",
  },
];

export default function PromoterOnboardingStep2() {
  const router = useRouter();
  const [selected, setSelected] = useState<PromoterOption | null>(null);

  const canSubmit = selected !== null;

  function handleNext() {
    if (selected === null) return;
    switch (selected) {
      case "create-group":
        router.push(
          "/create-entity?entityType=promoterGroup&memberMode=promoterGroup",
        );
        return;
      case "solo":
        router.push("/create-entity?entityType=promoterGroup&memberMode=solo");
        return;
      case "join-group":
        // Sibling ticket owns the actual picker / request form. We push to
        // a placeholder screen in this same onboarding segment so the user
        // sees a real next step (and can back out) instead of a no-op tap
        // or a brittle Alert that's hard to drive from Maestro.
        router.push("/onboarding/promoter-join");
        return;
    }
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={["left", "right", "top", "bottom"]}
      testID="onboarding-promoter-step2"
    >
      <View style={styles.inner}>
        <Text style={styles.title}>How do you promote?</Text>
        <Text style={styles.subtitle}>
          Pick the option that best matches how you put on shows. You can add
          more later from settings.
        </Text>

        <View
          style={styles.options}
          accessibilityRole="radiogroup"
          accessibilityLabel="Choose how you promote"
        >
          {OPTIONS.map((option) => {
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
                accessibilityLabel={option.title}
              >
                <View
                  style={[styles.radio, isSelected && styles.radioSelected]}
                >
                  {isSelected && <View style={styles.radioDot} />}
                </View>
                <View style={styles.optionTextBlock}>
                  <Text
                    style={[
                      styles.optionTitle,
                      isSelected && styles.optionTitleSelected,
                    ]}
                  >
                    {option.title}
                  </Text>
                  <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          testID="onboarding-promoter-step2-next"
          onPress={handleNext}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.nextButton,
            !canSubmit && styles.nextButtonDisabled,
            pressed && canSubmit && styles.nextButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Next"
          accessibilityState={{ disabled: !canSubmit }}
        >
          <Text style={styles.nextButtonText}>Next</Text>
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
    alignItems: "flex-start",
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
  optionTextBlock: { flex: 1 },
  optionTitle: { color: "#fff", fontSize: 17, fontWeight: "500" },
  optionTitleSelected: { color: "#fff", fontWeight: "600" },
  optionSubtitle: {
    color: "#7a7a85",
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#4a4a52",
    alignItems: "center",
    justifyContent: "center",
    // Slight downward nudge so the radio aligns with the title baseline
    // when the option grows for the two-line subtitle layout.
    marginTop: 1,
  },
  radioSelected: { borderColor: "#6c63ff" },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#6c63ff",
  },
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
