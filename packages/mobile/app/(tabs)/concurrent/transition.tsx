import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TrackCard } from '../../../components/TrackCard';
import { DATASET, GENRES, Genre, TRACKS_PER_GENRE } from '../../../lib/tracks';

const GenreList = memo(function GenreList({ genre }: { genre: Genre }) {
  const tracks = useMemo(
    () => DATASET.filter((t) => t.genre === genre),
    [genre],
  );
  return (
    <View style={styles.panel}>
      <Text style={styles.panelHeader}>
        {genre.toUpperCase()} · {tracks.length} tracks
      </Text>
      {tracks.map((t) => (
        <TrackCard key={t.id} track={t} />
      ))}
    </View>
  );
});

const Header = memo(function Header() {
  return (
    <>
      <Text style={styles.title}>useTransition</Text>
      <Text style={styles.subtitle}>
        Each tab renders {TRACKS_PER_GENRE} real track cards — no synthetic
        CPU burn. The cost is React reconciling thousands of components.
        Switching genres forces a full re-render of the list.
      </Text>
    </>
  );
});

const Instructions = memo(function Instructions() {
  return (
    <View style={styles.instructions}>
      <Text style={styles.instructionsHeader}>Try this</Text>
      <Text style={styles.instructionsText}>
        1. In <Text style={styles.bold}>Sync</Text> mode, tap any genre.
        UI freezes until the new list is built — button highlight is
        delayed, subsequent taps queue up.
      </Text>
      <Text style={styles.instructionsText}>
        2. Switch to <Text style={styles.bold}>Transition</Text> mode.
        Rapid-tap three genres in a row (e.g. Jazz → Rock → Classical).
      </Text>
      <Text style={styles.instructionsText}>
        3. Every tap highlights the target button instantly. The old list
        stays visible (dimmed). React throws away in-progress renders and
        only commits the final target.
      </Text>
    </View>
  );
});

const Notes = memo(function Notes() {
  return (
    <View style={styles.notes}>
      <Text style={styles.notesHeader}>Why this is realistic</Text>
      <Text style={styles.notesItem}>
        • Work comes from <Text style={styles.bold}>React reconciling
        many real components</Text>, not a fake busy loop. This is what
        real apps actually hit: dashboards, feeds, switching data-heavy
        tabs.
      </Text>
      <Text style={styles.notesItem}>
        • React yields between component renders, so distributed work is{' '}
        <Text style={styles.bold}>interruptible</Text>. Rapid taps in
        Transition mode cancel in-progress trees — "Last commit" shows
        only the final render time.
      </Text>
      <Text style={styles.notesItem}>
        • Committed trees swap{' '}
        <Text style={styles.bold}>atomically</Text>, so you never see a
        half-rendered list. The old list stays on screen until the new
        one is fully ready.
      </Text>
    </View>
  );
});

type GenreTabRowProps = {
  activeGenre: Genre;
  onSelect: (g: Genre) => void;
};

const GenreTabRow = memo(function GenreTabRow({
  activeGenre,
  onSelect,
}: GenreTabRowProps) {
  return (
    <View style={styles.tabRow}>
      {GENRES.map((g) => (
        <Pressable
          key={g}
          onPressIn={() => onSelect(g)}
          style={[styles.tabBtn, activeGenre === g && styles.tabBtnActive]}
        >
          <Text
            style={[
              styles.tabBtnText,
              activeGenre === g && styles.tabBtnTextActive,
            ]}
          >
            {g}
          </Text>
        </Pressable>
      ))}
    </View>
  );
});

type Mode = 'sync' | 'transition';

