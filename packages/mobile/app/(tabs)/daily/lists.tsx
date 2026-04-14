import { memo, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  ListRenderItem,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList, ListRenderItem as FlashRenderItem } from '@shopify/flash-list';
import { DATASET, Track, formatDuration } from '../../../lib/tracks';

type Mode = 'scroll' | 'flat' | 'flash';

const ROWS = DATASET.filter((t) => t.genre === 'Jazz'); // 240 rows

const ROW_HEIGHT = 72;

// Module-level counters. Live across re-renders, reset when the screen
// unmounts (Stack screens unmount on back). Three distinct numbers:
//
//   mountedNow   — how many Row components are alive right now
//   everMounted  — total mount events ever (component instances created)
//   renders      — total render passes (mount OR update)
//
// The gap between `everMounted` and `renders` is the whole FlashList story:
// FlatList destroys + recreates Row instances as they leave/enter the window,
// so `everMounted` climbs forever. FlashList keeps a small pool of cells and
// reuses them with new props, so `everMounted` stays flat while `renders`
// climbs — same visual effect, cheaper work.
let mountedNow = 0;
let everMounted = 0;
let renders = 0;

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  listeners.forEach((l) => l());
}
function useMountStats() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { mountedNow, everMounted, renders };
}

const Row = memo(function Row({ track }: { track: Track }) {
  // Fires every render (mount + every update). FlashList reuses cells, so
  // the same Row instance updates with new `track` props as you scroll —
  // that shows up here, but NOT in everMounted.
  useEffect(() => {
    renders += 1;
    notify();
  });

  useEffect(() => {
    mountedNow += 1;
    everMounted += 1;
    notify();
    return () => {
      mountedNow -= 1;
      notify();
    };
  }, []);

  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.rowYear}>{track.year}</Text>
      </View>
      <Text style={styles.rowArtist} numberOfLines={1}>
        {track.artist} · {track.album}
      </Text>
      <View style={styles.rowMeta}>
        <Text style={styles.rowMetaText}>{formatDuration(track.durationSec)}</Text>
        <Text style={styles.rowMetaText}>
          {track.plays.toLocaleString()} plays
        </Text>
        <Text style={styles.rowMetaText}>★ {track.rating.toFixed(1)}</Text>
      </View>
    </View>
  );
});

// Stable refs for FlatList — defining these inline would re-create them
// every parent render and defeat memo on the rows.
const keyExtractor = (t: Track) => t.id;
const renderItem: ListRenderItem<Track> = ({ item }) => <Row track={item} />;
const getItemLayout = (_: ArrayLike<Track> | null | undefined, index: number) => ({
  length: ROW_HEIGHT,
  offset: ROW_HEIGHT * index,
  index,
});

// FlashList's renderItem has the same shape but comes from its own package.
const flashRenderItem: FlashRenderItem<Track> = ({ item }) => <Row track={item} />;

export default function ListsScreen() {
  const [mode, setMode] = useState<Mode>('scroll');
  const stats = useMountStats();
  const mountStartRef = useRef<number>(performance.now());
  const [mountMs, setMountMs] = useState<number | null>(null);

  // When mode changes, time how long it takes for everMounted to plateau
  // (proxy for "all rows mounted"). For ScrollView this jumps to 240 in
  // one tick; for FlatList it stops at ~10–15 (the visible window).
  useEffect(() => {
    everMounted = 0;
    mountedNow = 0;
    renders = 0;
    mountStartRef.current = performance.now();
    setMountMs(null);
    notify();
    const handle = setTimeout(() => {
      setMountMs(Math.round(performance.now() - mountStartRef.current));
    }, 50);
    return () => clearTimeout(handle);
  }, [mode]);

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <ModeButton
          label="ScrollView"
          active={mode === 'scroll'}
          onPress={() => setMode('scroll')}
        />
        <ModeButton
          label="FlatList"
          active={mode === 'flat'}
          onPress={() => setMode('flat')}
        />
        <ModeButton
          label="FlashList"
          active={mode === 'flash'}
          onPress={() => setMode('flash')}
        />
      </View>

      <View style={styles.statsBar}>
        <Stat label="Mounted now" value={stats.mountedNow} of={ROWS.length} />
        <Stat label="Ever mounted" value={stats.everMounted} of={ROWS.length} />
        <Stat label="Renders" value={stats.renders} />
        <Stat label="Settle" value={mountMs ?? '…'} unit="ms" />
      </View>

      <Text style={styles.hint}>{HINTS[mode]}</Text>

      {mode === 'scroll' ? (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {ROWS.map((t) => (
            <Row key={t.id} track={t} />
          ))}
        </ScrollView>
      ) : mode === 'flat' ? (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={ROWS}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews
        />
      ) : (
        // FlashList: no getItemLayout, no windowSize. It measures items and
        // maintains a pool of recyclable cells. In v2 estimatedItemSize is
        // optional — v1 required it. Same renderItem/keyExtractor API.
        <View style={[styles.list, styles.listContent]}>
          <FlashList
            data={ROWS}
            keyExtractor={keyExtractor}
            renderItem={flashRenderItem}
          />
        </View>
      )}
    </View>
  );
}

const HINTS: Record<Mode, string> = {
  scroll:
    'ScrollView + .map(): every row mounts immediately. 240/240. Up-front cost is brutal on large lists — fine for <20 items, a disaster at 10k.',
  flat:
    'FlatList windowing: ~10–15 rows mounted at a time. Scroll and watch "Ever mounted" climb — rows leaving the window UNMOUNT, new rows MOUNT. Each scroll event creates + destroys React component instances.',
  flash:
    'FlashList recycling: similar pool of live rows, but "Ever mounted" barely moves while "Renders" climbs. Cells aren\'t destroyed — they\'re reused with new props. Fewer allocations, less GC pressure, smoother scroll.',
};

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
      onPress={onPress}
      style={[styles.modeBtn, active && styles.modeBtnActive]}
    >
      <Text style={[styles.modeBtnText, active && styles.modeBtnTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Stat({
  label,
  value,
  of,
  unit,
}: {
  label: string;
  value: number | string;
  of?: number;
  unit?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>
        {value}
        {of != null ? ` / ${of}` : ''}
        {unit ? ` ${unit}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f11' },
  controls: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a32',
    backgroundColor: '#1a1a1f',
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: '#6c63ff',
    borderColor: '#6c63ff',
  },
  modeBtnText: { color: '#8a8a92', fontSize: 13, fontWeight: '600' },
  modeBtnTextActive: { color: '#fff' },
  statsBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  stat: {
    flex: 1,
    backgroundColor: '#14141a',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#23232b',
  },
  statLabel: {
    color: '#6a6a72',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: { color: '#e4e4e7', fontSize: 14, fontWeight: '600' },
  hint: {
    color: '#8a8a92',
    fontSize: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
    lineHeight: 16,
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  row: {
    height: ROW_HEIGHT,
    backgroundColor: '#14141a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#23232b',
    justifyContent: 'center',
  },
  rowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  rowTitle: { color: '#e4e4e7', fontSize: 13, fontWeight: '600', flex: 1 },
  rowYear: { color: '#6a6a72', fontSize: 11, marginLeft: 6 },
  rowArtist: { color: '#8a8a92', fontSize: 11, marginBottom: 4 },
  rowMeta: { flexDirection: 'row', gap: 12 },
  rowMetaText: { color: '#6a6a72', fontSize: 10 },
});
