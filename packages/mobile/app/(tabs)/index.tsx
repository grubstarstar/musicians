import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../lib/auth';

type Day = {
  label: string;
  title: string;
  status: 'done' | 'doing' | 'todo';
  summary: string;
};

const DAYS: Day[] = [
  {
    label: 'Day 1',
    title: 'New Architecture',
    status: 'done',
    summary: 'JSI, Fabric, TurboModules, Codegen — see Architecture tab.',
  },
  {
    label: 'Day 2',
    title: 'Expo Router',
    status: 'done',
    summary: 'File-based routing, layouts, tabs, dynamic routes — see Routing tab.',
  },
  {
    label: 'Day 3',
    title: 'React 18 + Hermes',
    status: 'doing',
    summary: 'Concurrent rendering, useTransition, isPending — see React 18 tab.',
  },
  {
    label: 'Day 4',
    title: 'Ecosystem',
    status: 'todo',
    summary: 'React Navigation v7, NativeWind v4, New Arch compatibility.',
  },
  {
    label: 'Day 5',
    title: 'Perf & Interview',
    status: 'todo',
    summary: 'FlashList vs FlatList, Reanimated 3, common interview Qs.',
  },
];

const STATUS_COLOR: Record<Day['status'], string> = {
  done: '#6bff8c',
  doing: '#ffb86b',
  todo: '#6a6a72',
};

export default function Home() {
  const { signOut } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>RN Revision Playground</Text>
      <Text style={styles.subtitle}>
        One tab per day. Each tab is a live example you can poke at.
      </Text>

      {DAYS.map((day) => (
        <View key={day.label} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>{day.label}</Text>
            <View
              style={[styles.badge, { borderColor: STATUS_COLOR[day.status] }]}
            >
              <Text style={[styles.badgeText, { color: STATUS_COLOR[day.status] }]}>
                {day.status.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.cardTitle}>{day.title}</Text>
          <Text style={styles.cardSummary}>{day.summary}</Text>
        </View>
      ))}

      <Link href="/about" asChild>
        <Pressable style={styles.outsideButton}>
          <Text style={styles.outsideButtonText}>
            Push /about onto the root stack →
          </Text>
          <Text style={styles.outsideButtonHint}>
            Sibling of (tabs), not inside it. The tab bar disappears when pushed.
          </Text>
        </Pressable>
      </Link>

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
        <Text style={styles.signOutHint}>
          Bounces you back to /login via useProtectedRoute.
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f11',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    color: '#6c63ff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: '#8a8a92',
    fontSize: 14,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#1a1a1f',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardLabel: {
    color: '#8a8a92',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardSummary: {
    color: '#8a8a92',
    fontSize: 13,
    lineHeight: 18,
  },
  outsideButton: {
    backgroundColor: '#1a1a1f',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6c63ff',
    padding: 16,
    marginTop: 12,
  },
  outsideButtonText: {
    color: '#6c63ff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  outsideButtonHint: {
    color: '#8a8a92',
    fontSize: 12,
    lineHeight: 16,
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
