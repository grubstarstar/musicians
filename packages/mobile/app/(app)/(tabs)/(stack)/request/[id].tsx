import { Ionicons } from "@expo/vector-icons";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
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

import { QueryBoundary } from "../../../../../src/components/QueryBoundary";
import { queryClient, trpc } from "../../../../../src/trpc";
import { formatRelative } from "../../../../../src/utils/formatRelative";

/**
 * Request detail + Express Interest screen. Opens when a user taps a row on
 * the Requests tab (MUS-54). Wraps the tRPC suspense reads in QueryBoundary
 * per the project's mobile Suspense pattern.
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

  // The self-authored + already-pending guards are enforced by the server
  // (FORBIDDEN / CONFLICT respectively) and surfaced here via the mutation
  // `onError` handler below — the detail response intentionally does not
  // leak `source_user_id`.
  const requestQueryOptions = trpc.requests.getById.queryOptions({ id });
  const { data } = useSuspenseQuery(requestQueryOptions);

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
  const canSubmit = !submittedEoi && !closed && !submitting;

  function handleSubmit() {
    if (!canSubmit) return;
    const trimmed = notes.trim();
    createEoi.mutate({
      requestId: id,
      details:
        trimmed.length > 0
          ? { kind: "musician-for-band", notes: trimmed }
          : { kind: "musician-for-band" },
    });
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
      </View>

      <View style={styles.bandCard}>
        <Image
          source={{ uri: data.band.imageUrl ?? undefined }}
          style={styles.bandImage}
        />
        <View style={styles.bandCardBody}>
          <Text style={styles.bandName} numberOfLines={1}>
            {data.band.name}
          </Text>
          <Text style={styles.subtitle}>
            Posted {formatRelative(createdAt, now)}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Looking for</Text>
      <View style={styles.detailsCard}>
        <Text style={styles.detailsHeading}>{data.details.instrument}</Text>
        {data.details.style && (
          <DetailRow label="Style" value={data.details.style} />
        )}
        {data.details.rehearsalCommitment && (
          <DetailRow
            label="Rehearsal commitment"
            value={data.details.rehearsalCommitment}
          />
        )}
        <DetailRow
          label="Slots"
          value={`${data.slotsFilled} / ${data.slotCount} filled`}
        />
      </View>

      {closed ? (
        <View style={styles.closedCard}>
          <Text style={styles.closedTitle}>This request is {data.status}.</Text>
          <Text style={styles.closedBody}>
            The band is no longer accepting expressions of interest.
          </Text>
        </View>
      ) : (
        <>
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

          {submittedEoi && (
            <View style={styles.successCard} accessibilityRole="alert">
              <Ionicons name="checkmark-circle" size={18} color="#3fa66a" />
              <Text style={styles.successText}>
                Interest sent. The band will review and respond.
              </Text>
            </View>
          )}

          {error && !submittedEoi && (
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
              <Text style={styles.buttonText}>
                {submittedEoi ? "Interest sent" : "Express interest"}
              </Text>
            )}
          </Pressable>
        </>
      )}
    </ScrollView>
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
