import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useAuth } from '../lib/auth';

export default function About() {
  const { signOut } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>About</Text>
      <Text style={styles.body}>
        This screen lives at <Text style={styles.code}>app/about.tsx</Text> — a
        sibling of the <Text style={styles.code}>(tabs)</Text> group, NOT inside
        it.
      </Text>
      <Text style={styles.body}>
        Notice the tab bar is gone. That&apos;s because this route isn&apos;t
        wrapped by <Text style={styles.code}>(tabs)/_layout.tsx</Text>. It was
        pushed directly onto the root Stack, so the tabs are sitting underneath
        it in the stack, still mounted, waiting for you to press back.
      </Text>
      <Text style={styles.body}>
        The header + back button you see at the top comes from the root
        <Text style={styles.code}> {'<Stack />'} </Text>
        navigator. That stack wouldn&apos;t exist if the root layout used
        <Text style={styles.code}> {'<Slot />'} </Text>
        instead — there&apos;d be nowhere for this screen to push onto, and
        navigating here would replace the tabs entirely.
      </Text>

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
        <Text style={styles.signOutHint}>
          Bounces you back to /login via useProtectedRoute — from outside the
          tabs, proving the hook works wherever you are in the tree.
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f11' },
  content: { padding: 24, paddingBottom: 48 },
  title: {
    color: '#6c63ff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  body: {
    color: '#e4e4e7',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  code: {
    fontFamily: 'Courier',
    color: '#ffb86b',
    fontSize: 13,
  },
  signOutButton: {
    backgroundColor: '#1a1a1f',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ff6b6b',
    padding: 16,
    marginTop: 12,
  },
  signOutText: {
    color: '#ff6b6b',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  signOutHint: {
    color: '#8a8a92',
    fontSize: 12,
    lineHeight: 16,
  },
});
