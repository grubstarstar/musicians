import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Demo = {
  href: '/concurrent/transition' | '/concurrent/deferred' | '/concurrent/suspense';
  title: string;
  hook: string;
  blurb: string;
};

const DEMOS: Demo[] = [
  {
    href: '/concurrent/transition',
    title: 'useTransition',
    hook: 'Own the setter',
    blurb:
      'Tab-switch demo. Wrap a state update in startTransition so the old view stays visible (dimmed) while React builds the next one in the background.',
  },
  {
    href: '/concurrent/deferred',
    title: 'useDeferredValue',
    hook: 'Own the value, not the setter',
    blurb:
      'Search-filter demo. TextInput stays fully responsive while an expensive filtered list lags one render behind the typed query.',
  },
  {
    href: '/concurrent/suspense',
    title: 'Suspense + use()',
    hook: 'Throw a promise',
    blurb:
      'React 19 use() hook reads a promise; the nearest <Suspense fallback> catches the thrown promise and renders a spinner until it resolves.',
  },
];

export default function ConcurrentIndex() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>React 18 concurrent</Text>
      <Text style={styles.subtitle}>
        Three primitives, three demos. Each screen is a live example of the
        concept — tap to open.
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
