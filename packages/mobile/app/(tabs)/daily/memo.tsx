import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

// --------------------------------------------------------------------------
// Stable refs at module scope. These identities never change across renders,
// which is the whole point of the demo — `memo` children only skip re-renders
// when their prop identities are stable.
// --------------------------------------------------------------------------
const STABLE_STYLE: ViewStyle = { opacity: 1 };

// --------------------------------------------------------------------------
// Four children. Each one increments a ref during render so its displayed
// count === "times this component has actually rendered".
// --------------------------------------------------------------------------

function Unmemoised() {
  const count = useRef(0);
  count.current += 1;
  return (
    <Card
      title="Unmemoised"
      subtitle="Re-renders with parent on every tick."
      count={count.current}
      tone="bad"
    />
  );
}

const MemoisedNoProps = memo(function MemoisedNoProps() {
  const count = useRef(0);
  count.current += 1;
  return (
    <Card
      title="memo, no props"
      subtitle="Zero props → identity trivially stable → renders exactly once."
      count={count.current}
      tone="good"
    />
  );
});

type WithHandlerProps = { onPress: () => void };
const MemoisedWithHandler = memo(function MemoisedWithHandler({
  onPress,
}: WithHandlerProps) {
  const count = useRef(0);
  count.current += 1;
  return (
    <Card
      title="memo + onPress prop"
      subtitle="If parent passes () => {} inline, identity changes every tick → memo bypassed."
      count={count.current}
      onPress={onPress}
    />
  );
});

type WithStyleProps = { style: ViewStyle };
const MemoisedWithStyle = memo(function MemoisedWithStyle({
  style,
}: WithStyleProps) {
  const count = useRef(0);
  count.current += 1;
  return (
    <Card
      title="memo + style prop"
      subtitle="Inline { opacity: 1 } is a new object every render — same trap, different shape."
      count={count.current}
      style={style}
    />
  );
});

// --------------------------------------------------------------------------
// Screen
// --------------------------------------------------------------------------

export default function MemoScreen() {
  const [tick, setTick] = useState(0);
  const [stable, setStable] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Stable handler via useCallback. Empty deps → created once, reused forever.
  const stableHandler = useCallback(() => {}, []);

  // When the user toggles "fix / break props", bump keys so render counters
  // reset. Otherwise you'd stare at counts already in the hundreds.
  const generation = stable ? 'stable' : 'unstable';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Parent tick</Text>
        <Text style={styles.headerValue}>{tick}</Text>
      </View>
      <Text style={styles.intro}>
        The parent re-renders once a second. Watch each child's own render
        counter. memo only pays off when props are{' '}
        <Text style={styles.accent}>referentially stable</Text>.
      </Text>

      <Pressable
        style={[styles.toggle, stable && styles.toggleOn]}
        onPress={() => setStable((s) => !s)}
      >
        <Text style={[styles.toggleText, stable && styles.toggleTextOn]}>
          {stable ? '✓ Props are stable' : 'Fix the broken props'}
        </Text>
        <Text style={styles.toggleHint}>
          {stable
            ? 'useCallback + module-scope style'
            : 'inline () => {} and { opacity: 1 }'}
        </Text>
      </Pressable>

      <Unmemoised key={`u-${generation}-${tick % 1}`} />
      <MemoisedNoProps key={`n-${generation}`} />
      <MemoisedWithHandler
        key={`h-${generation}`}
        onPress={stable ? stableHandler : () => {}}
      />
      <MemoisedWithStyle
        key={`s-${generation}`}
        style={stable ? STABLE_STYLE : { opacity: 1 }}
      />

      <Text style={styles.sectionTitle}>useMemo — caching expensive values</Text>
      <Text style={styles.intro}>
        Same parent tick. Two children do the same fake-expensive work; one
        wraps it in useMemo keyed on its own input.
      </Text>

      <HeavyNoUseMemo input="A" />
      <HeavyWithUseMemo input="A" />
    </ScrollView>
  );
}

// --------------------------------------------------------------------------
// useMemo demo — both children always re-render (they receive `tick`), but
// only the memoised one caches the heavy computation across renders.
// --------------------------------------------------------------------------

function heavyCompute(input: string): string {
  let x = 0;
  for (let i = 0; i < 500_000; i++) x += Math.sqrt(i + input.charCodeAt(0));
  return x.toFixed(0);
}

function HeavyNoUseMemo({ input }: { input: string }) {
  const renders = useRef(0);
  renders.current += 1;
  const computes = useRef(0);
  computes.current += 1;
  const result = heavyCompute(input);
  return (
    <HeavyCard
      title="No useMemo"
      renders={renders.current}
      computes={computes.current}
      result={result}
      tone="bad"
    />
  );
}

