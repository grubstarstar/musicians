import { Stack } from 'expo-router';

export default function ConcurrentLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1a1a1f' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Day 3 · React 18' }} />
      <Stack.Screen name="transition" options={{ title: 'useTransition' }} />
      <Stack.Screen name="deferred" options={{ title: 'useDeferredValue' }} />
      <Stack.Screen name="suspense" options={{ title: 'Suspense + use()' }} />
    </Stack>
  );
}
