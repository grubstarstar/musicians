import { Ionicons } from "@expo/vector-icons";
import {
  useMutation,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import { InstrumentAutocomplete } from "../../../../src/components/InstrumentAutocomplete";
import { QueryBoundary } from "../../../../src/components/QueryBoundary";
import { queryClient, trpc } from "../../../../src/trpc";
import { parsePostRequestParams } from "../../../../src/utils/parsePostRequestParams";
import {
  buildBandForGigSlotInput,
  buildBandForMusicianInput,
  buildGigForBandInput,
  buildMusicianForBandInput,
  buildNightAtVenueInput,
  buildPromoterForVenueNightInput,
  filterMyBands,
} from "../../../../src/utils/requestInputs";

// --- Kind selector ---------------------------------------------------------

type RequestKind =
  | "musician-for-band"
  | "band-for-gig-slot"
  | "gig-for-band"
  | "night-at-venue"
  | "promoter-for-venue-night"
  | "band-for-musician";

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
  {
    value: "gig-for-band",
    label: "Gig for my band",
    blurb: "We're a band and we're looking for a gig on a specific date.",
  },
  {
    value: "night-at-venue",
    label: "Night at a venue",
    blurb: "I'm a promoter with a concept and possible dates; I need a venue.",
  },
  {
    value: "promoter-for-venue-night",
    label: "Promoter for a venue night",
    blurb: "I represent a venue with a free night; I need a promoter to run it.",
  },
  {
    value: "band-for-musician",
    label: "Band for me",
    blurb: "I play an instrument and I'm looking to join a band.",
  },
];

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

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
  const { data: allVenues } = useSuspenseQuery(
    trpc.venues.list.queryOptions(),
  );

  // MUS-70: seed from deep-link params supplied by in-context entry points
  // (e.g. band page `+`, gig page `+`). `useLocalSearchParams` is stable on
  // first render; we only consume it once to seed `useState` initialisers so
  // user edits are never overwritten by a later re-read of the same params.
  //
  // MUS-77: `slotId` is the new slot-anchored entry point from the gig-detail
  // `+` CTA. When present and the viewer organises the slot's gig, the
  // subsequent `gigs.getSlotById` query resolves the slot's gig + genre and
  // the effect below seeds the form. When the viewer doesn't own the slot
  // (or the slot is missing), the server returns NOT_FOUND and the form
  // stays blank — the ownership gate is entirely server-side.
  const rawParams = useLocalSearchParams<{
    kind?: string;
    bandId?: string;
    gigId?: string;
    genre?: string;
    slotId?: string;
  }>();
  // `useMemo([])` freezes the seed to the first-render params. Even if the
  // caller navigates to the same screen with different params later, the
  // form state is already populated and honours user edits from that point.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const seed = useMemo(() => parsePostRequestParams(rawParams), []);

  // MUS-77: resolve the slot's gig + genre when `slotId` is present. We use
  // non-suspense `useQuery` (not `useSuspenseQuery`) for two reasons:
  //   - the seed is a progressive enhancement; a blank form is a correct
  //     fallback for slot-not-found, not an error surface;
  //   - `useSuspenseQuery` would blank the whole form during the fetch and
  //     throw to the QueryBoundary on NOT_FOUND, neither of which is the
  //     desired behaviour (see `InstrumentAutocomplete` for the same
  //     deviation, with the same rationale).
  // The query only fires when we have a positive integer `slotId`; malformed
  // params short-circuit at the parser boundary and `enabled` stays false.
  const slotSeedQuery = useQuery({
    ...trpc.gigs.getSlotById.queryOptions({ slotId: seed.slotId ?? 0 }),
    enabled: seed.slotId !== null,
    // Ownership failures land as `NOT_FOUND` — don't retry those. A pasted
    // URL with someone else's slot should fall back to a blank form
    // immediately, not after three silent retries.
    retry: false,
  });

  const myBands = useMemo(
    () => filterMyBands(allBands, me.id),
    [allBands, me.id],
  );

  const [kind, setKind] = useState<RequestKind>(
    seed.kind ?? "musician-for-band",
  );

  // musician-for-band form state. Seed precedence: explicit `bandId` param
  // wins, otherwise fall back to the "only one band" convenience default.
  const [selectedBandId, setSelectedBandId] = useState<number | null>(
    seed.bandId !== null && myBands.some((b) => b.id === seed.bandId)
      ? seed.bandId
      : myBands.length === 1
        ? myBands[0].id
        : null,
  );
  const [bandPickerOpen, setBandPickerOpen] = useState(false);
  // MUS-68: instrument is now a taxonomy-backed autocomplete. Keep the
  // visible text separately from the committed id so the user can still
  // type freely (for search), with `instrumentId` only set once they pick
  // a row.
  const [instrumentText, setInstrumentText] = useState("");
  const [instrumentId, setInstrumentId] = useState<number | null>(null);
  const [style, setStyle] = useState("");
  const [rehearsalCommitment, setRehearsalCommitment] = useState("");

  // band-for-gig-slot form state. Seed precedence mirrors `selectedBandId`:
  // explicit `gigId` wins (only if the viewer actually organises that gig —
  // the gig-side `+` is rendered owner-only, but a pasted URL shouldn't bypass
  // that check), otherwise fall back to the "only one gig" convenience.
  //
  // MUS-77: when `slotId` is present, the slot-seed effect below overrides
  // this initial value once the `getSlotById` fetch resolves. The initial
  // state still falls back to the "only one gig" convenience so the form
  // isn't momentarily blank while the slot query is in flight.
  const [selectedGigId, setSelectedGigId] = useState<number | null>(
    seed.gigId !== null && myGigs.some((g) => g.id === seed.gigId)
      ? seed.gigId
      : myGigs.length === 1
        ? myGigs[0].id
        : null,
  );
  const [gigPickerOpen, setGigPickerOpen] = useState(false);
  const [setLength, setSetLength] = useState("");
  const [feeOffered, setFeeOffered] = useState("");
  // MUS-77: genre requirement seeded from the slot. The display stays
  // visible on the `band-for-gig-slot` sub-form so the user can confirm
  // what they're posting against; clearing it removes the genre filter from
  // the submitted payload. A full genre picker is out of scope for this
  // ticket (tracked separately in the MUS-103 follow-up) — the seeded value
  // can only be cleared, not replaced, from this screen.
  const [seededGenre, setSeededGenre] = useState<{
    id: number;
    slug: string;
    name: string;
  } | null>(null);
  // Tracks whether we've already applied the one-shot slot seed. Once true
  // the effect no-ops, so subsequent refetches (e.g. React Query background
  // revalidation) can't stomp on user edits.
  const [slotSeedApplied, setSlotSeedApplied] = useState(false);

  // gig-for-band form state (reuses `selectedBandId` / `bandPickerOpen` so
  // the band picker widget doesn't need a second copy).
  const [targetDate, setTargetDate] = useState("");
  const [area, setArea] = useState("");
  const [feeAsked, setFeeAsked] = useState("");

  // night-at-venue form state. `possibleDates` is a chip list; `dateDraft`
  // is the pending input before tapping Add. No native date picker — the
  // ticket says any reasonable RN pattern is fine and we're matching the
  // existing gig-for-band yyyy-mm-dd text approach rather than pulling a
  // new dep.
  const [concept, setConcept] = useState("");
  const [dateDraft, setDateDraft] = useState("");
  const [possibleDates, setPossibleDates] = useState<string[]>([]);

  // promoter-for-venue-night form state. Reuses `concept` + `proposedDate`
  // (not `targetDate`, different semantics) and a venue picker.
  const [selectedVenueId, setSelectedVenueId] = useState<number | null>(null);
  const [venuePickerOpen, setVenuePickerOpen] = useState(false);
  const [proposedDate, setProposedDate] = useState("");

  // band-for-musician form state. MUS-68: instrument picked via the
  // taxonomy autocomplete. See `instrumentText` / `instrumentId` comment
  // above.
  const [bandForMeInstrumentText, setBandForMeInstrumentText] = useState("");
  const [bandForMeInstrumentId, setBandForMeInstrumentId] = useState<number | null>(null);
  const [availability, setAvailability] = useState("");
  const [demosUrl, setDemosUrl] = useState("");

  const [error, setError] = useState<string | null>(null);
  // Tracks which request was just created so we can show the suggestion card
  // keyed on that specific id before navigating away.
  const [createdRequestId, setCreatedRequestId] = useState<number | null>(null);

  // MUS-77: once the slot seed query resolves successfully, apply it to the
  // form once. We switch `kind` to `band-for-gig-slot`, select the seeded
  // gig, and pre-fill the genre. The `slotSeedApplied` guard makes this a
  // one-shot — background refetches won't replay the seed over a user who's
  // since changed kind or gig.
  //
  // Failures (slot missing, or caller isn't the organiser) land on
  // `slotSeedQuery.error`; we do nothing in that case so the form stays
  // blank / default-filled. That's the ownership-gate fallback.
  const slotSeedData = slotSeedQuery.data;
  useEffect(() => {
    if (slotSeedApplied) return;
    if (!slotSeedData) return;
    // Only apply when the caller's gig list includes the seeded gig. If not,
    // the picker would show a stale selection with nothing to render — skip
    // the seed and leave the user to pick manually. In practice this
    // matches the server-side gate (the slot's gig is the caller's, so it
    // should be in `myGigs`), but keeping the double check makes the
    // failure modes graceful if `listMine` is temporarily stale.
    const gigInList = myGigs.some((g) => g.id === slotSeedData.gigId);
    if (!gigInList) return;
    setKind("band-for-gig-slot");
    setSelectedGigId(slotSeedData.gigId);
    setSeededGenre(slotSeedData.genre);
    setSlotSeedApplied(true);
  }, [slotSeedApplied, slotSeedData, myGigs]);

  const createRequest = useMutation(
    trpc.requests.create.mutationOptions({
      onSuccess: (data) => {
        setCreatedRequestId(data.id);
        // Ensure the matches view refetches — the new request may now appear
        // as someone's counterpart.
        queryClient.invalidateQueries({
          queryKey: trpc.matches.listForUser.queryOptions().queryKey,
        });
        // Refresh My requests so the new row appears on return.
        queryClient.invalidateQueries({
          queryKey: trpc.requests.listMine.queryOptions().queryKey,
        });
      },
      onError: (err) => {
        setError(err.message);
      },
    }),
  );

  const submitting = createRequest.isPending;

  const hasBands = myBands.length > 0;
  const hasGigs = myGigs.length > 0;
  const hasVenues = allVenues.length > 0;
  const selectedBand = myBands.find((b) => b.id === selectedBandId) ?? null;
  const selectedGig = myGigs.find((g) => g.id === selectedGigId) ?? null;
  const selectedVenue =
    allVenues.find((v) => v.id === selectedVenueId) ?? null;

  const targetDateValid = ISO_DAY_RE.test(targetDate.trim());
  const proposedDateValid = ISO_DAY_RE.test(proposedDate.trim());

  const canSubmit =
    !submitting &&
    createdRequestId === null &&
    (kind === "musician-for-band"
      ? hasBands && selectedBandId !== null && instrumentId !== null
      : kind === "band-for-gig-slot"
        ? hasGigs &&
          selectedGigId !== null &&
          (selectedGig?.openSlots ?? 0) > 0
        : kind === "gig-for-band"
          ? hasBands && selectedBandId !== null && targetDateValid
          : kind === "night-at-venue"
            ? concept.trim().length > 0 && possibleDates.length > 0
            : kind === "promoter-for-venue-night"
              ? hasVenues &&
                selectedVenueId !== null &&
                proposedDateValid
              : // band-for-musician
                bandForMeInstrumentId !== null);

  function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    if (
      kind === "musician-for-band" &&
      selectedBandId !== null &&
      instrumentId !== null
    ) {
      createRequest.mutate(
        buildMusicianForBandInput({
          bandId: selectedBandId,
          instrumentId,
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
          // MUS-77: surface the seeded genre filter through to the server.
          // `null` means "open to any band" (the server falls back to
          // letting any band EoI — see the MUS-103 EoI hard-gate for the
          // enforcement path).
          genreId: seededGenre?.id ?? null,
        }),
      );
      return;
    }
    if (kind === "gig-for-band" && selectedBandId !== null) {
      const payload = buildGigForBandInput({
        bandId: selectedBandId,
        targetDate,
        area,
        feeAsked,
      });
      if (!payload) {
        setError("Target date must be in yyyy-mm-dd format (e.g. 2026-05-10)");
        return;
      }
      createRequest.mutate(payload);
      return;
    }
    if (kind === "night-at-venue") {
      const payload = buildNightAtVenueInput({ concept, possibleDates });
      if (!payload) {
        setError("Enter a concept and at least one yyyy-mm-dd date.");
        return;
      }
      createRequest.mutate(payload);
      return;
    }
    if (kind === "promoter-for-venue-night" && selectedVenueId !== null) {
      const payload = buildPromoterForVenueNightInput({
        venueId: selectedVenueId,
        proposedDate,
        concept,
      });
      if (!payload) {
        setError(
          "Proposed date must be in yyyy-mm-dd format (e.g. 2026-05-10)",
        );
        return;
      }
      createRequest.mutate(payload);
      return;
    }
    if (kind === "band-for-musician") {
      const payload = buildBandForMusicianInput({
        instrumentId: bandForMeInstrumentId,
        availability,
        demosUrl,
      });
      if (!payload) {
        setError("Pick an instrument to continue.");
        return;
      }
      createRequest.mutate(payload);
    }
  }

  /** Add the current `dateDraft` to `possibleDates` if valid; silently
   *  ignores duplicates and invalid strings (the Add button is disabled in
   *  those cases, but a paranoid guard keeps the state clean). */
  function addPossibleDate() {
    const trimmed = dateDraft.trim();
    if (!ISO_DAY_RE.test(trimmed)) return;
    if (possibleDates.includes(trimmed)) {
      setDateDraft("");
      return;
    }
    setPossibleDates((prev) => [...prev, trimmed].sort());
    setDateDraft("");
  }

  function removePossibleDate(date: string) {
    setPossibleDates((prev) => prev.filter((d) => d !== date));
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
          instrumentText={instrumentText}
          instrumentId={instrumentId}
          onInstrumentTextChange={(t) => {
            setInstrumentText(t);
            // Typing after a selection invalidates the selection so the
            // submit button doesn't stay green on stale state.
            if (instrumentId !== null) setInstrumentId(null);
          }}
          onInstrumentSelect={(id, name) => {
            setInstrumentId(id);
            setInstrumentText(name);
          }}
          style={style}
          setStyle={setStyle}
          rehearsalCommitment={rehearsalCommitment}
          setRehearsalCommitment={setRehearsalCommitment}
          submitting={submitting || createdRequestId !== null}
        />
      ) : kind === "band-for-gig-slot" ? (
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
          seededGenre={seededGenre}
          onClearGenre={() => setSeededGenre(null)}
          submitting={submitting || createdRequestId !== null}
        />
      ) : kind === "gig-for-band" ? (
        <GigForBandForm
          hasBands={hasBands}
          myBands={myBands}
          selectedBand={selectedBand}
          selectedBandId={selectedBandId}
          setSelectedBandId={setSelectedBandId}
          pickerOpen={bandPickerOpen}
          setPickerOpen={setBandPickerOpen}
          targetDate={targetDate}
          setTargetDate={setTargetDate}
          area={area}
          setArea={setArea}
          feeAsked={feeAsked}
          setFeeAsked={setFeeAsked}
          submitting={submitting || createdRequestId !== null}
        />
      ) : kind === "night-at-venue" ? (
        <NightAtVenueForm
          concept={concept}
          setConcept={setConcept}
          dateDraft={dateDraft}
          setDateDraft={setDateDraft}
          possibleDates={possibleDates}
          onAddDate={addPossibleDate}
          onRemoveDate={removePossibleDate}
          submitting={submitting || createdRequestId !== null}
        />
      ) : kind === "promoter-for-venue-night" ? (
        <PromoterForVenueNightForm
          hasVenues={hasVenues}
          allVenues={allVenues}
          selectedVenue={selectedVenue}
          selectedVenueId={selectedVenueId}
          setSelectedVenueId={setSelectedVenueId}
          pickerOpen={venuePickerOpen}
          setPickerOpen={setVenuePickerOpen}
          proposedDate={proposedDate}
          setProposedDate={setProposedDate}
          concept={concept}
          setConcept={setConcept}
          submitting={submitting || createdRequestId !== null}
        />
      ) : (
        <BandForMusicianForm
          instrumentText={bandForMeInstrumentText}
          instrumentId={bandForMeInstrumentId}
          onInstrumentTextChange={(t) => {
            setBandForMeInstrumentText(t);
            if (bandForMeInstrumentId !== null) setBandForMeInstrumentId(null);
          }}
          onInstrumentSelect={(id, name) => {
            setBandForMeInstrumentId(id);
            setBandForMeInstrumentText(name);
          }}
          availability={availability}
          setAvailability={setAvailability}
          demosUrl={demosUrl}
          setDemosUrl={setDemosUrl}
          submitting={submitting || createdRequestId !== null}
        />
      )}

      {error && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}

      {createdRequestId === null ? (
        <Pressable
          testID="post-request-submit"
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
      ) : (
        <>
          {kind !== "musician-for-band" && (
            <QueryBoundary>
              <MatchSuggestionsCard
                createdRequestId={createdRequestId}
                createdKind={kind}
              />
            </QueryBoundary>
          )}
          <Pressable
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.navigate("/");
            }}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Done</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

