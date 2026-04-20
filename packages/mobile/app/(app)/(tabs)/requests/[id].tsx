import { Ionicons } from "@expo/vector-icons";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { type ReactNode, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { QueryBoundary } from "../../../../src/components/QueryBoundary";
import { queryClient, trpc } from "../../../../src/trpc";
import { formatRelative } from "../../../../src/utils/formatRelative";

/**
 * Request detail + Express Interest screen. Opens when a user taps a row on
 * the Opportunities (Notices) tab (MUS-54). Wraps the tRPC suspense reads in
 * QueryBoundary per the project's mobile Suspense pattern. Lives inside the
 * Opportunities tab's own stack (MUS-62) so Back returns to the list.
 */
export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return <RequestNotFound />;
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
        <QueryBoundary notFoundFallback={<RequestNotFound />}>
          <RequestDetailInner id={parsedId} />
        </QueryBoundary>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RequestDetailInner({ id }: { id: number }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [submittedEoi, setSubmittedEoi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGigId, setSelectedGigId] = useState<number | null>(null);
  const [selectedBandId, setSelectedBandId] = useState<number | null>(null);
  // MUS-58: venue rep picks a venue + proposed date when replying to a
  // night-at-venue request.
  const [selectedVenueId, setSelectedVenueId] = useState<number | null>(null);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  // MUS-58: promoter sets an optional concept when replying to a
  // promoter-for-venue-night request.
  const [conceptOverride, setConceptOverride] = useState("");

  // The self-authored + already-pending guards are enforced by the server
  // (FORBIDDEN / CONFLICT respectively) and surfaced here via the mutation
  // `onError` handler below — the detail response intentionally does not
  // leak `source_user_id`.
  const requestQueryOptions = trpc.requests.getById.queryOptions({ id });
  const { data } = useSuspenseQuery(requestQueryOptions);
  // Preload data the counterpart-kind forms below need to pre-fill a one-tap
  // EoI. Cheap to fetch even for `musician-for-band` (single round-trip each)
  // and keeps conditional Suspense noise out of the render path.
  const { data: me } = useSuspenseQuery(trpc.system.whoami.queryOptions());
  const { data: allBands } = useSuspenseQuery(trpc.bands.list.queryOptions());
  const { data: myGigs } = useSuspenseQuery(trpc.gigs.listMine.queryOptions());
  const { data: allVenues } = useSuspenseQuery(
    trpc.venues.list.queryOptions(),
  );
  const myBandIds = allBands
    .filter((b) => b.members.some((m) => m.id === Number(me.id)))
    .map((b) => b.id);

  const now = new Date();
  const createdAt = new Date(data.createdAt);

  const createEoi = useMutation(
    trpc.expressionsOfInterest.create.mutationOptions({
      onSuccess: () => {
        setSubmittedEoi(true);
        setError(null);
        // Refresh the detail screen's request state (slot counters may have
        // moved) and the discovery list so rows re-render with fresh data.
        queryClient.invalidateQueries({ queryKey: requestQueryOptions.queryKey });
        queryClient.invalidateQueries({
          queryKey: trpc.requests.list.queryOptions({
            kind: "musician-for-band",
          }).queryKey,
        });
        queryClient.invalidateQueries({
          queryKey: trpc.matches.listForUser.queryOptions().queryKey,
        });
      },
      onError: (err) => {
        const message = err.message;
        // A CONFLICT from the server means "you already have a pending EoI"
        // — treat as submitted to keep the UI honest.
        const code = (err.data as { code?: string } | null | undefined)?.code;
        if (code === "CONFLICT") {
          setSubmittedEoi(true);
        }
        setError(message);
      },
    }),
  );

  const submitting = createEoi.isPending;
  const closed = data.status !== "open";

  const { details } = data;

  // --- musician-for-band ---------------------------------------------------
  if (details.kind === "musician-for-band") {
    if (data.band === null) return <RequestNotFound />;
    const canSubmit = !submittedEoi && !closed && !submitting;
    // Arrow form (not `function handleSubmit()`) — a block-scoped function
    // declaration inside this `if` branch was being bound stale by Metro
    // Fast Refresh, causing onPress to call a no-op reference.
    const handleSubmit = () => {
      if (!canSubmit) return;
      if (details.kind !== "musician-for-band") return;
      const trimmed = notes.trim();
      createEoi.mutate({
        requestId: id,
        details:
          trimmed.length > 0
            ? { kind: "musician-for-band", notes: trimmed }
            : { kind: "musician-for-band" },
      });
    };
    return (
      <DetailLayout
        router={router}
        band={data.band}
        createdAt={createdAt}
        now={now}
        heading={details.instrument}
        extraRows={[
          details.style ? { label: "Style", value: details.style } : null,
          details.rehearsalCommitment
            ? {
                label: "Rehearsal commitment",
                value: details.rehearsalCommitment,
              }
            : null,
          { label: "Slots", value: `${data.slotsFilled} / ${data.slotCount} filled` },
        ]}
        closed={closed}
        closedStatus={data.status}
      >
        <Text style={styles.sectionLabel}>Your note (optional)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          placeholder="Links to demos, availability notes, etc."
          placeholderTextColor="#555"
          editable={!submittedEoi && !submitting}
        />
        <SubmitBlock
          submittedEoi={submittedEoi}
          submitting={submitting}
          canSubmit={canSubmit}
          error={error}
          onSubmit={handleSubmit}
          submittedMessage="Interest sent. The band will review and respond."
        />
      </DetailLayout>
    );
  }

  // --- band-for-gig-slot: caller is a band member, pick a band to apply ---
  if (details.kind === "band-for-gig-slot") {
    const candidateBands = allBands.filter((b) =>
      myBandIds.includes(b.id),
    );
    const canSubmit =
      !submittedEoi &&
      !closed &&
      !submitting &&
      selectedBandId !== null &&
      candidateBands.length > 0;
    const handleSubmit = () => {
      if (!canSubmit || selectedBandId === null) return;
      createEoi.mutate({
        requestId: id,
        details: { kind: "band-for-gig-slot", bandId: selectedBandId },
      });
    };
    const heading = data.gig
      ? `Gig slot at ${data.gig.venue.name}`
      : "Band for gig slot";
    const gigDateStr = data.gig
      ? new Date(data.gig.datetime).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "";
    return (
      <DetailLayout
        router={router}
        band={null}
        createdAt={createdAt}
        now={now}
        heading={heading}
        extraRows={[
          gigDateStr ? { label: "Date", value: gigDateStr } : null,
          details.setLength
            ? { label: "Set length", value: `${details.setLength} min` }
            : null,
          details.feeOffered !== undefined
            ? {
                label: "Fee offered",
                value: `$${(details.feeOffered / 100).toFixed(2)}`,
              }
            : null,
          { label: "Slots", value: `${data.slotsFilled} / ${data.slotCount} filled` },
        ]}
        closed={closed}
        closedStatus={data.status}
      >
        <Text style={styles.sectionLabel}>Apply as</Text>
        {candidateBands.length === 0 ? (
          <View style={styles.closedCard}>
            <Text style={styles.closedTitle}>
              You&apos;re not a member of any band yet
            </Text>
            <Text style={styles.closedBody}>
              Join or create a band first to express interest in this slot.
            </Text>
          </View>
        ) : (
          <View style={styles.pickerList}>
            {candidateBands.map((b) => {
              const selected = b.id === selectedBandId;
              return (
                <Pressable
                  key={b.id}
                  onPress={() => setSelectedBandId(b.id)}
                  style={({ pressed }) => [
                    styles.pickerOption,
                    selected && styles.pickerOptionSelected,
                    pressed && styles.pickerOptionPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={styles.pickerOptionText}>{b.name}</Text>
                  {selected && (
                    <Ionicons name="checkmark" size={18} color="#6c63ff" />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
        <SubmitBlock
          submittedEoi={submittedEoi}
          submitting={submitting}
          canSubmit={canSubmit}
          error={error}
          onSubmit={handleSubmit}
          submittedMessage="Application sent. The promoter will review and respond."
        />
      </DetailLayout>
    );
  }

  // --- gig-for-band: caller is a promoter, pick one of their gigs ---------
  if (details.kind === "gig-for-band") {
    const candidateGigs = myGigs.filter((g) => g.openSlots > 0);
    const canSubmit =
      !submittedEoi &&
      !closed &&
      !submitting &&
      selectedGigId !== null &&
      candidateGigs.length > 0;
    const handleSubmit = () => {
      if (!canSubmit || selectedGigId === null) return;
      createEoi.mutate({
        requestId: id,
        details: { kind: "gig-for-band", gigId: selectedGigId },
      });
    };
    const bandName = data.band?.name ?? "Band";
    return (
      <DetailLayout
        router={router}
        band={data.band}
        createdAt={createdAt}
        now={now}
        heading={`${bandName} wants a gig`}
        extraRows={[
          { label: "Target date", value: details.targetDate },
          details.area ? { label: "Area", value: details.area } : null,
          details.feeAsked !== undefined
            ? {
                label: "Fee asked",
                value: `$${(details.feeAsked / 100).toFixed(2)}`,
              }
            : null,
        ]}
        closed={closed}
        closedStatus={data.status}
      >
        <Text style={styles.sectionLabel}>Offer one of your gigs</Text>
        {candidateGigs.length === 0 ? (
          <View style={styles.closedCard}>
            <Text style={styles.closedTitle}>
              No gigs with open slots
            </Text>
            <Text style={styles.closedBody}>
              Create a gig with open slots to offer this band a slot.
            </Text>
          </View>
        ) : (
          <View style={styles.pickerList}>
            {candidateGigs.map((g) => {
              const selected = g.id === selectedGigId;
              const date = new Date(g.datetime).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              return (
                <Pressable
                  key={g.id}
                  onPress={() => setSelectedGigId(g.id)}
                  style={({ pressed }) => [
                    styles.pickerOption,
                    selected && styles.pickerOptionSelected,
                    pressed && styles.pickerOptionPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={styles.pickerOptionText}>
                    {date} • {g.venue.name} • {g.openSlots}/{g.totalSlots} open
                  </Text>
                  {selected && (
                    <Ionicons name="checkmark" size={18} color="#6c63ff" />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
        <SubmitBlock
          submittedEoi={submittedEoi}
          submitting={submitting}
          canSubmit={canSubmit}
          error={error}
          onSubmit={handleSubmit}
          submittedMessage="Offer sent. The band will review and respond."
        />
      </DetailLayout>
    );
  }

  // --- night-at-venue: caller is a venue rep; pick a venue + date ---------
  if (details.kind === "night-at-venue") {
    const canSubmit =
      !submittedEoi &&
      !closed &&
      !submitting &&
      selectedVenueId !== null &&
      pickedDate !== null;
    const handleSubmit = () => {
      if (!canSubmit || selectedVenueId === null || pickedDate === null) return;
      if (details.kind !== "night-at-venue") return;
      createEoi.mutate({
        requestId: id,
        details: {
          kind: "night-at-venue",
          venueId: selectedVenueId,
          proposedDate: pickedDate,
        },
      });
    };
    return (
      <DetailLayout
        router={router}
        band={null}
        createdAt={createdAt}
        now={now}
        heading={details.concept}
        extraRows={[
          {
            label: "Possible dates",
            value: details.possibleDates.join(", "),
          },
        ]}
        closed={closed}
        closedStatus={data.status}
      >
        <Text style={styles.sectionLabel}>Pick a date</Text>
        <View style={styles.pickerList}>
          {details.possibleDates.map((d) => {
            const selected = d === pickedDate;
            return (
              <Pressable
                key={d}
                onPress={() => setPickedDate(d)}
                style={({ pressed }) => [
                  styles.pickerOption,
                  selected && styles.pickerOptionSelected,
                  pressed && styles.pickerOptionPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={styles.pickerOptionText}>{d}</Text>
                {selected && (
                  <Ionicons name="checkmark" size={18} color="#6c63ff" />
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Pick a venue</Text>
        {allVenues.length === 0 ? (
          <View style={styles.closedCard}>
            <Text style={styles.closedTitle}>No venues on file</Text>
            <Text style={styles.closedBody}>
              Venues are seeded by the admin — ask a maintainer to add one.
            </Text>
          </View>
        ) : (
          <View style={styles.pickerList}>
            {allVenues.map((v) => {
              const selected = v.id === selectedVenueId;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => setSelectedVenueId(v.id)}
                  style={({ pressed }) => [
                    styles.pickerOption,
                    selected && styles.pickerOptionSelected,
                    pressed && styles.pickerOptionPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={styles.pickerOptionText}>{v.name}</Text>
                  {selected && (
                    <Ionicons name="checkmark" size={18} color="#6c63ff" />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        <SubmitBlock
          submittedEoi={submittedEoi}
          submitting={submitting}
          canSubmit={canSubmit}
          error={error}
          onSubmit={handleSubmit}
          submittedMessage="Offer sent. Acceptance will create a draft gig for you both."
        />
      </DetailLayout>
    );
  }

  // --- promoter-for-venue-night: caller is a promoter --------------------
  if (details.kind === "promoter-for-venue-night") {
    const canSubmit = !submittedEoi && !closed && !submitting;
    const handleSubmit = () => {
      if (!canSubmit) return;
      const concept = conceptOverride.trim();
      createEoi.mutate({
        requestId: id,
        details: {
          kind: "promoter-for-venue-night",
          ...(concept.length > 0 ? { concept } : {}),
        },
      });
    };
    // Resolve venue name from the venues list.
    const venue = allVenues.find((v) => v.id === details.venueId) ?? null;
    const heading = venue
      ? `${venue.name} — free on ${details.proposedDate}`
      : `A venue is free on ${details.proposedDate}`;
    return (
      <DetailLayout
        router={router}
        band={null}
        createdAt={createdAt}
        now={now}
        heading={heading}
        extraRows={[
          details.concept
            ? { label: "Concept", value: details.concept }
            : null,
          venue ? { label: "Venue", value: venue.name } : null,
          { label: "Date", value: details.proposedDate },
        ]}
        closed={closed}
        closedStatus={data.status}
      >
        <Text style={styles.sectionLabel}>Your concept (optional)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={conceptOverride}
          onChangeText={setConceptOverride}
          multiline
          numberOfLines={3}
          placeholder="What kind of night would you run here?"
          placeholderTextColor="#555"
          editable={!submittedEoi && !submitting}
        />
        <SubmitBlock
          submittedEoi={submittedEoi}
          submitting={submitting}
          canSubmit={canSubmit}
          error={error}
          onSubmit={handleSubmit}
          submittedMessage="Offer sent. Acceptance will create a draft gig for you."
        />
      </DetailLayout>
    );
  }

  // --- band-for-musician: caller is a band member, pick one of their bands
  if (details.kind === "band-for-musician") {
    const candidateBands = allBands.filter((b) => myBandIds.includes(b.id));
    const canSubmit =
      !submittedEoi &&
      !closed &&
      !submitting &&
      selectedBandId !== null &&
      candidateBands.length > 0;
    const handleSubmit = () => {
      if (!canSubmit || selectedBandId === null) return;
      createEoi.mutate({
        requestId: id,
        details: { kind: "band-for-musician", bandId: selectedBandId },
      });
    };
    return (
      <DetailLayout
        router={router}
        band={null}
        createdAt={createdAt}
        now={now}
        heading={`Musician looking for a band — ${details.instrument}`}
        extraRows={[
          details.availability
            ? { label: "Availability", value: details.availability }
            : null,
          details.demosUrl ? { label: "Demos", value: details.demosUrl } : null,
        ]}
        closed={closed}
        closedStatus={data.status}
      >
        <Text style={styles.sectionLabel}>Offer one of your bands</Text>
        {candidateBands.length === 0 ? (
          <View style={styles.closedCard}>
            <Text style={styles.closedTitle}>
              You&apos;re not a member of any band yet
            </Text>
            <Text style={styles.closedBody}>
              Join or create a band first to offer this musician a slot.
            </Text>
          </View>
        ) : (
          <View style={styles.pickerList}>
            {candidateBands.map((b) => {
              const selected = b.id === selectedBandId;
              return (
                <Pressable
                  key={b.id}
                  onPress={() => setSelectedBandId(b.id)}
                  style={({ pressed }) => [
                    styles.pickerOption,
                    selected && styles.pickerOptionSelected,
                    pressed && styles.pickerOptionPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={styles.pickerOptionText}>{b.name}</Text>
                  {selected && (
                    <Ionicons name="checkmark" size={18} color="#6c63ff" />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
        <SubmitBlock
          submittedEoi={submittedEoi}
          submitting={submitting}
          canSubmit={canSubmit}
          error={error}
          onSubmit={handleSubmit}
          submittedMessage="Offer sent. The musician will review and respond."
        />
      </DetailLayout>
    );
  }

  return <RequestNotFound />;
}

// --- Shared layout pieces for the three kinds ----------------------------

interface DetailLayoutProps {
  router: ReturnType<typeof useRouter>;
  band: { name: string; imageUrl: string | null } | null;
  createdAt: Date;
  now: Date;
  heading: string;
  extraRows: ({ label: string; value: string } | null)[];
  closed: boolean;
  closedStatus: string;
  children: ReactNode;
}

function DetailLayout({
  router,
  band,
  createdAt,
  now,
  heading,
  extraRows,
  closed,
  closedStatus,
  children,
}: DetailLayoutProps) {
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
      </View>

      {band && (
        <View style={styles.bandCard}>
          <Image
            source={{ uri: band.imageUrl ?? undefined }}
            style={styles.bandImage}
          />
          <View style={styles.bandCardBody}>
            <Text style={styles.bandName} numberOfLines={1}>
              {band.name}
            </Text>
            <Text style={styles.subtitle}>
              Posted {formatRelative(createdAt, now)}
            </Text>
          </View>
        </View>
      )}

      <Text style={styles.sectionLabel}>
        {band ? "Looking for" : "Details"}
      </Text>
      <View style={styles.detailsCard}>
        <Text style={styles.detailsHeading}>{heading}</Text>
        {extraRows
          .filter((r): r is { label: string; value: string } => r !== null)
          .map((r, i) => (
            <DetailRow key={`${r.label}-${i}`} label={r.label} value={r.value} />
          ))}
      </View>

      {closed ? (
        <View style={styles.closedCard}>
          <Text style={styles.closedTitle}>This request is {closedStatus}.</Text>
          <Text style={styles.closedBody}>
            The poster is no longer accepting expressions of interest.
          </Text>
        </View>
      ) : (
        children
      )}
    </ScrollView>
  );
}

function SubmitBlock(props: {
  submittedEoi: boolean;
  submitting: boolean;
  canSubmit: boolean;
  error: string | null;
  onSubmit: () => void;
  submittedMessage: string;
}) {
  return (
    <>
      {props.submittedEoi && (
        <View style={styles.successCard} accessibilityRole="alert">
          <Ionicons name="checkmark-circle" size={18} color="#3fa66a" />
          <Text style={styles.successText}>{props.submittedMessage}</Text>
        </View>
      )}

      {props.error && !props.submittedEoi && (
        <Text style={styles.error} accessibilityRole="alert">
          {props.error}
        </Text>
      )}

      <TouchableOpacity
        onPress={props.onSubmit}
        disabled={!props.canSubmit}
        activeOpacity={0.85}
        style={[styles.button, !props.canSubmit && styles.buttonDisabled]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !props.canSubmit, busy: props.submitting }}
      >
        {props.submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {props.submittedEoi ? "Interest sent" : "Express interest"}
          </Text>
        )}
      </TouchableOpacity>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailsRow}>
      <Text style={styles.detailsLabel}>{label}</Text>
      <Text style={styles.detailsValue}>{value}</Text>
    </View>
  );
}

function RequestNotFound() {
  const router = useRouter();
  return (
    <SafeAreaView
      style={styles.container}
      edges={["left", "right", "top", "bottom"]}
    >
      <View style={styles.notFoundWrap}>
        <Text style={styles.notFoundText}>Request not found</Text>
        <Pressable
          onPress={() => router.back()}
          style={styles.notFoundBtn}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f11" },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 48 },
  header: {
    flexDirection: "row",
    alignItems: "center",
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
  bandCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1f",
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    gap: 14,
  },
  bandImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: "#0f0f11",
  },
  bandCardBody: { flex: 1 },
  bandName: { color: "#fff", fontSize: 20, fontWeight: "700" },
  subtitle: { color: "#7a7a85", fontSize: 13, marginTop: 4 },
  sectionLabel: {
    color: "#7a7a85",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 8,
  },
  detailsCard: {
    backgroundColor: "#1a1a1f",
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  detailsHeading: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  detailsRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  detailsLabel: { color: "#7a7a85", fontSize: 13 },
  detailsValue: {
    color: "#c8c8d0",
    fontSize: 14,
    flexShrink: 1,
    textAlign: "right",
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
  multiline: { minHeight: 96, textAlignVertical: "top" },
  error: { color: "#ff6b6b", fontSize: 14, marginTop: 12 },
  successCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(63,166,106,0.12)",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  successText: { color: "#c8c8d0", fontSize: 14, flexShrink: 1 },
  button: {
    backgroundColor: "#6c63ff",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
    minHeight: 48,
    justifyContent: "center",
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  closedCard: {
    marginTop: 24,
    padding: 16,
    backgroundColor: "#1a1a1f",
    borderRadius: 12,
    gap: 6,
  },
  closedTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  closedBody: { color: "#7a7a85", fontSize: 14 },
  pickerList: {
    backgroundColor: "#1a1a1f",
    borderWidth: 1,
    borderColor: "#2a2a30",
    borderRadius: 8,
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
  pickerOptionText: { color: "#fff", fontSize: 16, flexShrink: 1 },
  notFoundWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 20,
  },
  notFoundText: { color: "#7a7a85", fontSize: 16 },
  notFoundBtn: {
    backgroundColor: "#6c63ff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
});
