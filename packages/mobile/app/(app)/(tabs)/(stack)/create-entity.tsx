import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { queryClient, trpc } from "../../../../src/trpc";
import {
  parseCreateEntityParams,
  type CreateEntityParams,
} from "../../../../src/utils/parseCreateEntityParams";
import { resolvePostCreateRoute } from "../../../../src/utils/resolvePostCreateRoute";

/**
 * MUS-92: Name-first create flow shared by the onboarding wizard's four
 * branches:
 *
 *   - "Create a new band"     → entityType=band, memberMode=band
 *   - "I'm a solo artist"     → entityType=band, memberMode=solo
 *   - "Create a promoter group" → entityType=promoterGroup, memberMode=promoterGroup
 *   - "I'm a solo promoter"   → entityType=promoterGroup, memberMode=solo
 *
 * The screen renders a single text input + Submit. On submit it calls the
 * matching tRPC mutation (`bands.create` or `promoterGroups.create`),
 * invalidates the caller-scoped list query so the home screen reflects the
 * new entity on next visit, and replaces the route with the entity profile
 * — appending `?new=1` for the multi-member modes (`band` /
 * `promoterGroup`) so the profile surfaces the "Add members" CTA. Solo
 * modes land on the profile without the flag.
 *
 * Replace, not push: the create form is a one-shot step in the onboarding
 * wizard. Using `router.replace` removes it from the back stack so the
 * iOS back gesture from the profile takes the user back to the onboarding
 * step that launched the form, not back to the (now stale) name input.
 */
export default function CreateEntityScreen() {
  const rawParams = useLocalSearchParams<{
    entityType?: string;
    memberMode?: string;
  }>();
  // Memoise the parsed params via initial-render `useState` so a later
  // re-read of the same params doesn't re-trigger validation / overwrite
  // user state. `parseCreateEntityParams` is a pure helper kept in
  // `src/utils/` so it's unit-testable.
  const [params] = useState<CreateEntityParams | null>(() =>
    parseCreateEntityParams(rawParams),
  );

  if (!params) {
    return <InvalidParams />;
  }
  return <CreateEntityForm params={params} />;
}

function CreateEntityForm({ params }: { params: CreateEntityParams }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createBand = useMutation(
    trpc.bands.create.mutationOptions({
      onSuccess: async (data) => {
        // Refresh the caller's "my bands" so the home / drawer list shows
        // the new band when the user returns. The detail query for this
        // specific band is filled fresh by the profile screen on land.
        queryClient.invalidateQueries({
          queryKey: trpc.bands.listMine.queryOptions().queryKey,
        });
        // MUS-94: the band_members row written by `bands.create` is one of
        // the four "musician step-2 complete" routes the auth gate checks.
        // We `refetchQueries` (not bare `invalidateQueries`) and await it:
        // useSuspenseQuery on the (app) gate serves cached data synchronously
        // on the next mount, so if we navigate before the refetch lands the
        // gate re-runs with the stale 'musician' value and bounces straight
        // back into the wizard. Awaiting the refetch guarantees the cached
        // value is 'complete' by the time router.replace fires.
        await queryClient.refetchQueries({
          queryKey: trpc.onboarding.getResumeStep.queryOptions().queryKey,
        });
        const route = resolvePostCreateRoute({
          entityType: "band",
          id: data.id,
          memberMode: data.memberMode,
        });
        router.replace(route);
      },
      onError: (err) => setError(err.message),
    }),
  );

  const createPromoterGroup = useMutation(
    trpc.promoterGroups.create.mutationOptions({
      onSuccess: async (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.promoterGroups.listMine.queryOptions().queryKey,
        });
        // MUS-94: the promoters_promoter_groups row is one of the "promoter
        // step-2 complete" routes. Same awaited-refetch rationale as the
        // band branch above — see there for the full note.
        await queryClient.refetchQueries({
          queryKey: trpc.onboarding.getResumeStep.queryOptions().queryKey,
        });
        const route = resolvePostCreateRoute({
          entityType: "promoterGroup",
          id: data.id,
          memberMode: data.memberMode,
        });
        router.replace(route);
      },
      onError: (err) => setError(err.message),
    }),
  );

  const submitting = createBand.isPending || createPromoterGroup.isPending;
  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  function onSubmit() {
    if (!canSubmit) return;
    setError(null);
    if (params.entityType === "band") {
      // The server-side schema accepts only `'band' | 'solo'` for bands.
      // `parseCreateEntityParams` already restricted memberMode to that
      // pair when entityType is `band`, so the cast is safe.
      createBand.mutate({
        name: trimmed,
        memberMode: params.memberMode as "band" | "solo",
      });
    } else {
      createPromoterGroup.mutate({
        name: trimmed,
        memberMode: params.memberMode as "promoterGroup" | "solo",
      });
    }
  }

  // Heading text follows the four onboarding branches verbatim — the
  // ticket calls them out by name, and matching the trigger label keeps
  // the user oriented mid-flow.
  const heading = HEADINGS[params.entityType][params.memberMode];

  return (
    <SafeAreaView
      style={styles.container}
      edges={["left", "right", "top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID="create-entity-back"
          >
            <Ionicons name="chevron-back" size={32} color="#fff" />
          </Pressable>
          <Text style={styles.title} testID="create-entity-heading">
            {heading}
          </Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter a name"
            placeholderTextColor="#7a7a85"
            style={styles.input}
            autoFocus
            autoCorrect={false}
            testID="create-entity-name-input"
            returnKeyType="done"
            onSubmitEditing={onSubmit}
          />
          {error && (
            <Text style={styles.error} testID="create-entity-error">
              {error}
            </Text>
          )}
          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.submit,
              !canSubmit && styles.submitDisabled,
              pressed && canSubmit && styles.submitPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
            testID="create-entity-submit"
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitLabel}>Create</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InvalidParams() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Text style={styles.error}>
          Invalid create-entity parameters. Expected entityType=band|promoterGroup
          and memberMode matching the entity.
        </Text>
        <Pressable onPress={() => router.back()} style={styles.submit}>
          <Text style={styles.submitLabel}>Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// Per-branch heading text. The four onboarding entries map to the four
// branches the ticket enumerates. Centralised here so future copy changes
// land in one place.
const HEADINGS: Record<
  "band" | "promoterGroup",
  Record<"band" | "solo" | "promoterGroup", string>
> = {
  band: {
    band: "Create a new band",
    solo: "Create your solo artist profile",
    // Unused (entityType=band + memberMode=promoterGroup is filtered out
    // by `parseCreateEntityParams`), but TypeScript wants the key. Set to
    // the band heading as a defensive fallback.
    promoterGroup: "Create a new band",
  },
  promoterGroup: {
    promoterGroup: "Create a promoter group",
    solo: "Create your solo promoter profile",
    band: "Create a promoter group",
  },
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f11" },
  flex: { flex: 1 },
  header: {
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 20,
    backgroundColor: "#0f0f11",
  },
  backBtn: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 2,
  },
  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    marginTop: 40,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  label: {
    color: "#c8c8d0",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: "#1a1a1f",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#2a2a30",
  },
  error: {
    color: "#ff6b6b",
    fontSize: 13,
    marginTop: 12,
  },
  submit: {
    marginTop: 20,
    backgroundColor: "#6c63ff",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.4 },
  submitPressed: { opacity: 0.85 },
  submitLabel: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
