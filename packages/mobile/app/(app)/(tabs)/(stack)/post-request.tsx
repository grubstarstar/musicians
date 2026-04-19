import { Ionicons } from "@expo/vector-icons";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { QueryBoundary } from "../../../../src/components/QueryBoundary";
import { trpc } from "../../../../src/trpc";

/**
 * Filters `bands.list` down to bands where the caller is a member. Pure so it
 * can be reasoned about separately from the tRPC + router wiring below.
 *
 * `userId` comes from the JWT `sub` claim (a string). Band member ids are
 * numbers, so we coerce once here rather than at every comparison.
 */
export function filterMyBands<B extends { members: { id: number }[] }>(
  bands: B[],
  userId: string,
): B[] {
  const uid = Number(userId);
  if (!Number.isFinite(uid)) return [];
  return bands.filter((band) => band.members.some((m) => m.id === uid));
}

/**
 * Strips empty optional fields so we don't send `{ style: "" }` to the server
 * (Zod's `.optional()` treats empty strings differently from omitted keys,
 * and `createRequest` downstream expects an absent key for "not set").
 */
export interface MusicianForBandInput {
  kind: "musician-for-band";
  bandId: number;
  instrument: string;
  style?: string;
  rehearsalCommitment?: string;
}

export function buildMusicianForBandInput(args: {
  bandId: number;
  instrument: string;
  style: string;
  rehearsalCommitment: string;
}): MusicianForBandInput {
  const payload: MusicianForBandInput = {
    kind: "musician-for-band",
    bandId: args.bandId,
    instrument: args.instrument.trim(),
  };
  const style = args.style.trim();
  if (style.length > 0) payload.style = style;
  const commitment = args.rehearsalCommitment.trim();
  if (commitment.length > 0) payload.rehearsalCommitment = commitment;
  return payload;
}

export default function PostRequestScreen() {
  return (
    <SafeAreaView
      style={styles.container}
      edges={["left", "right", "top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <QueryBoundary>
          <PostRequestForm />
        </QueryBoundary>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PostRequestForm() {
  const router = useRouter();
  // `system.whoami` returns the authenticated user from the JWT context
  // (`{ id: string, username: string }`). Client-side filtering against
  // `bands.list` keeps this ticket mobile-only (no `bands.listMyBands`
  // server procedure).
  const { data: me } = useSuspenseQuery(trpc.system.whoami.queryOptions());
  const { data: allBands } = useSuspenseQuery(trpc.bands.list.queryOptions());

  const myBands = useMemo(
    () => filterMyBands(allBands, me.id),
    [allBands, me.id],
  );

  const [selectedBandId, setSelectedBandId] = useState<number | null>(
    myBands.length === 1 ? myBands[0].id : null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [instrument, setInstrument] = useState("");
  const [style, setStyle] = useState("");
  const [rehearsalCommitment, setRehearsalCommitment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createRequest = useMutation(
    trpc.requests.create.mutationOptions({
      onSuccess: () => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.navigate("/");
        }
      },
      onError: (err) => {
        setError(err.message);
      },
    }),
  );

  const submitting = createRequest.isPending;
  const hasBands = myBands.length > 0;
  const canSubmit =
    hasBands &&
    selectedBandId !== null &&
    instrument.trim().length > 0 &&
    !submitting;

  const selectedBand = myBands.find((b) => b.id === selectedBandId) ?? null;

  function handleSubmit() {
    if (!canSubmit || selectedBandId === null) return;
    setError(null);
    createRequest.mutate(
      buildMusicianForBandInput({
        bandId: selectedBandId,
        instrument,
        style,
        rehearsalCommitment,
      }),
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Post request</Text>
      </View>

      <Text style={styles.subtitle}>
        Looking for a musician to join one of your bands.
      </Text>

      {!hasBands ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>You&apos;re not in any bands yet</Text>
          <Text style={styles.emptyBody}>
            Join or create a band before posting a request.
          </Text>
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.label}>Band</Text>
          <Pressable
            onPress={() => setPickerOpen((v) => !v)}
            style={[styles.input, styles.pickerField]}
            accessibilityRole="button"
            accessibilityLabel="Select a band"
            accessibilityState={{ expanded: pickerOpen }}
            disabled={submitting}
          >
            <Text
              style={[
                styles.pickerText,
                !selectedBand && styles.pickerPlaceholder,
              ]}
            >
              {selectedBand ? selectedBand.name : "Select a band"}
            </Text>
            <Ionicons
              name={pickerOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color="#7a7a85"
            />
          </Pressable>
          {pickerOpen && (
            <View style={styles.pickerList}>
              {myBands.map((band) => {
                const isSelected = band.id === selectedBandId;
                return (
                  <Pressable
                    key={band.id}
                    onPress={() => {
                      setSelectedBandId(band.id);
                      setPickerOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.pickerOption,
                      isSelected && styles.pickerOptionSelected,
                      pressed && styles.pickerOptionPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={styles.pickerOptionText}>{band.name}</Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={18} color="#6c63ff" />
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          <Text style={styles.label}>Instrument</Text>
          <TextInput
            style={styles.input}
            value={instrument}
            onChangeText={setInstrument}
            autoCapitalize="words"
            autoCorrect={false}
            placeholder="e.g. Bass"
            placeholderTextColor="#555"
            editable={!submitting}
            returnKeyType="next"
          />

          <Text style={styles.label}>Style (optional)</Text>
          <TextInput
            style={styles.input}
            value={style}
            onChangeText={setStyle}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="e.g. jazz-funk"
            placeholderTextColor="#555"
            editable={!submitting}
            returnKeyType="next"
          />

          <Text style={styles.label}>Rehearsal commitment (optional)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={rehearsalCommitment}
            onChangeText={setRehearsalCommitment}
            multiline
            numberOfLines={3}
            placeholder="e.g. Weekly rehearsals, Tuesdays 7pm"
            placeholderTextColor="#555"
            editable={!submitting}
          />

          {error && (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          )}

          <Pressable
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
              <Text style={styles.buttonText}>Post request</Text>
            )}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f11" },
  flex: { flex: 1 },
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
  subtitle: {
    color: "#7a7a85",
    fontSize: 14,
    marginBottom: 24,
  },
  form: { gap: 8 },
  label: {
    color: "#7a7a85",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 12,
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
    minHeight: 80,
    textAlignVertical: "top",
  },
  pickerField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerText: { color: "#fff", fontSize: 16 },
  pickerPlaceholder: { color: "#555" },
  pickerList: {
    backgroundColor: "#1a1a1f",
    borderWidth: 1,
    borderColor: "#2a2a30",
    borderRadius: 8,
    marginTop: -4,
    overflow: "hidden",
  },
  pickerOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#2a2a30",
  },
  pickerOptionSelected: { backgroundColor: "#22222a" },
  pickerOptionPressed: { opacity: 0.7 },
  pickerOptionText: { color: "#fff", fontSize: 16 },
  error: {
    color: "#ff6b6b",
    fontSize: 14,
    marginTop: 12,
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
  emptyState: {
    marginTop: 24,
    padding: 20,
    backgroundColor: "#1a1a1f",
    borderRadius: 12,
    gap: 6,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyBody: {
    color: "#7a7a85",
    fontSize: 14,
  },
});
