import { Suspense, use, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Track = { id: string; title: string; artist: string; ms: number };

const FAKE_TRACKS: Track[] = [
  { id: '1', title: 'Kind of Blue', artist: 'Miles Davis', ms: 545000 },
  { id: '2', title: 'A Love Supreme', artist: 'John Coltrane', ms: 433000 },
  { id: '3', title: 'Maiden Voyage', artist: 'Herbie Hancock', ms: 313000 },
  { id: '4', title: 'Speak No Evil', artist: 'Wayne Shorter', ms: 297000 },
  { id: '5', title: 'The Black Saint', artist: 'Charles Mingus', ms: 378000 },
];

function fetchTracks(requestId: number): Promise<Track[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(
        FAKE_TRACKS.map((t) => ({
          ...t,
          title: `${t.title} (req ${requestId})`,
        })),
      );
    }, 1500);
  });
}

const promiseCache = new Map<number, Promise<Track[]>>();

function getTracksPromise(requestId: number): Promise<Track[]> {
  let p = promiseCache.get(requestId);
  if (!p) {
    p = fetchTracks(requestId);
    promiseCache.set(requestId, p);
  }
  return p;
}

function TrackList({ requestId }: { requestId: number }) {
  const tracks = use(getTracksPromise(requestId));
  return (
    <View style={styles.panel}>
      {tracks.map((t) => (
        <View key={t.id} style={styles.row}>
          <Text style={styles.rowTitle}>{t.title}</Text>
          <Text style={styles.rowArtist}>
            {t.artist} · {Math.round(t.ms / 1000)}s
          </Text>
        </View>
      ))}
    </View>
  );
}

function Fallback() {
  return (
    <View style={styles.fallback}>
      <ActivityIndicator color="#6c63ff" />
      <Text style={styles.fallbackText}>Loading tracks…</Text>
    </View>
  );
}

export default function SuspenseDemo() {
  const [requestId, setRequestId] = useState(1);

  const refresh = () => {
    setRequestId((id) => id + 1);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Suspense + use()</Text>
      <Text style={styles.subtitle}>
        <Text style={styles.code}>TrackList</Text> calls{' '}
        <Text style={styles.code}>use(promise)</Text>. While the promise is
        pending, React throws it up to the nearest{' '}
        <Text style={styles.code}>{'<Suspense>'}</Text> boundary and renders
        the fallback. When the promise resolves, the subtree re-renders with
        the resolved value.
      </Text>

      <Pressable style={styles.button} onPress={refresh}>
        <Text style={styles.buttonText}>Fetch again (req {requestId + 1})</Text>
      </Pressable>

      <Text style={styles.hint}>
        Each press creates a new promise → a new Suspense fallback cycle.
      </Text>

      <Suspense fallback={<Fallback />}>
        <TrackList requestId={requestId} />
      </Suspense>

      <View style={styles.notes}>
        <Text style={styles.notesHeader}>Things to remember</Text>
        <Text style={styles.notesItem}>
          • <Text style={styles.code}>use()</Text> is React 19. It reads a
          promise (or a context) during render.
        </Text>
        <Text style={styles.notesItem}>
          • The promise must be stable across renders — cache it outside or
          key it by id, otherwise you'd create a new promise every render
          and never resolve.
        </Text>
        <Text style={styles.notesItem}>
          • Suspense boundaries are local. You can nest them so one slow
          panel doesn't take down the whole screen.
        </Text>
        <Text style={styles.notesItem}>
          • In real apps, TanStack Query / Relay / Apollo handle the cache
          for you. <Text style={styles.code}>use()</Text> just removes the
          need for a <Text style={styles.code}>{'{isLoading}'}</Text> ternary.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f11' },
  content: { padding: 24, paddingBottom: 48 },
  title: { color: '#6c63ff', fontSize: 26, fontWeight: '700', marginBottom: 4 },
  subtitle: {
    color: '#8a8a92',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  code: {
    fontFamily: 'Courier',
    color: '#e4e4e7',
    backgroundColor: '#14141a',
  },
  button: {
    backgroundColor: '#6c63ff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  hint: { color: '#8a8a92', fontSize: 12, marginBottom: 16 },
  panel: {
    backgroundColor: '#1a1a1f',
    borderRadius: 10,
    padding: 16,
    gap: 8,
  },
  row: {
    backgroundColor: '#14141a',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  rowArtist: { color: '#8a8a92', fontSize: 12, marginTop: 2 },
  fallback: {
    backgroundColor: '#1a1a1f',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  fallbackText: { color: '#8a8a92', fontSize: 13 },
  notes: {
    marginTop: 20,
    backgroundColor: '#14141a',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a32',
  },
  notesHeader: {
    color: '#6c63ff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  notesItem: {
    color: '#8a8a92',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
});