function HeavyWithUseMemo({ input }: { input: string }) {
  const renders = useRef(0);
  renders.current += 1;
  const computes = useRef(0);
  const result = useMemo(() => {
    computes.current += 1;
    return heavyCompute(input);
  }, [input]);
  return (
    <HeavyCard
      title="useMemo([input])"
      renders={renders.current}
      computes={computes.current}
      result={result}
      tone="good"
    />
  );
}

// --------------------------------------------------------------------------
// Presentational cards
// --------------------------------------------------------------------------

type CardProps = {
  title: string;
  subtitle: string;
  count: number;
  tone?: 'good' | 'bad';
  onPress?: () => void;
  style?: ViewStyle;
};

function Card({ title, subtitle, count, tone, onPress, style }: CardProps) {
  // Tone is derived from `count`, not passed explicitly, so the bad variants
  // turn red once they've rendered more than once.
  const effectiveTone = tone ?? (count > 1 ? 'bad' : 'good');
  return (
    <View
      style={[
        styles.card,
        effectiveTone === 'good' ? styles.cardGood : styles.cardBad,
        style,
      ]}
    >
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View
          style={[
            styles.countPill,
            effectiveTone === 'good'
              ? styles.countPillGood
              : styles.countPillBad,
          ]}
        >
          <Text style={styles.countPillText}>{count}</Text>
        </View>
      </View>
      <Text style={styles.cardSub}>{subtitle}</Text>
      {onPress != null && (
        <Pressable style={styles.cardBtn} onPress={onPress}>
          <Text style={styles.cardBtnText}>(dummy button)</Text>
        </Pressable>
      )}
    </View>
  );
}

function HeavyCard({
  title,
  renders,
  computes,
  result,
  tone,
}: {
  title: string;
  renders: number;
  computes: number;
  result: string;
  tone: 'good' | 'bad';
}) {
  return (
    <View
      style={[
        styles.card,
        tone === 'good' ? styles.cardGood : styles.cardBad,
      ]}
    >
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.heavyRow}>
        <HeavyStat label="Renders" value={renders} />
        <HeavyStat label="Computes" value={computes} />
      </View>
      <Text style={styles.cardSub} numberOfLines={1}>
        result: {result}
      </Text>
    </View>
  );
}

function HeavyStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.heavyStat}>
      <Text style={styles.heavyStatLabel}>{label}</Text>
      <Text style={styles.heavyStatValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f11' },
  content: { padding: 16, paddingBottom: 48 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLabel: {
    color: '#6a6a72',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerValue: { color: '#6c63ff', fontSize: 28, fontWeight: '700' },
  intro: { color: '#8a8a92', fontSize: 13, lineHeight: 18, marginBottom: 12 },
  accent: { color: '#6c63ff', fontWeight: '700' },
  toggle: {
    backgroundColor: '#1a1a1f',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a32',
    padding: 12,
    marginBottom: 16,
  },
  toggleOn: { backgroundColor: '#1e2d1e', borderColor: '#3a7a3a' },
  toggleText: { color: '#e4e4e7', fontSize: 14, fontWeight: '600' },
  toggleTextOn: { color: '#8dd48d' },
  toggleHint: { color: '#6a6a72', fontSize: 11, marginTop: 2 },
  card: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  cardGood: { backgroundColor: '#14141a', borderColor: '#23232b' },
  cardBad: { backgroundColor: '#241417', borderColor: '#4a1f25' },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: { color: '#e4e4e7', fontSize: 14, fontWeight: '600' },
  cardSub: { color: '#8a8a92', fontSize: 11, lineHeight: 16 },
  countPill: {
    minWidth: 32,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillGood: { backgroundColor: '#1f3a1f' },
  countPillBad: { backgroundColor: '#5a1f25' },
  countPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cardBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#2a2a32',
    borderRadius: 6,
  },
  cardBtnText: { color: '#6c63ff', fontSize: 11, fontWeight: '600' },
  sectionTitle: {
    color: '#e4e4e7',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 8,
  },
  heavyRow: { flexDirection: 'row', gap: 12, marginVertical: 8 },
  heavyStat: {
    flex: 1,
    backgroundColor: '#0f0f11',
    borderRadius: 6,
    padding: 8,
  },
  heavyStatLabel: {
    color: '#6a6a72',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  heavyStatValue: {
    color: '#e4e4e7',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
});
