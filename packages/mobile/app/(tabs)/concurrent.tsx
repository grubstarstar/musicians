import { memo, useMemo, useState, useTransition } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const TABS = ['Alpha', 'Beta', 'Gamma', 'Delta'] as const;
type Tab = (typeof TABS)[number];

const ITEM_COUNT = 8000;
const BUSY_ITER = 1500;

const SlowView = memo(function SlowView({ tab }: { tab: Tab }) {
  const items = useMemo(() => {
    const out: Array<{ id: string; label: string }> = [];
    for (let i = 0; i < ITEM_COUNT; i++) {
      let acc = 0;
      for (let j = 0; j < BUSY_ITER; j++) acc += Math.sqrt(j * 1.7 + i);
      if (acc < 0) break;
      if (i < 60) {
        out.push({
          id: `${tab}-${i}`,
          label: `${tab} · row ${i.toString().padStart(3, '0')}`,
        });
      }
    }
    return out;
  }, [tab]);

  return (
    <View style={styles.panel}>
      <Text style={styles.panelHeader}>{tab.toUpperCase()}</Text>
      {items.map((item) => (
        <View key={item.id} style={styles.row}>
          <Text style={styles.rowText}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
});

type Mode = 'sync' | 'transition';

export default function Concurrent() {
  const [activeTab, setActiveTab] = useState<Tab>('Alpha');
  const [renderedTab, setRenderedTab] = useState<Tab>('Alpha');
  const [mode, setMode] = useState<Mode>('sync');
  const [isPending, startTransition] = useTransition();

  const onSelectTab = (t: Tab) => {
    setActiveTab(t);
    if (mode === 'transition') {
      startTransition(() => setRenderedTab(t));
    } else {
      setRenderedTab(t);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>React 18 Concurrent</Text>
      <Text style={styles.subtitle}>
        Tap a tab below. In Sync, everything freezes until the new view is
        built — even the button highlight is delayed. In Transition, the
        button highlights instantly and the old view stays visible (dimmed)
        while the new one builds in the background.
      </Text>

      <View style={styles.modes}>
        <ModeButton
          label="Sync"
          active={mode === 'sync'}
          onPress={() => setMode('sync')}
        />
        <ModeButton
          label="Transition"
          active={mode === 'transition'}
          onPress={() => setMode('transition')}
        />
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <Pressable
            key={t}
            onPress={() => onSelectTab(t)}
            style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}
          >
            <Text
              style={[
                styles.tabBtnText,
                activeTab === t && styles.tabBtnTextActive,
              ]}
            >
              {t}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>
          {isPending
            ? `⟳ Building ${activeTab}…`
            : `Showing ${renderedTab}`}
        </Text>
      </View>

      <View style={isPending ? styles.panelPending : undefined}>
        <SlowView tab={renderedTab} />
      </View>
    </ScrollView>
  );
}

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
      style={[styles.mode, active && styles.modeActive]}
      onPress={onPress}
    >
      <Text style={[styles.modeText, active && styles.modeTextActive]}>
        {label}
      </Text>
    </Pressable>
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
  modes: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  mode: {
    flex: 1,
    backgroundColor: '#1a1a1f',
    borderWidth: 1,
    borderColor: '#2a2a32',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  modeActive: { borderColor: '#6c63ff', backgroundColor: '#1e1e28' },
  modeText: { color: '#8a8a92', fontSize: 14, fontWeight: '600' },
  modeTextActive: { color: '#6c63ff' },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tabBtn: {
    flex: 1,
    backgroundColor: '#1a1a1f',
    borderWidth: 1,
    borderColor: '#2a2a32',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: '#6c63ff', borderColor: '#6c63ff' },
  tabBtnText: { color: '#8a8a92', fontSize: 13, fontWeight: '600' },
  tabBtnTextActive: { color: '#fff' },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLabel: { color: '#8a8a92', fontSize: 12 },
  panelPending: { opacity: 0.4 },
  panel: {
    backgroundColor: '#1a1a1f',
    borderRadius: 10,
    padding: 16,
    gap: 4,
  },
  panelHeader: {
    color: '#6c63ff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  row: {
    backgroundColor: '#14141a',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  rowText: { color: '#e4e4e7', fontSize: 12 },
});
