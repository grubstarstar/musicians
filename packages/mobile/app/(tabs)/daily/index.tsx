import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Demo = {
  href:
    | '/daily/lists'
    | '/daily/memo'
    | '/daily/forms'
    | '/daily/query'
    | '/daily/state'
    | '/daily/slow-mount'
    | '/daily/images'
    | '/daily/layout'
    | '/daily/reanimated';
  title: string;
  hook: string;
  blurb: string;
};

const DEMOS: Demo[] = [
  {
    href: '/daily/lists',
    title: 'Lists & virtualization',
    hook: 'FlatList vs ScrollView+map',
    blurb:
      'Mount-counter demo. Toggle between rendering 240 rows in a ScrollView (every row mounts immediately) and a FlatList (only rows in the viewport mount). Watch the counter and feel the scroll.',
  },
  {
    href: '/daily/memo',
    title: 'memo / useMemo / useCallback',
    hook: 'Identity is everything',
    blurb:
      'Parent ticks once a second. Four memo\u2019d children — two with stable props (frozen at 1 render), two broken by inline arrow / inline style (climb forever). Toggle between broken and fixed and watch the counters.',
  },
  {
    href: '/daily/forms',
    title: 'Forms & keyboard',
    hook: 'TextInput, focus chain, RHF',
    blurb:
      'Vanilla controlled form vs react-hook-form. KeyboardAvoidingView, dismiss-on-tap, focus chaining via refs, returnKeyType. Same three fields, two styles.',
  },
  {
    href: '/daily/query',
    title: 'TanStack Query',
    hook: 'useQuery + useMutation',
    blurb:
      'Search iTunes, pull-to-refresh, optimistic "like" mutation with rollback on error. Loading / fetching / stale / error states visible.',
  },
  {
    href: '/daily/state',
    title: 'State management',
    hook: 'Zustand vs Context',
    blurb:
      'Three slices, three subscribers. Zustand selectors re-render only the slice that changed. Naive Context re-renders every consumer on every change. Watch the counters.',
  },
  {
    href: '/daily/slow-mount',
    title: 'JS thread blocking',
    hook: 'sync vs chunked',
    blurb:
      '600ms of busy work, two ways: one big blocking loop, or 16ms slices with setTimeout(0) between them. Live heartbeat freezes on the first, keeps ticking on the second. The core principle every concurrent technique rests on.',
  },
  {
    href: '/daily/images',
    title: 'Images & expo-image',
    hook: 'RN Image vs expo-image',
    blurb:
      'A list of 60 covers, rendered with plain <Image> or expo-image. Remount to feel the cache — expo-image hits disk instantly, RN Image usually re-fetches. Blurhash placeholders, fade-in transitions, cache controls.',
  },
  {
    href: '/daily/layout',
    title: 'Styling, layout & platform',
    hook: 'flex + Platform + dimensions',
    blurb:
      'The RN styling surprises: flexDirection defaults to column, flex distributes free space, Platform.select + Platform.OS, useWindowDimensions vs Dimensions.get, safe-area insets, .ios/.android file extensions.',
  },
  {
    href: '/daily/reanimated',
    title: 'Reanimated 3',
    hook: 'shared values + Gesture.Pan',
    blurb:
      'Draggable card powered by useSharedValue + useAnimatedStyle + Gesture.Pan. Spring back on release. Tap "block JS 3s" and keep dragging — proves the gesture + animation pipeline runs on the UI thread, independent of JS.',
  },
];

export default function DailyIndex() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Day-to-day RN</Text>
      <Text style={styles.subtitle}>
        The stuff you actually touch every day shipping features. Less theory,
        more muscle memory.
      </Text>

      {DEMOS.map((demo) => (
        <Link key={demo.href} href={demo.href} asChild>
          <Pressable style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{demo.title}</Text>
              <Text style={styles.cardHook}>{demo.hook}</Text>
            </View>
            <Text style={styles.cardBlurb}>{demo.blurb}</Text>
            <Text style={styles.cardArrow}>Open →</Text>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f11' },
  content: { padding: 24, paddingBottom: 48 },
  title: { color: '#6c63ff', fontSize: 28, fontWeight: '700', marginBottom: 4 },
  subtitle: {
    color: '#8a8a92',
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#1a1a1f',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a32',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  cardHook: {
    color: '#6c63ff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardBlurb: {
    color: '#8a8a92',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  cardArrow: { color: '#6c63ff', fontSize: 12, fontWeight: '600' },
});
