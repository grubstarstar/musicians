import {
  memo,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { TrackCard } from '../../../components/TrackCard';
import { DATASET, Track } from '../../../lib/tracks';

function filterTracks(query: string): Track[] {
  const q = query.trim().toLowerCase();
  if (!q) return DATASET;
  return DATASET.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.album.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.includes(q)),
  );
}

const Header = memo(function Header() {
  return (
    <>
      <Text style={styles.title}>useDeferredValue</Text>
      <Text style={styles.subtitle}>
        Type into the box. The TextInput owns the urgent{' '}
        <Text style={styles.code}>query</Text> state — every keystroke
        re-renders the input instantly. <Text style={styles.code}>Results</Text>{' '}
        reads <Text style={styles.code}>deferredQuery</Text>, which lags a
        render behind when React is busy.
      </Text>
    </>
  );
});

const Notes = memo(function Notes() {
  return (
    <View style={styles.notes}>
      <Text style={styles.notesHeader}>Why this is realistic</Text>
      <Text style={styles.notesItem}>
        • The filter itself (String.includes) is{' '}
        <Text style={styles.bold}>fast</Text>. The cost is React reconciling
        many <Text style={styles.code}>TrackCard</Text> components. That's
        the real bottleneck in search-as-you-type UIs.
      </Text>
      <Text style={styles.notesItem}>
        • Broad queries (one letter) match hundreds of tracks → slow
        render. Narrow queries match few → fast. Type quickly through "a" →
        "ar" → "arc" and watch the stale indicator.
      </Text>
      <Text style={styles.notesItem}>
        • Rule of thumb: <Text style={styles.code}>useTransition</Text> when
        you own the setter, <Text style={styles.code}>useDeferredValue</Text>{' '}
        when you only receive the value (e.g. as a prop).
      </Text>
    </View>
  );
});

const Results = memo(function Results({ query }: { query: string }) {
  const matches = useMemo(() => filterTracks(query), [query]);
  return (
    <View style={styles.panel}>
      <Text style={styles.panelHeader}>
        {matches.length} match{matches.length === 1 ? '' : 'es'}
      </Text>
      {matches.map((t) => (
        <TrackCard key={t.id} track={t} />
      ))}
    </View>
  );
});

export default function DeferredDemo() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  const [lastListCommitMs, setLastListCommitMs] = useState<number | null>(null);
  const keystrokeStart = useRef<number | null>(null);

  useEffect(() => {
    if (keystrokeStart.current !== null) {
      setLastListCommitMs(performance.now() - keystrokeStart.current);
      keystrokeStart.current = null;
    }
  }, [deferredQuery]);

  const onChangeText = (next: string) => {
    if (keystrokeStart.current === null) {
      keystrokeStart.current = performance.now();
    }
    setQuery(next);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Header />

      <TextInput
        style={styles.input}
        value={query}
        onChangeText={onChangeText}
        placeholder="Search titles, artists, albums, tags…"
        placeholderTextColor="#5a5a62"
        autoCorrect={false}
        autoCapitalize="none"
      />

      <View style={styles.statsCard}>
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>Typed</Text>
          <Text style={styles.statsValue}>{query || '—'}</Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>Filtered on</Text>
          <Text style={styles.statsValue}>
            {deferredQuery || '—'}
            {isStale ? ' ⟳' : ''}
          </Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>List commit</Text>
          <Text style={styles.statsValue}>
            {lastListCommitMs !== null
              ? `${lastListCommitMs.toFixed(0)} ms`
              : '—'}
          </Text>
        </View>
      </View>

      <Text style={styles.hint}>
        {isStale ? '⟳ List is catching up…' : '✓ In sync'}
      </Text>

      <View style={isStale ? styles.stale : undefined}>
        <Results query={deferredQuery} />
      </View>

      <Notes />
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
  bold: { color: '#e4e4e7', fontWeight: '700' },
  code: {
    fontFamily: 'Courier',
    color: '#e4e4e7',
    backgroundColor: '#14141a',
  },
  input: {
    backgroundColor: '#1a1a1f',
    borderWidth: 1,
    borderColor: '#2a2a32',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  statsCard: {
    backgroundColor: '#14141a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a32',
    padding: 12,
    marginBottom: 8,
    gap: 4,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statsLabel: { color: '#8a8a92', fontSize: 12 },
  statsValue: { color: '#e4e4e7', fontSize: 12, fontWeight: '600' },
  hint: { color: '#8a8a92', fontSize: 12, marginBottom: 8 },
  stale: { opacity: 0.4 },
  panel: {
    backgroundColor: '#1a1a1f',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  panelHeader: {
    color: '#6c63ff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  notes: {
    marginTop: 16,
    backgroundColor: '#14141a',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a32',
  },
  notesHeader: {
    color: '#6c63ff',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  notesItem: {
    color: '#8a8a92',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
});