export default function TransitionDemo() {
  const [activeGenre, setActiveGenre] = useState<Genre>('Jazz');
  const [renderedGenre, setRenderedGenre] = useState<Genre>('Jazz');
  const [mode, setMode] = useState<Mode>('sync');
  const [isPending, startTransition] = useTransition();
  const [tapCount, setTapCount] = useState(0);
  const [lastTabCommitMs, setLastTabCommitMs] = useState<number | null>(null);
  const [lastListCommitMs, setLastListCommitMs] = useState<number | null>(null);

  const tapStart = useRef<number | null>(null);

  useEffect(() => {
    if (tapStart.current !== null) {
      setLastTabCommitMs(performance.now() - tapStart.current);
    }
  }, [activeGenre]);

  useEffect(() => {
    if (tapStart.current !== null) {
      setLastListCommitMs(performance.now() - tapStart.current);
      tapStart.current = null;
    }
  }, [renderedGenre]);

  const onSelectGenre = useCallback(
    (g: Genre) => {
      setTapCount((n) => n + 1);
      tapStart.current = performance.now();
      setActiveGenre(g);
      if (mode === 'transition') {
        startTransition(() => setRenderedGenre(g));
      } else {
        setRenderedGenre(g);
      }
    },
    [mode, startTransition],
  );

  const resetStats = () => {
    setTapCount(0);
    setLastTabCommitMs(null);
    setLastListCommitMs(null);
    tapStart.current = null;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Header />

      <View style={styles.modes}>
        <ModeButton
          label="Sync"
          active={mode === 'sync'}
          onPress={() => {
            setMode('sync');
            resetStats();
          }}
        />
        <ModeButton
          label="Transition"
          active={mode === 'transition'}
          onPress={() => {
            setMode('transition');
            resetStats();
          }}
        />
      </View>

      <Instructions />

      <GenreTabRow activeGenre={activeGenre} onSelect={onSelectGenre} />

      <View style={styles.statsCard}>
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>Target</Text>
          <Text style={styles.statsValue}>{activeGenre}</Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>On screen</Text>
          <Text style={styles.statsValue}>
            {renderedGenre}
            {isPending ? ' ⟳' : ''}
          </Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>Taps</Text>
          <Text style={styles.statsValue}>{tapCount}</Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>Tab commit</Text>
          <Text style={styles.statsValue}>
            {lastTabCommitMs !== null
              ? `${lastTabCommitMs.toFixed(0)} ms`
              : '—'}
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

      <View style={isPending ? styles.panelPending : undefined}>
        <GenreList genre={renderedGenre} />
      </View>

      <Notes />
    </ScrollView>
  );
}

function ModeButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.mode, active && styles.modeActive]}
      onPress={onPress}
    >
      <Text style={[styles.modeText, active && styles.modeTextActive]}>
        {label}
      </Text>
    </Pressable>
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
  modes: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  mode: {
    flex: 1,
    backgroundColor: '#1a1a1f',
    borderWidth: 1,
    borderColor: '#2a2a32',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  modeActive: { borderColor: '#6c63ff', backgroundColor: '#1e1e28' },
  modeText: { color: '#8a8a92', fontSize: 14, fontWeight: '600' },
  modeTextActive: { color: '#6c63ff' },
  instructions: {
    backgroundColor: '#14141a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a32',
    padding: 14,
    marginBottom: 12,
  },
  instructionsHeader: {
    color: '#6c63ff',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  instructionsText: {
    color: '#8a8a92',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tabBtn: {
    flex: 1,
    backgroundColor: '#1a1a1f',
    borderWidth: 1,
    borderColor: '#2a2a32',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: '#6c63ff', borderColor: '#6c63ff' },
  tabBtnText: { color: '#8a8a92', fontSize: 13, fontWeight: '600' },
  tabBtnTextActive: { color: '#fff' },
  statsCard: {
    backgroundColor: '#14141a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a32',
    padding: 12,
    marginBottom: 12,
    gap: 4,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statsLabel: { color: '#8a8a92', fontSize: 12 },
  statsValue: { color: '#e4e4e7', fontSize: 12, fontWeight: '600' },
  panelPending: { opacity: 0.4 },
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
