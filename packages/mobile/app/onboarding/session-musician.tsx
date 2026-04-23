import { Ionicons } from "@expo/vector-icons";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/AuthContext";
import { QueryBoundary } from "../../src/components/QueryBoundary";
import { queryClient, trpc } from "../../src/trpc";
import {
  buildSessionMusicianProfileInput,
  type SessionMusicianValidationError,
} from "../../src/utils/sessionMusicianProfileInput";

// MUS-93: Session-musician landing screen.
//
// Two entry points share the same route:
//   - first-time onboarding: `/onboarding/session-musician`. The
//     availableForSessionWork toggle defaults ON; the user just picked
//     "Session musician" so opt-in is the whole point.
//   - drawer edit: `/onboarding/session-musician?mode=edit`. We preload the
//     existing profile (if any) via `musicianProfiles.get` under a
//     <QueryBoundary> and seed the form state from it, so users can tweak
//     and save without going through onboarding again.
//
// The screen lives outside the `(app)` drawer group so it can render full
// screen during onboarding (no drawer, no tabs). Auth is still required
// because the mutation is `protectedProcedure`; we mirror login's pattern of
// bouncing unauthenticated users back to `/login`.

// Profile shape returned by `musicianProfiles.get` — narrowed locally so the
// form component can take it as a plain prop without importing tRPC
// inference helpers.
interface ExistingProfile {
  instruments: string[];
  experienceYears: number | null;
  location: string | null;
  bio: string | null;
  availableForSessionWork: boolean;
}