// --- Match suggestions card ------------------------------------------------

interface MatchSuggestionsCardProps {
  createdRequestId: number;
  // MUS-58: `musician-for-band` doesn't surface counterpart matches here
  // (we fall through to the musician-to-bands flow elsewhere), but every
  // other kind shows a suggestions card.
  createdKind: Exclude<RequestKind, "musician-for-band">;
}

function MatchSuggestionsCard({
  createdRequestId,
  createdKind,
}: MatchSuggestionsCardProps) {
  const router = useRouter();
  const { data: matches } = useSuspenseQuery(
    trpc.matches.listForUser.queryOptions(),
  );

  // Narrow to matches whose `myRequest.id` is the one we just created so the
  // suggestion is specifically relevant (vs their global matches list).
  const relevant = matches.filter(
    (m) => m.myRequest.id === createdRequestId,
  );

  if (relevant.length === 0) {
    return (
      <View style={styles.matchCard}>
        <Text style={styles.matchCardTitle}>Request posted</Text>
        <Text style={styles.matchCardBody}>
          No matching counterpart posts yet. We&apos;ll surface them on the
          Home screen when they appear.
        </Text>
      </View>
    );
  }

  const counterpartNoun = counterpartNounFor(createdKind);

  return (
    <View style={styles.matchCard}>
      <Text style={styles.matchCardTitle}>
        {relevant.length} {counterpartNoun} match your post
      </Text>
      <Text style={styles.matchCardBody}>
        Tap to open and invite them.
      </Text>
      <View style={styles.matchList}>
        {relevant.slice(0, 5).map((m) => (
          <Pressable
            key={m.counterpart.id}
            onPress={() => router.navigate(`/request/${m.counterpart.id}`)}
            style={({ pressed }) => [
              styles.matchRow,
              pressed && styles.matchRowPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={matchRowLabel(m.counterpart)}
          >
            <Text style={styles.matchRowText}>
              {matchRowLabel(m.counterpart)}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#7a7a85" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function counterpartNounFor(kind: Exclude<RequestKind, "musician-for-band">): string {
  switch (kind) {
    case "band-for-gig-slot":
      return "bands";
    case "gig-for-band":
      return "promoters";
    case "night-at-venue":
      return "venues";
    case "promoter-for-venue-night":
      return "promoters";
    case "band-for-musician":
      return "bands";
  }
}

type MatchCounterpart = {
  kind:
    | "band-for-gig-slot"
    | "gig-for-band"
    | "night-at-venue"
    | "promoter-for-venue-night"
    | "musician-for-band"
    | "band-for-musician";
  bandName: string | null;
  targetDate: string | null;
  gigDatetime: Date | string | null;
  gigVenueName: string | null;
  // MUS-68: tRPC counterpart shape carries the instrument id + denormalised
  // name rather than a free-text string.
  instrumentId: number | null;
  instrumentName: string | null;
  proposedDate: string | null;
  venueName: string | null;
  possibleDates: string[] | null;
};

function matchRowLabel(c: MatchCounterpart): string {
  if (c.kind === "gig-for-band") {
    const who = c.bandName ?? "A band";
    const date = c.targetDate ?? "";
    return `${who} — looking for a gig ${date}`.trim();
  }
  if (c.kind === "band-for-gig-slot") {
    const date = formatCounterpartDate(c.gigDatetime);
    const venue = c.gigVenueName ?? "a venue";
    return `Gig slot at ${venue}${date ? ` on ${date}` : ""}`;
  }
  if (c.kind === "night-at-venue") {
    const when =
      c.possibleDates !== null && c.possibleDates.length > 0
        ? ` on ${c.possibleDates.slice(0, 3).join(", ")}`
        : "";
    return `Promoter wants to run a night${when}`;
  }
  if (c.kind === "promoter-for-venue-night") {
    const venue = c.venueName ?? "a venue";
    const date = c.proposedDate ?? "";
    return `${venue} free ${date}`.trim();
  }
  if (c.kind === "musician-for-band") {
    const who = c.bandName ?? "A band";
    const what = c.instrumentName ?? "a musician";
    return `${who} — looking for a ${what}`;
  }
  // band-for-musician
  const what = c.instrumentName ?? "an instrument";
  return `Musician plays ${what}`;
}

function formatCounterpartDate(
  datetime: Date | string | null,
): string {
  if (datetime === null) return "";
  const d = typeof datetime === "string" ? new Date(datetime) : datetime;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
  instrumentText: string;
  instrumentId: number | null;
  onInstrumentTextChange: (v: string) => void;
  onInstrumentSelect: (id: number, name: string) => void;
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
      <InstrumentAutocomplete
        testID="post-request-instrument"
        value={props.instrumentId}
        text={props.instrumentText}
        onChangeText={props.onInstrumentTextChange}
        onSelect={props.onInstrumentSelect}
        disabled={props.submitting}
        placeholder="e.g. Bass Guitar"
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
  // MUS-77: genre seeded from the slot-anchored entry point. Null when the
  // slot had no genre filter or when the user cleared the chip below.
  seededGenre: { id: number; slug: string; name: string } | null;
  onClearGenre: () => void;
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

      {/* MUS-77: genre pre-fill surfaced from the slot-anchored entry point.
          A full genre picker is out of scope for this ticket — the seeded
          value is shown read-only with a clear affordance. The user can
          post without a genre filter by tapping the chip. */}
      {props.seededGenre && (
        <>
          <Text style={styles.label}>Genre</Text>
          <View style={styles.seededGenreRow}>
            <View
              testID="post-request-seeded-genre"
              style={styles.seededGenreChip}
              accessibilityLabel={`Genre pre-filled: ${props.seededGenre.name}`}
            >
              <Text style={styles.seededGenreChipText}>
                {props.seededGenre.name}
              </Text>
            </View>
            <Pressable
              onPress={props.onClearGenre}
              disabled={props.submitting}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear genre filter"
              testID="post-request-seeded-genre-clear"
              style={({ pressed }) => [
                styles.seededGenreClear,
                pressed && styles.buttonPressed,
                props.submitting && styles.buttonDisabled,
              ]}
            >
              <Ionicons name="close" size={16} color="#c8c8d0" />
            </Pressable>
          </View>
        </>
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

// --- Sub-form: gig-for-band -----------------------------------------------

function GigForBandForm(props: {
  hasBands: boolean;
  myBands: BandPick[];
  selectedBand: BandPick | null;
  selectedBandId: number | null;
  setSelectedBandId: (id: number) => void;
  pickerOpen: boolean;
  setPickerOpen: (f: (v: boolean) => boolean) => void;
  targetDate: string;
  setTargetDate: (v: string) => void;
  area: string;
  setArea: (v: string) => void;
  feeAsked: string;
  setFeeAsked: (v: string) => void;
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

      <Text style={styles.label}>Target date (yyyy-mm-dd)</Text>
      <TextInput
        style={styles.input}
        value={props.targetDate}
        onChangeText={props.setTargetDate}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="2026-05-10"
        placeholderTextColor="#555"
        editable={!props.submitting}
        returnKeyType="next"
      />

      <Text style={styles.label}>Area (optional)</Text>
      <TextInput
        style={styles.input}
        value={props.area}
        onChangeText={props.setArea}
        autoCapitalize="words"
        autoCorrect={false}
        placeholder="e.g. Melbourne"
        placeholderTextColor="#555"
        editable={!props.submitting}
        returnKeyType="next"
      />

      <Text style={styles.label}>Fee asked in cents (optional)</Text>
      <TextInput
        style={styles.input}
        value={props.feeAsked}
        onChangeText={props.setFeeAsked}
        keyboardType="numeric"
        placeholder="e.g. 20000 for $200"
        placeholderTextColor="#555"
        editable={!props.submitting}
        returnKeyType="done"
      />
    </View>
  );
}

// --- Sub-form: night-at-venue --------------------------------------------

function NightAtVenueForm(props: {
  concept: string;
  setConcept: (v: string) => void;
  dateDraft: string;
  setDateDraft: (v: string) => void;
  possibleDates: string[];
  onAddDate: () => void;
  onRemoveDate: (date: string) => void;
  submitting: boolean;
}) {
  const canAddDraft = ISO_DAY_RE.test(props.dateDraft.trim());

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Concept</Text>
      <TextInput
        style={styles.input}
        value={props.concept}
        onChangeText={props.setConcept}
        autoCapitalize="sentences"
        autoCorrect
        placeholder="e.g. Saturday jazz showcase"
        placeholderTextColor="#555"
        editable={!props.submitting}
        returnKeyType="next"
      />

      <Text style={styles.label}>Possible dates (yyyy-mm-dd)</Text>
      <View style={styles.dateAddRow}>
        <TextInput
          style={[styles.input, styles.dateAddInput]}
          value={props.dateDraft}
          onChangeText={props.setDateDraft}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="2026-05-10"
          placeholderTextColor="#555"
          editable={!props.submitting}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (canAddDraft) props.onAddDate();
          }}
        />
        <Pressable
          onPress={props.onAddDate}
          disabled={!canAddDraft || props.submitting}
          style={({ pressed }) => [
            styles.dateAddBtn,
            (!canAddDraft || props.submitting) && styles.buttonDisabled,
            pressed && canAddDraft && !props.submitting && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Add date"
          accessibilityState={{ disabled: !canAddDraft || props.submitting }}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      </View>
      {props.possibleDates.length === 0 ? (
        <Text style={styles.helperText}>
          Add one or more dates you could run the night on.
        </Text>
      ) : (
        <View style={styles.chipWrap}>
          {props.possibleDates.map((d) => (
            <Pressable
              key={d}
              onPress={() => props.onRemoveDate(d)}
              style={({ pressed }) => [
                styles.chip,
                pressed && styles.chipPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${d}`}
              disabled={props.submitting}
            >
              <Text style={styles.chipText}>{d}</Text>
              <Ionicons name="close" size={14} color="#c8c8d0" />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// --- Sub-form: promoter-for-venue-night ----------------------------------

interface VenuePick {
  id: number;
  name: string;
  address: string;
}

function PromoterForVenueNightForm(props: {
  hasVenues: boolean;
  allVenues: VenuePick[];
  selectedVenue: VenuePick | null;
  selectedVenueId: number | null;
  setSelectedVenueId: (id: number) => void;
  pickerOpen: boolean;
  setPickerOpen: (f: (v: boolean) => boolean) => void;
  proposedDate: string;
  setProposedDate: (v: string) => void;
  concept: string;
  setConcept: (v: string) => void;
  submitting: boolean;
}) {
  if (!props.hasVenues) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No venues on file yet</Text>
        <Text style={styles.emptyBody}>
          Venues are seeded by the admin. Ask the maintainers to add one
          before posting this kind of request.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Venue</Text>
      <Pressable
        onPress={() => props.setPickerOpen((v) => !v)}
        style={[styles.input, styles.pickerField]}
        accessibilityRole="button"
        accessibilityLabel="Select a venue"
        accessibilityState={{ expanded: props.pickerOpen }}
        disabled={props.submitting}
      >
        <Text
          style={[
            styles.pickerText,
            !props.selectedVenue && styles.pickerPlaceholder,
          ]}
        >
          {props.selectedVenue ? props.selectedVenue.name : "Select a venue"}
        </Text>
        <Ionicons
          name={props.pickerOpen ? "chevron-up" : "chevron-down"}
          size={18}
          color="#7a7a85"
        />
      </Pressable>
      {props.pickerOpen && (
        <View style={styles.pickerList}>
          {props.allVenues.map((venue) => {
            const isSelected = venue.id === props.selectedVenueId;
            return (
              <Pressable
                key={venue.id}
                onPress={() => {
                  props.setSelectedVenueId(venue.id);
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
                <Text style={styles.pickerOptionText}>{venue.name}</Text>
                {isSelected && (
                  <Ionicons name="checkmark" size={18} color="#6c63ff" />
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={styles.label}>Proposed date (yyyy-mm-dd)</Text>
      <TextInput
        style={styles.input}
        value={props.proposedDate}
        onChangeText={props.setProposedDate}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="2026-05-10"
        placeholderTextColor="#555"
        editable={!props.submitting}
        returnKeyType="next"
      />

      <Text style={styles.label}>Concept (optional)</Text>
      <TextInput
        style={styles.input}
        value={props.concept}
        onChangeText={props.setConcept}
        autoCapitalize="sentences"
        autoCorrect
        placeholder="e.g. Late-night electronic"
        placeholderTextColor="#555"
        editable={!props.submitting}
        returnKeyType="done"
      />
    </View>
  );
}

// --- Sub-form: band-for-musician -----------------------------------------

function BandForMusicianForm(props: {
  instrumentText: string;
  instrumentId: number | null;
  onInstrumentTextChange: (v: string) => void;
  onInstrumentSelect: (id: number, name: string) => void;
  availability: string;
  setAvailability: (v: string) => void;
  demosUrl: string;
  setDemosUrl: (v: string) => void;
  submitting: boolean;
}) {
  return (
    <View style={styles.form}>
      <Text style={styles.label}>Instrument</Text>
      <InstrumentAutocomplete
        testID="post-request-instrument-band-for-me"
        value={props.instrumentId}
        text={props.instrumentText}
        onChangeText={props.onInstrumentTextChange}
        onSelect={props.onInstrumentSelect}
        disabled={props.submitting}
        placeholder="e.g. Bass Guitar"
      />

      <Text style={styles.label}>Availability (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={props.availability}
        onChangeText={props.setAvailability}
        multiline
        numberOfLines={3}
        placeholder="e.g. Weekends, Tuesday evenings"
        placeholderTextColor="#555"
        editable={!props.submitting}
      />

      <Text style={styles.label}>Demos URL (optional)</Text>
      <TextInput
        style={styles.input}
        value={props.demosUrl}
        onChangeText={props.setDemosUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="https://soundcloud.com/..."
        placeholderTextColor="#555"
        editable={!props.submitting}
        returnKeyType="done"
      />
    </View>
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
  matchCard: {
    marginTop: 24,
    padding: 16,
    backgroundColor: "#1a1a1f",
    borderRadius: 12,
    gap: 8,
  },
  matchCardTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  matchCardBody: { color: "#7a7a85", fontSize: 13 },
  matchList: { gap: 6, marginTop: 6 },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#22222a",
    borderRadius: 8,
    gap: 8,
  },
  matchRowPressed: { opacity: 0.7 },
  matchRowText: { color: "#fff", fontSize: 14, flexShrink: 1 },
  dateAddRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateAddInput: { flex: 1 },
  dateAddBtn: {
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
    marginTop: 4,
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
  helperText: { color: "#7a7a85", fontSize: 13, marginTop: 4 },
  // MUS-77: seeded-genre display row. Reuses the chip visual language from
  // the night-at-venue dates list but rendered solo (the seeded genre is
  // always a single row) and paired with a small clear button so the user
  // can opt out of the filter without needing a full picker.
  seededGenreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  seededGenreChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#22222a",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#6c63ff",
  },
  seededGenreChipText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  seededGenreClear: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22222a",
  },
});
