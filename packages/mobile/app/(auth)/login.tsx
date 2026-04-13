import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../lib/auth';

export default function Login() {
  const { signIn } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log in</Text>
      <Text style={styles.subtitle}>
        Fake login. No fields, no real check — tap the button and you&apos;re in.
      </Text>
      <Pressable style={styles.button} onPress={signIn}>
        <Text style={styles.buttonText}>Sign in</Text>
      </Pressable>
      <Text style={styles.hint}>
        Because you&apos;re not authenticated, the root layout&apos;s
        useProtectedRoute hook redirected you here. Any attempt to deep-link
        elsewhere will bounce back.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f11',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    color: '#6c63ff',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#8a8a92',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#6c63ff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    color: '#6a6a72',
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
