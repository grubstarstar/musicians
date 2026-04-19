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
import {
  buildBandForGigSlotInput,
  buildMusicianForBandInput,
  filterMyBands,
} from "../../../../src/utils/requestInputs";

// --- Kind selector ---------------------------------------------------------

type RequestKind = "musician-for-band" | "band-for-gig-slot";

const KIND_OPTIONS: { value: RequestKind; label: string; blurb: string }[] = [
  {
    value: "musician-for-band",
    label: "Musician for a band",
    blurb: "I lead a band and want someone to join us.",
  },
  {
    value: "band-for-gig-slot",
    label: "Band for a gig slot",
    blurb: "I'm organising a gig and want bands to fill open slots.",
  },
];

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
  const { data: myGigs } = useSuspenseQuery(trpc.gigs.listMine.queryOptions());

  const myBands = useMemo(
    () => filterMyBands(allBands, me.id),
    [allBands, me.id],
  );

  const [kind, setKind] = useState<RequestKind>("musician-for-band");

  // musician-for-band form state
  const [selectedBandId, setSelectedBandId] = useState<number | null>(
    myBands.length === 1 ? myBands[0].id : null,
  );
  const [bandPickerOpen, setBandPickerOpen] = useState(false);
  const [instrument, setInstrument] = useState("");
  const [style, setStyle] = useState("");
  const [rehearsalCommitment, setRehearsalCommitment] = useState("");

  // band-for-gig-slot form state
  const [selectedGigId, setSelectedGigId] = useState<number | null>(
    myGigs.length === 1 ? myGigs[0].id : null,
  );
  const [gigPickerOpen, setGigPickerOpen] = useState(false);
  const [setLength, setSetLength] = useState("");
  const [feeOffered, setFeeOffered] = useState("");

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
  const hasGigs = myGigs.length > 0;
  const selectedBand = myBands.find((b) => b.id === selectedBandId) ?? null;
  const selectedGig = myGigs.find((g) => g.id === selectedGigId) ?? null;

  const canSubmit =
    !submitting &&
    (kind === "musician-for-band"
      ? hasBands && selectedBandId !== null && instrument.trim().length > 0
      : hasGigs && selectedGigId !== null && (selectedGig?.openSlots ?? 0) > 0);

  function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    if (kind === "musician-for-band" && selectedBandId !== null) {
      createRequest.mutate(
        buildMusicianForBandInput({
          bandId: selectedBandId,
          instrument,
          style,
          rehearsalCommitment,
        }),
      );
      return;
    }
    if (kind === "band-for-gig-slot" && selectedGigId !== null) {
      createRequest.mutate(
        buildBandForGigSlotInput({
          gigId: selectedGigId,
          setLength,
          feeOffered,
        }),
      );
    }
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

      <Text style={styles.label}>Kind</Text>
      <View style={styles.kindList}>
        {KIND_OPTIONS.map((opt) => {
          const selected = opt.value === kind;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                setKind(opt.value);
                setError(null);
              }}
              style={({ pressed }) => [
                styles.kindOption,
                selected && styles.kindOptionSelected,
                pressed && styles.kindOptionPressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              disabled={submitting}
            >
              <View style={styles.kindOptionBody}>
                <Text style={styles.kindOptionLabel}>{opt.label}</Text>
                <Text style={styles.kindOptionBlurb}>{opt.blurb}</Text>
              </View>
              {selected && (
                <Ionicons name="checkmark" size={20} color="#6c63ff" />
              )}
            </Pressable>
          );
        })}
      </View>

      {kind === "musician-for-band" ? (
        <MusicianForBandForm
          hasBands={hasBands}
          myBands={myBands}
          selectedBand={selectedBand}
          selectedBandId={selectedBandId}
          setSelectedBandId={setSelectedBandId}
          pickerOpen={bandPickerOpen}
          setPickerOpen={setBandPickerOpen}
          instrument={instrument}
          setInstrument={setInstrument}
          style={style}
          setStyle={setStyle}
          rehearsalCommitment={rehearsalCommitment}
          setRehearsalCommitment={setRehearsalCommitment}
          submitting={submitting}
        />
      ) : (
        <BandForGigSlotForm
          hasGigs={hasGigs}
          myGigs={myGigs}
          selectedGig={selectedGig}
          selectedGigId={selectedGigId}
          setSelectedGigId={setSelectedGigId}
          pickerOpen={gigPickerOpen}
          setPickerOpen={setGigPickerOpen}
          setLength={setLength}
          setSetLength={setSetLength}
          feeOffered={feeOffered}
          setFeeOffered={setFeeOffered}
          submitting={submitting}
        />
      )}

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
    </ScrollView>
  );
}

