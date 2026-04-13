import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const DETAILS: Record<string, { title: string; body: string }> = {
  'file-based': {
    title: 'File-based routing',
    body: 'Each file under app/ becomes a route. app/foo.tsx → /foo. app/bar/baz.tsx → /bar/baz. No JS object of screen registrations — the filesystem IS the navigation graph. Expo Router generates the graph at build time.',
  },
  layouts: {
    title: '_layout.tsx',
    body: 'A layout file wraps every route in its directory and below. Put <Stack />, <Tabs />, or <Drawer /> here. Layouts compose — a single route can be wrapped by multiple layouts on the way down the tree. This screen is wrapped by three: root _layout → (tabs)/_layout → routing/_layout.',
  },
  groups: {
    title: 'Route groups',
    body: 'A directory in parentheses like (tabs) is a ROUTE GROUP. Its sole purpose is to share a layout across a subset of routes WITHOUT adding a segment to the URL. So (tabs)/routing/index.tsx serves the URL /routing, not /(tabs)/routing. Use groups to give siblings a common shell (tab bar, drawer) while keeping URLs clean.',
  },
  dynamic: {
    title: 'Dynamic routes',
    body: 'A filename like [id].tsx matches any value in that segment. /routing/dynamic, /routing/anything, /routing/42 all resolve here. The matched value is available via useLocalSearchParams(). The current value for this screen is shown below.',
  },
  link: {
    title: '<Link>',
    body: '<Link href="/routing/dynamic"> is the declarative primitive. It renders a pressable element (by default a Text; use asChild to delegate rendering to a custom component). Think of it as a web <a> tag — but typed and aware of the route tree.',
  },
  router: {
    title: 'useRouter()',
    body: 'The imperative API. router.push(href) adds a screen to the stack. router.back() pops. router.replace(href) swaps the current screen. Use <Link> when you can; useRouter() when you need programmatic navigation (after a form submit, inside an effect, etc).',
  },
  params: {
    title: 'useLocalSearchParams()',
    body: 'Called inside a dynamic route file, returns an object of the matched segments. For app/(tabs)/routing/[id].tsx the return type is { id: string }. Reactive — re-renders when the URL param changes. Prefer this over passing data through navigation state.',
  },
};

export default function ConceptDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const detail = DETAILS[id];

  if (!detail) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Unknown concept: {id}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{detail.title}</Text>
      <Text style={styles.paramBadge}>id param: {id}</Text>
      <Text style={styles.body}>{detail.body}</Text>

      <Pressable style={styles.button} onPress={() => router.back()}>
        <Text style={styles.buttonText}>← router.back()</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f11' },
  content: { padding: 24, paddingBottom: 48 },
  title: { color: '#6c63ff', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  paramBadge: {
    color: '#ffb86b',
    fontSize: 12,
    fontFamily: 'Courier',
    marginBottom: 16,
  },
  body: { color: '#e4e4e7', fontSize: 15, lineHeight: 22, marginBottom: 24 },
  button: {
    backgroundColor: '#1a1a1f',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#6c63ff', fontSize: 14, fontWeight: '600' },
});
