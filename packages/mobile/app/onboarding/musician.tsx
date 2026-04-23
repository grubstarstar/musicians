import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// MUS-90: Step 2 of the onboarding wizard for users who picked "As a
// musician" in step 1 (the role-picker, MUS-89). Presents four mutually
// exclusive options that route into the relevant downstream sub-flow:
//
//   - Create a new band     → /create-entity?entityType=band&memberMode=band
//   - Join existing band    → /onboarding/join-band (placeholder until the
//                             band-picker / join-request ticket lands)
//   - I'm a solo artist     → /create-entity?entityType=band&memberMode=solo
//   - Session musician      → /onboarding/session-musician  (MUS-93)
//
// Selection is local state (single value, radio-style). The screen uses
// `router.push` (not `replace`) so the option tiles remain mounted when the
// user navigates forward — backing out of the downstream sub-flow returns
// here with the previously chosen option still highlighted, satisfying the
// AC requirement that "if the user backs out and returns, the previously
// selected option is still highlighted".
//
// The user's role (`musician`) was already appended to `users.roles` by the
// role-picker's `onboarding.setRole` mutation, so this screen does no server
// work — it's pure routing and selection state. No tRPC, no QueryBoundary.
//
// Visual conventions follow `role-picker.tsx` (radio dot, dark surface,
// purple accent, disabled-Next pattern) so the wizard feels consistent step
// to step.

type MusicianStep2Option =
  | "create-band"
  | "join-band"
  | "solo-artist"
  | "session-musician";

interface OptionConfig {
  id: MusicianStep2Option;
  title: string;
  subtitle: string;
  testID: string;
  // The destination route as a typed `Href`. Centralised here so the route
  // string only appears in one place per option — easier to audit if the
  // sub-flows ever change. Typed-routes are enabled in this project, so
  // arbitrary strings won't compile.
  href: Href;
}

const OPTIONS: OptionConfig[] = [
  {
    id: "create-band",
    title: "Create a new band",
    subtitle: "Start a band profile and invite members.",
    testID: "onboarding-musician-step2-create-band",
    // Deep-link into the shared name-first create flow with band membership.
    // The create-entity screen lives at /(app)/(tabs)/(stack)/create-entity;
    // Expo-Router strips the route-group segments so the path is simply
    // /create-entity. Querystring values are validated server-side via
    // `parseCreateEntityParams` (see MUS-92).
    href: "/create-entity?entityType=band&memberMode=band",
  },
  {
    id: "join-band",
    title: "Join an existing band",
    subtitle: "Browse bands and ask to join.",
    testID: "onboarding-musician-step2-join-band",
    // Sibling ticket placeholder. Routing here (rather than no-op-ing the
    // tile) keeps the four-option flow pressable end-to-end and means the
    // qa-automate flow can verify navigation for every option without us
    // having to add suppression logic. The placeholder screen lives at
    // /onboarding/join-band so it shares the wizard's no-drawer chrome.
    href: "/onboarding/join-band",
  },
  {
    id: "solo-artist",
    title: "I'm a solo artist",
    subtitle: "Set up a profile that represents just you.",
    testID: "onboarding-musician-step2-solo-artist",
    // memberMode=solo → create-entity creates a band row with exactly one
    // member and the resulting profile suppresses the "Add members" CTA
    // (MUS-92 already implements this branch).
    href: "/create-entity?entityType=band&memberMode=solo",
  },
  {
    id: "session-musician",
    title: "Session musician",
    subtitle: "Be discoverable for one-off and casual gigs.",
    testID: "onboarding-musician-step2-session-musician",
    // MUS-93's onboarding entry point. Defaults the
    // availableForSessionWork toggle ON (the user just picked "Session
    // musician" — opt-in is the whole point of this branch).
    href: "/onboarding/session-musician",
  },
];

export default function MusicianStep2Screen() {
  const router = useRouter();
  const [selected, setSelected] = useState<MusicianStep2Option | null>(null);

  const canSubmit = selected !== null;

  function handleNext() {
    if (selected === null) return;
    const option = OPTIONS.find((o) => o.id === selected);
    if (!option) return;
    // `push` (not `replace`): we want this screen to remain mounted under
    // the sub-flow so backing out preserves `selected` and the highlighted
    // tile. See the screen-level comment for the AC tie-in.
    router.push(option.href);
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={["left", "right", "top", "bottom"]}
      testID="onboarding-musician-step2"
    >
      <View style={styles.inner}>
        <Text style={styles.title}>How do you make music?</Text>
        <Text style={styles.subtitle}>
          Pick whichever fits best — you can always add another path later.
        </Text>

        <View
          style={styles.options}
          accessibilityRole="radiogroup"
          accessibilityLabel="How do you make music?"
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
          testID="onboarding-musician-step2-next"
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
    marginBottom: 24,
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
    paddingVertical: 16,
    gap: 14,
  },
  optionPressed: { opacity: 0.85 },
  optionSelected: {
    borderColor: "#6c63ff",
    backgroundColor: "#1f1b3a",
  },
  optionTextBlock: { flex: 1 },
  optionTitle: { color: "#fff", fontSize: 17, fontWeight: "500" },
  optionTitleSelected: { fontWeight: "600" },
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
    // Radio sits next to the title text — nudge it down so the dot aligns
    // visually with the title baseline (the option container uses
    // alignItems: flex-start to let the subtitle wrap naturally).
    marginTop: 2,
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