// --- Sub-form: musician-for-band ------------------------------------------

interface BandPick {
  id: number;
  name: string;
}

function MusicianForBandForm(props: {
  hasBands: boolean;
  myBands: BandPick[];
  selectedBand: BandPick | null;
  selectedBandId: number | null;
  setSelectedBandId: (id: number) => void;
  pickerOpen: boolean;
  setPickerOpen: (f: (v: boolean) => boolean) => void;
  instrument: string;
  setInstrument: (v: string) => void;
  style: string;
  setStyle: (v: string) => void;
  rehearsalCommitment: string;
  setRehearsalCommitment: (v: string) => void;
  submitting: boolean;
}) {
  if (!props.hasBands) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>You&apos;re not in any bands yet</Text>
        <Text style={styles.emptyBody}>
          Join or create a band before posting this kind of request.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Band</Text>
      <Pressable
        onPress={() => props.setPickerOpen((v) => !v)}
        style={[styles.input, styles.pickerField]}
        accessibilityRole="button"
        accessibilityLabel="Select a band"
        accessibilityState={{ expanded: props.pickerOpen }}
        disabled={props.submitting}
      >
        <Text
          style={[
            styles.pickerText,
            !props.selectedBand && styles.pickerPlaceholder,
          ]}
        >
          {props.selectedBand ? props.selectedBand.name : "Select a band"}
        </Text>
        <Ionicons
          name={props.pickerOpen ? "chevron-up" : "chevron-down"}
          size={18}
          color="#7a7a85"
        />
      </Pressable>
      {props.pickerOpen && (
        <View style={styles.pickerList}>
          {props.myBands.map((band) => {
            const isSelected = band.id === props.selectedBandId;
            return (
              <Pressable
                key={band.id}
                onPress={() => {
                  props.setSelectedBandId(band.id);
                  props.setPickerOpen(() => false);
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
        value={props.instrument}
        onChangeText={props.setInstrument}
        autoCapitalize="words"
        autoCorrect={false}
        placeholder="e.g. Bass"
        placeholderTextColor="#555"
        editable={!props.submitting}
        returnKeyType="next"
      />

      <Text style={styles.label}>Style (optional)</Text>
      <TextInput
        style={styles.input}
        value={props.style}
        onChangeText={props.setStyle}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="e.g. jazz-funk"
        placeholderTextColor="#555"
        editable={!props.submitting}
        returnKeyType="next"
      />

      <Text style={styles.label}>Rehearsal commitment (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={props.rehearsalCommitment}
        onChangeText={props.setRehearsalCommitment}
        multiline
        numberOfLines={3}
        placeholder="e.g. Weekly rehearsals, Tuesdays 7pm"
        placeholderTextColor="#555"
        editable={!props.submitting}
      />
    </View>
  );
}

// --- Sub-form: band-for-gig-slot ------------------------------------------

interface GigPick {
  id: number;
  datetime: string | Date;
  venue: { id: number; name: string };
  openSlots: number;
  totalSlots: number;
}

function BandForGigSlotForm(props: {
  hasGigs: boolean;
  myGigs: GigPick[];
  selectedGig: GigPick | null;
  selectedGigId: number | null;
  setSelectedGigId: (id: number) => void;
  pickerOpen: boolean;
  setPickerOpen: (f: (v: boolean) => boolean) => void;
  setLength: string;
  setSetLength: (v: string) => void;
  feeOffered: string;
  setFeeOffered: (v: string) => void;
  submitting: boolean;
}) {
  if (!props.hasGigs) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>You haven&apos;t organised a gig yet</Text>
        <Text style={styles.emptyBody}>
          Create a gig with open slots before posting this kind of request.
        </Text>
      </View>
    );
  }

  const noOpenSlots =
    props.selectedGig !== null && props.selectedGig.openSlots === 0;

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Gig</Text>
      <Pressable
        onPress={() => props.setPickerOpen((v) => !v)}
        style={[styles.input, styles.pickerField]}
        accessibilityRole="button"
        accessibilityLabel="Select a gig"
        accessibilityState={{ expanded: props.pickerOpen }}
        disabled={props.submitting}
      >
        <Text
          style={[
            styles.pickerText,
            !props.selectedGig && styles.pickerPlaceholder,
          ]}
        >
          {props.selectedGig
            ? formatGigSummary(props.selectedGig)
            : "Select a gig"}
        </Text>
        <Ionicons
          name={props.pickerOpen ? "chevron-up" : "chevron-down"}
          size={18}
          color="#7a7a85"
        />
      </Pressable>
      {props.pickerOpen && (
        <View style={styles.pickerList}>
          {props.myGigs.map((gig) => {
            const isSelected = gig.id === props.selectedGigId;
            return (
              <Pressable
                key={gig.id}
                onPress={() => {
                  props.setSelectedGigId(gig.id);
                  props.setPickerOpen(() => false);
                }}
                style={({ pressed }) => [
                  styles.pickerOption,
                  isSelected && styles.pickerOptionSelected,
                  pressed && styles.pickerOptionPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={styles.pickerOptionText}>
                  {formatGigSummary(gig)}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark" size={18} color="#6c63ff" />
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {noOpenSlots && (
        <Text style={styles.warning}>
          This gig has no open slots. Pick another gig or add slots first.
        </Text>
      )}

      <Text style={styles.label}>Set length in minutes (optional)</Text>
      <TextInput
        style={styles.input}
        value={props.setLength}
        onChangeText={props.setSetLength}
        keyboardType="numeric"
        placeholder="e.g. 45"
        placeholderTextColor="#555"
        editable={!props.submitting}
        returnKeyType="next"
      />

      <Text style={styles.label}>Fee offered in cents (optional)</Text>
      <TextInput
        style={styles.input}
        value={props.feeOffered}
        onChangeText={props.setFeeOffered}
        keyboardType="numeric"
        placeholder="e.g. 25000 for $250"
        placeholderTextColor="#555"
        editable={!props.submitting}
        returnKeyType="done"
      />
    </View>
  );
}

function formatGigSummary(gig: GigPick): string {
  const date = typeof gig.datetime === "string" ? new Date(gig.datetime) : gig.datetime;
  const d = date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
  return `${d} • ${gig.venue.name} • ${gig.openSlots}/${gig.totalSlots} open`;
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
    marginBottom: 16,
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
  kindList: { gap: 8, marginTop: 4 },
  kindOption: {
    backgroundColor: "#1a1a1f",
    borderWidth: 1,
    borderColor: "#2a2a30",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  kindOptionSelected: {
    borderColor: "#6c63ff",
    backgroundColor: "#22222a",
  },
  kindOptionPressed: { opacity: 0.85 },
  kindOptionBody: { flex: 1, gap: 2 },
  kindOptionLabel: { color: "#fff", fontSize: 15, fontWeight: "600" },
  kindOptionBlurb: { color: "#7a7a85", fontSize: 13 },
  warning: {
    color: "#f7c948",
    fontSize: 13,
    marginTop: 4,
  },
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
