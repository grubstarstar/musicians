import { Stack } from 'expo-router';

export default function DailyLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1a1a1f' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Day 6 · Daily' }} />
      <Stack.Screen name="lists" options={{ title: 'Lists & virtualization' }} />
      <Stack.Screen name="memo" options={{ title: 'memo / useMemo / useCallback' }} />
      <Stack.Screen name="forms" options={{ title: 'Forms & keyboard' }} />
      <Stack.Screen name="query" options={{ title: 'TanStack Query' }} />
      <Stack.Screen name="state" options={{ title: 'State management' }} />
      <Stack.Screen name="slow-mount" options={{ title: 'JS thread blocking' }} />
      <Stack.Screen name="images" options={{ title: 'Images & expo-image' }} />
      <Stack.Screen name="layout" options={{ title: 'Styling, layout & platform' }} />
      <Stack.Screen name="reanimated" options={{ title: 'Reanimated 3' }} />
    </Stack>
  );
}