export default function SessionMusicianOnboardingScreen() {
  const { status, user } = useAuth();
  const params = useLocalSearchParams<{ mode?: string }>();
  const isEdit = params.mode === "edit";

  // Gate on auth: the upsertMine mutation is protectedProcedure, and we
  // need a user id to key the profile fetch in edit mode. During the
  // AuthProvider's initial silent re-auth we show a splash so we don't
  // flash the login screen mid-boot (mirrors `(app)/_layout.tsx`).
  if (status === "loading") {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right", "top"]}>
        <View style={styles.splash}>
          <ActivityIndicator color="#6c63ff" />
        </View>
      </SafeAreaView>
    );
  }
  if (status === "unauthenticated" || !user) {
    return <Redirect href="/login" />;
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={["left", "right", "top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {isEdit ? (
          <QueryBoundary>
            <SessionMusicianEditLoader />
          </QueryBoundary>
        ) : (
          // First entry: no existing row to read, so skip the query entirely
          // and render the form with blank defaults.
          <SessionMusicianProfileForm mode="new" existing={null} />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Edit-mode sub-component: pulls the caller's user id + existing profile
 * under a <QueryBoundary> (hooks called unconditionally at the top of the
 * component so we don't violate rules of hooks), then hands the row down
 * to the shared form as a plain prop.
 */
function SessionMusicianEditLoader() {
  const { data: me } = useSuspenseQuery(trpc.system.whoami.queryOptions());
  const userId = Number(me.id);
  const { data: existing } = useSuspenseQuery(
    trpc.musicianProfiles.get.queryOptions({ userId }),
  );
  return <SessionMusicianProfileForm mode="edit" existing={existing} />;
}

interface FormProps {
  mode: "new" | "edit";
  existing: ExistingProfile | null;
}

function SessionMusicianProfileForm({ mode, existing }: FormProps) {
  const router = useRouter();
  // We need the numeric userId to key the post-save invalidation. Cheap —
  // `system.whoami` is already fetched (in edit mode via the loader above,
  // and in new mode by this call).
  const { data: me } = useSuspenseQuery(trpc.system.whoami.queryOptions());
  const userId = Number(me.id);

  const [instruments, setInstruments] = useState<string[]>(
    existing?.instruments ?? [],
  );
  const [instrumentDraft, setInstrumentDraft] = useState("");
  const [experienceYears, setExperienceYears] = useState(
    existing?.experienceYears != null ? String(existing.experienceYears) : "",
  );
  const [location, setLocation] = useState(existing?.location ?? "");
  const [bio, setBio] = useState(existing?.bio ?? "");
  // First entry after the "Session musician" pick: opt-in by default. The
  // toggle is still rendered so the user can turn it off if they want.
  // In edit mode, honour the persisted value.
  const [availableForSessionWork, setAvailableForSessionWork] = useState(
    existing ? existing.availableForSessionWork : true,
  );

  const [error, setError] = useState<string | null>(null);

  const upsert = useMutation(
    trpc.musicianProfiles.upsertMine.mutationOptions({
      onSuccess: () => {
        // The profile query is keyed on `{ userId }` — invalidate so the
        // drawer edit view reflects the latest values next time it opens.
        queryClient.invalidateQueries({
          queryKey: trpc.musicianProfiles.get.queryOptions({ userId }).queryKey,
        });
        // End-state for both new + edit: drop into the app home. `replace`
        // so the form isn't left in the back stack with stale local state.
        router.replace("/");
      },
      onError: (err) => {
        setError(err.message);
      },
    }),
  );

  const submitting = upsert.isPending;

  const trimmedDraft = instrumentDraft.trim();
  const canAddInstrument =
    trimmedDraft.length > 0 && !instruments.includes(trimmedDraft);

  function addInstrument() {
    if (!canAddInstrument) return;
    setInstruments((prev) => [...prev, trimmedDraft]);
    setInstrumentDraft("");
    setError(null);
  }

  function removeInstrument(value: string) {
    setInstruments((prev) => prev.filter((i) => i !== value));
  }

  function handleSubmit() {
    if (submitting) return;
    setError(null);
    const result = buildSessionMusicianProfileInput({
      instruments,
      experienceYears,
      location,
      bio,
      availableForSessionWork,
    });
    if (!result.ok) {
      setError(errorMessage(result.error));
      return;
    }
    upsert.mutate(result.input);
  }

  const canSubmit = !submitting && instruments.length > 0;
  const screenTitle = mode === "edit" ? "Edit profile" : "Your musician profile";
  const submitLabel = mode === "edit" ? "Save changes" : "Save and continue";

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        {router.canGoBack() && (
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </Pressable>
        )}
        <Text style={styles.title}>{screenTitle}</Text>
      </View>

      {mode === "new" && (
        <Text style={styles.intro}>
          Tell bands and promoters a bit about you so they can find you for
          session work.
        </Text>
      )}

      <Text style={styles.label}>Instruments</Text>
      <View style={styles.addRow}>
        <TextInput
          testID="session-musician-instrument-input"
          style={[styles.input, styles.addInput]}
          value={instrumentDraft}
          onChangeText={setInstrumentDraft}
          autoCapitalize="words"
          autoCorrect={false}
          placeholder="e.g. Bass"
          placeholderTextColor="#555"
          editable={!submitting}
          returnKeyType="done"
          onSubmitEditing={addInstrument}
        />
        <Pressable
          testID="session-musician-instrument-add"
          onPress={addInstrument}
          disabled={!canAddInstrument || submitting}
          style={({ pressed }) => [
            styles.addBtn,
            (!canAddInstrument || submitting) && styles.buttonDisabled,
            pressed &&
              canAddInstrument &&
              !submitting &&
              styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Add instrument"
          accessibilityState={{
            disabled: !canAddInstrument || submitting,
          }}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      </View>
      {instruments.length === 0 ? (
        <Text style={styles.helperText}>
          Add at least one instrument you play.
        </Text>
      ) : (
        <View style={styles.chipWrap}>
          {instruments.map((inst) => (
            <Pressable
              key={inst}
              onPress={() => removeInstrument(inst)}
              style={({ pressed }) => [
                styles.chip,
                pressed && styles.chipPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${inst}`}
              disabled={submitting}
            >
              <Text style={styles.chipText}>{inst}</Text>
              <Ionicons name="close" size={14} color="#c8c8d0" />
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.label}>Years of experience (optional)</Text>
      <TextInput
        testID="session-musician-experience-years"
        style={styles.input}
        value={experienceYears}
        onChangeText={setExperienceYears}
        keyboardType="number-pad"
        placeholder="e.g. 5"
        placeholderTextColor="#555"
        editable={!submitting}
        returnKeyType="next"
      />

      <Text style={styles.label}>Location (optional)</Text>
      <TextInput
        testID="session-musician-location"
        style={styles.input}
        value={location}
        onChangeText={setLocation}
        autoCapitalize="words"
        autoCorrect={false}
        placeholder="e.g. Melbourne"
        placeholderTextColor="#555"
        editable={!submitting}
        returnKeyType="next"
      />

      <Text style={styles.label}>Bio (optional)</Text>
      <TextInput
        testID="session-musician-bio"
        style={[styles.input, styles.multiline]}
        value={bio}
        onChangeText={setBio}
        multiline
        numberOfLines={4}
        autoCapitalize="sentences"
        autoCorrect
        placeholder="e.g. 10 years gigging in jazz combos; can read charts."
        placeholderTextColor="#555"
        editable={!submitting}
      />

      <View style={styles.toggleRow}>
        <View style={styles.toggleLabelBlock}>
          <Text style={styles.toggleLabel}>Available for session work</Text>
          <Text style={styles.toggleHelp}>
            Turn off to stay in the directory without appearing in active
            session-work searches.
          </Text>
        </View>
        <Switch
          testID="session-musician-available-toggle"
          value={availableForSessionWork}
          onValueChange={setAvailableForSessionWork}
          disabled={submitting}
          trackColor={{ true: "#6c63ff", false: "#2a2a30" }}
          thumbColor="#fff"
          ios_backgroundColor="#2a2a30"
          accessibilityLabel="Available for session work"
        />
      </View>

      {error && (
        <Text
          testID="session-musician-error"
          style={styles.error}
          accessibilityRole="alert"
        >
          {error}
        </Text>
      )}

      <Pressable
        testID="session-musician-submit"
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={({ pressed }) => [
          styles.button,
          !canSubmit && styles.buttonDisabled,
          pressed && canSubmit && styles.buttonPressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit, busy: submitting }}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{submitLabel}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

// Map the typed validation error to copy the user sees. Kept inline (not in
// `utils/`) because it's trivial and single-purpose — extraction would be
// ceremony, not clarity.
function errorMessage(err: SessionMusicianValidationError): string {
  switch (err) {
    case "no-instruments":
      return "Add at least one instrument to continue.";
    case "experience-years-invalid":
      return "Years of experience must be a whole number (e.g. 5).";
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f11" },
  flex: { flex: 1 },
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
    marginBottom: 8,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
  },
  intro: {
    color: "#7a7a85",
    fontSize: 14,
    marginTop: 4,
    marginBottom: 8,
  },
  label: {
    color: "#7a7a85",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#1a1a1f",
    borderWidth: 1,
    borderColor: "#2a2a30",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 16,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  addRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addInput: { flex: 1 },
  addBtn: {
    backgroundColor: "#6c63ff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#22222a",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  chipPressed: { opacity: 0.7 },
  chipText: { color: "#fff", fontSize: 13 },
  helperText: { color: "#7a7a85", fontSize: 13, marginTop: 6 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 24,
    paddingVertical: 8,
  },
  toggleLabelBlock: { flex: 1 },
  toggleLabel: { color: "#fff", fontSize: 16, fontWeight: "600" },
  toggleHelp: { color: "#7a7a85", fontSize: 13, marginTop: 4 },
  error: {
    color: "#ff6b6b",
    fontSize: 14,
    marginTop: 16,
  },
  button: {
    backgroundColor: "#6c63ff",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
  },
  buttonPressed: { opacity: 0.8 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
