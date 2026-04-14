import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

// --------------------------------------------------------------------------
// API layer — pure functions, no React. Query functions should always just
// fetch and return; wiring them to cache keys happens at the call site via
// useQuery.
// --------------------------------------------------------------------------

type ITunesTrack = {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl100: string;
  previewUrl?: string;
};

async function searchITunes(term: string): Promise<ITunesTrack[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
    term
  )}&entity=song&limit=25`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { results: ITunesTrack[] };
  return json.results;
}

// Fake backend for the mutation. Fails ~30% of the time so we can see
// onError + rollback. Delay simulates network latency so optimistic updates
// are visible.
async function fakeToggleLike(trackId: number, next: boolean): Promise<void> {
  await new Promise((r) => setTimeout(r, 600));
  if (Math.random() < 0.3) throw new Error("Server refused");
  // Normally you'd POST to /likes or similar. trackId/next would carry the state.
  void trackId;
  void next;
}

// --------------------------------------------------------------------------
// Query keys — conventional to centralise these in one place. A query key
// uniquely identifies a cache entry. Arrays let you express hierarchies:
// ['search'] invalidates all searches, ['search', term] just one.
// --------------------------------------------------------------------------

const keys = {
  search: (term: string) => ["itunes", "search", term] as const,
  likes: () => ["likes"] as const,
};

// --------------------------------------------------------------------------
// Screen
// --------------------------------------------------------------------------

export default function QueryScreen() {
  const [term, setTerm] = useState("Jimi Hendrix");
  const [submittedTerm, setSubmittedTerm] = useState("Jimi Hendrix");

  const query = useQuery({
    queryKey: keys.search(submittedTerm),
    queryFn: () => searchITunes(submittedTerm),
    // `enabled` gates the query. An empty term would hit the API pointlessly.
    enabled: submittedTerm.trim().length > 0,
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.input}
          value={term}
          onChangeText={setTerm}
          placeholder="Search iTunes…"
          placeholderTextColor="#4a4a52"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => setSubmittedTerm(term)}
        />
        <Pressable
          style={styles.searchBtn}
          onPress={() => setSubmittedTerm(term)}
        >
          <Text style={styles.searchBtnText}>Search</Text>
        </Pressable>
      </View>

      <StatusBar query={query} />

      <FlatList
        data={query.data ?? []}
        keyExtractor={(t) => String(t.trackId)}
        renderItem={renderTrack}
        ListEmptyComponent={
          query.isSuccess ? (
            <Text style={styles.empty}>No results for "{submittedTerm}"</Text>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        // Pull-to-refresh wires naturally onto refetch.
        refreshing={query.isFetching && !query.isPending}
        onRefresh={() => query.refetch()}
      />
    </View>
  );
}

// --------------------------------------------------------------------------
// Status bar — reads the distinction between isPending (no data yet) and
// isFetching (background revalidation). Both exist because TanStack Query's
// cache can hold stale-but-usable data while a refetch runs underneath.
// --------------------------------------------------------------------------

function StatusBar({
  query,
}: {
  query: ReturnType<typeof useQuery<ITunesTrack[], Error>>;
}) {
  if (query.isPending) {
    return (
      <View style={styles.status}>
        <ActivityIndicator color="#6c63ff" />
        <Text style={styles.statusText}>Loading (no cached data)…</Text>
      </View>
    );
  }
  if (query.isError) {
    return (
      <View style={[styles.status, styles.statusError]}>
        <Text style={styles.statusText}>Error: {query.error.message}</Text>
        <Pressable style={styles.retryBtn} onPress={() => query.refetch()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  const count = query.data?.length ?? 0;
  return (
    <View style={styles.status}>
      <Text style={styles.statusText}>
        {count} result{count === 1 ? "" : "s"}
        {query.isFetching && " · refetching…"}
        {query.isStale && !query.isFetching && " · stale"}
      </Text>
    </View>
  );
}

// --------------------------------------------------------------------------
// Row — each one owns its own useMutation for the like toggle. Optimistic
// update: we update the cache immediately, and roll it back on error.
// --------------------------------------------------------------------------

const renderTrack: ListRenderItem<ITunesTrack> = ({ item }) => (
  <TrackRow track={item} />
);

function TrackRow({ track }: { track: ITunesTrack }) {
  const qc = useQueryClient();

  // "likes" lives entirely in the query cache — initialised to an empty set
  // via initialData. There's no server for it; we use the cache as our
  // local store because useMutation + invalidation + optimistic updates
  // plug into it for free.
  const { data: likes = new Set<number>() } = useQuery<Set<number>>({
    queryKey: keys.likes(),
    queryFn: () => new Set<number>(),
    initialData: new Set<number>(),
    staleTime: Infinity, // never refetch — pure client cache
  });

  const isLiked = likes.has(track.trackId);

  const toggleLike = useMutation({
    mutationFn: () => fakeToggleLike(track.trackId, !isLiked),
    // onMutate = "optimistic update". Runs BEFORE the mutation fires.
    // Return the previous value so onError can roll back.
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: keys.likes() });
      const previous = qc.getQueryData<Set<number>>(keys.likes());
      qc.setQueryData<Set<number>>(keys.likes(), (old) => {
        const next = new Set(old ?? []);
        if (next.has(track.trackId)) next.delete(track.trackId);
        else next.add(track.trackId);
        return next;
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Roll back to the previous value on error.
      if (context?.previous) {
        qc.setQueryData(keys.likes(), context.previous);
      }
    },
    // onSettled runs after success OR error. Good place for a final
    // invalidation — normally you'd want the server's truth back.
    onSettled: () => {
      // If this were a real backend: qc.invalidateQueries({ queryKey: keys.likes() });
    },
  });

  return (
    <View style={styles.row}>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {track.trackName}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {track.artistName} · {track.collectionName}
        </Text>
      </View>
      <Pressable
        style={[styles.likeBtn, isLiked && styles.likeBtnActive]}
        onPress={() => toggleLike.mutate()}
        disabled={toggleLike.isPending}
      >
        <Text style={styles.likeBtnText}>{isLiked ? "♥" : "♡"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f11" },
  header: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  input: {
    flex: 1,
    backgroundColor: "#1a1a1f",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a2a32",
    color: "#e4e4e7",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchBtn: {
    backgroundColor: "#6c63ff",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  searchBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statusError: { backgroundColor: "#241417" },
  statusText: { color: "#8a8a92", fontSize: 12 },
  retryBtn: {
    marginLeft: "auto",
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#2a2a32",
    borderRadius: 6,
  },
  retryBtnText: { color: "#6c63ff", fontSize: 11, fontWeight: "600" },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#14141a",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#23232b",
  },
  rowBody: { flex: 1, marginRight: 12 },
  rowTitle: { color: "#e4e4e7", fontSize: 13, fontWeight: "600" },
  rowSub: { color: "#8a8a92", fontSize: 11, marginTop: 2 },
  likeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e1e28",
    borderWidth: 1,
    borderColor: "#2a2a32",
  },
  likeBtnActive: {
    backgroundColor: "#4a1f25",
    borderColor: "#9a2a2a",
  },
  likeBtnText: { color: "#e4e4e7", fontSize: 20 },
  empty: {
    color: "#6a6a72",
    fontSize: 13,
    textAlign: "center",
    marginTop: 20,
  },
});
