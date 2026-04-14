import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

// RN's biggest styling surprise vs web: flexDirection defaults to 'column',
// not 'row'. Web CSS is row-by-default; RN flipped it because vertical
// stacks are the more common mobile case. Miss this and your first layouts
// look bizarrely stacked when you expected side-by-side.

export default function LayoutScreen() {
  return (
    // SafeAreaProvider is required for useSafeAreaInsets to return real
    // values. Expo Router's native-stack handles a lot of safe-area stuff
    // automatically, but the hook itself still needs a provider in the tree.
    // Wrapping here keeps the example self-contained.
    <SafeAreaProvider>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <FlexDirectionDemo />
        <FlexSharingDemo />
        <PlatformDemo />
        <DimensionsDemo />
        <SafeAreaDemo />
        <FileExtensionsNote />
      </ScrollView>
    </SafeAreaProvider>
  );
}

// ---- 1. Flex direction (column default) ----

function FlexDirectionDemo() {
  const [direction, setDirection] = useState<'column' | 'row'>('column');
  return (
    <Section
      title="1. flexDirection defaults to 'column'"
      subtitle="Web CSS is row-first; RN is column-first. Children stack vertically unless you say otherwise."
    >
      <View style={styles.toggleRow}>
        <Toggle
          label="column (default)"
          active={direction === 'column'}
          onPress={() => setDirection('column')}
        />
        <Toggle
          label="row"
          active={direction === 'row'}
          onPress={() => setDirection('row')}
        />
      </View>
      <View
        style={[
          styles.demoBox,
          { flexDirection: direction, height: direction === 'column' ? 180 : 70 },
        ]}
      >
        <View style={[styles.chip, { backgroundColor: '#6c63ff' }]}>
          <Text style={styles.chipText}>A</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: '#f59e0b' }]}>
          <Text style={styles.chipText}>B</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: '#10b981' }]}>
          <Text style={styles.chipText}>C</Text>
        </View>
      </View>
    </Section>
  );
}

// ---- 2. flex: N sharing ----

function FlexSharingDemo() {
  return (
    <Section
      title="2. flex: N distributes remaining space"
      subtitle="flex is a share of the parent's free space, not a fixed size. Three children with flex 1, 2, 1 get 25%, 50%, 25%."
    >
      <View style={[styles.demoBox, { flexDirection: 'row', height: 70 }]}>
        <View style={[styles.flexCell, { flex: 1, backgroundColor: '#6c63ff' }]}>
          <Text style={styles.chipText}>flex: 1</Text>
        </View>
        <View style={[styles.flexCell, { flex: 2, backgroundColor: '#f59e0b' }]}>
          <Text style={styles.chipText}>flex: 2</Text>
        </View>
        <View style={[styles.flexCell, { flex: 1, backgroundColor: '#10b981' }]}>
          <Text style={styles.chipText}>flex: 1</Text>
        </View>
      </View>
      <Text style={styles.footnote}>
        Also note: `flex: 1` on a root container is the standard way to make a
        screen fill the available space. Without it, a View collapses to its
        children's content.
      </Text>
    </Section>
  );
}

// ---- 3. Platform.select / Platform.OS ----

// Platform.select picks a value at runtime based on Platform.OS. You can
// merge it into a style object, or use it for any runtime branching.
// StyleSheet.create accepts either static objects or computed ones.
const platformStyles = StyleSheet.create({
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Platform.select({
      ios: 20, // iOS: fully rounded
      android: 4, // Android: blocky
      default: 8,
    }),
    backgroundColor: Platform.select({
      ios: '#007aff', // iOS system blue
      android: '#6200ee', // Material 2 purple
      default: '#6c63ff',
    }),
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  pillText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});

function PlatformDemo() {
  return (
    <Section
      title="3. Platform.OS & Platform.select"
      subtitle="Runtime branching for platform-specific values. Same source, different look per OS."
    >
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>Platform.OS</Text>
        <Text style={styles.statValue}>{Platform.OS}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>Platform.Version</Text>
        <Text style={styles.statValue}>{String(Platform.Version)}</Text>
      </View>
      <View style={{ alignItems: 'flex-start', marginTop: 10 }}>
        <View style={platformStyles.pill}>
          <Text style={platformStyles.pillText}>Platform-styled pill</Text>
        </View>
      </View>
      <Text style={styles.footnote}>
        On iOS: rounded + iOS blue + shadow. On Android: blocky + Material
        purple + elevation. Shadow vs elevation is the most common
        Platform.select use case.
      </Text>
    </Section>
  );
}

// ---- 4. useWindowDimensions ----

function DimensionsDemo() {
  const { width, height, scale, fontScale } = useWindowDimensions();
  return (
    <Section
      title="4. useWindowDimensions (live)"
      subtitle="Hook that re-renders on rotation / split-view / font-scale change. Prefer this over Dimensions.get('window'), which is a one-shot snapshot."
    >
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>width</Text>
        <Text style={styles.statValue}>{Math.round(width)}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>height</Text>
        <Text style={styles.statValue}>{Math.round(height)}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>scale (DPR)</Text>
        <Text style={styles.statValue}>{scale}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>fontScale</Text>
        <Text style={styles.statValue}>{fontScale}</Text>
      </View>
      <View style={{ marginTop: 10 }}>
        <View style={[styles.widthBar, { width: width * 0.5 }]}>
          <Text style={styles.chipText}>50% of width = {Math.round(width * 0.5)}</Text>
        </View>
      </View>
      <Text style={styles.footnote}>
        Rotate the simulator (Cmd-← / Cmd-→) to watch the numbers update.
        Dimensions.get('window') returns the same values once but never
        updates; useWindowDimensions is the reactive version.
      </Text>
    </Section>
  );
}

// ---- 5. Safe area insets ----

function SafeAreaDemo() {
  const insets = useSafeAreaInsets();
  return (
    <Section
      title="5. useSafeAreaInsets"
      subtitle="The pixels the system claims for notches, Dynamic Island, home indicator, status bar. Apply as padding on whichever container wraps your screen content."
    >
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>top</Text>
        <Text style={styles.statValue}>{insets.top}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>bottom</Text>
        <Text style={styles.statValue}>{insets.bottom}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>left</Text>
        <Text style={styles.statValue}>{insets.left}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>right</Text>
        <Text style={styles.statValue}>{insets.right}</Text>
      </View>
      <Text style={styles.footnote}>
        In Expo Router / react-native-screens, the native-stack header
        handles top inset for you automatically — that's why this screen's
        content doesn't slam into the notch. But a full-bleed screen (no
        header) needs you to apply these insets manually, usually on the
        outermost View. Bottom inset matters on devices with home
        indicators (iPhone X onwards) — footer buttons should sit ABOVE it
        or they're unreachable.
      </Text>
      <Text style={styles.footnote}>
        Alternative: `SafeAreaView` component wraps children and applies
        insets automatically. Useful for simple cases but less flexible
        than reading insets directly.
      </Text>
    </Section>
  );
}

// ---- 6. File extensions note ----

function FileExtensionsNote() {
  return (
    <Section
      title="6. Platform file extensions"
      subtitle="Build-time alternative to Platform.select for whole files."
    >
      <Text style={styles.prose}>
        Metro picks the right file automatically based on suffix:
      </Text>
      <View style={styles.codeBlock}>
        <Text style={styles.code}>Button.tsx       // fallback</Text>
        <Text style={styles.code}>Button.ios.tsx   // iOS only</Text>
        <Text style={styles.code}>Button.android.tsx // Android only</Text>
        <Text style={styles.code}>Button.web.tsx   // React Native Web</Text>
      </View>
      <Text style={styles.footnote}>
        Use file extensions when a whole component diverges per platform
        (native modules, big chunks of platform-specific JSX). Use
        Platform.select inline when it's one style value or a tiny branch.
        Mixing both in the same project is normal.
      </Text>
    </Section>
  );
}

// ---- Building blocks ----

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      {children}
    </View>
  );
}

function Toggle({
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
      onPress={onPress}
      style={[styles.toggle, active && styles.toggleActive]}
    >
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f11' },
  content: { padding: 16, paddingBottom: 48 },
  section: {
    backgroundColor: '#14141a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#23232b',
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: { color: '#e4e4e7', fontSize: 14, fontWeight: '700' },
  sectionSubtitle: {
    color: '#8a8a92',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
    marginBottom: 10,
  },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  toggle: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2a2a32',
    backgroundColor: '#1a1a1f',
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: '#6c63ff', borderColor: '#6c63ff' },
  toggleText: { color: '#8a8a92', fontSize: 11, fontWeight: '600' },
  toggleTextActive: { color: '#fff' },
  demoBox: {
    borderRadius: 8,
    backgroundColor: '#0f0f11',
    borderWidth: 1,
    borderColor: '#23232b',
    padding: 8,
    gap: 8,
  },
  chip: {
    width: 50,
    height: 50,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  flexCell: {
    height: '100%',
    borderRadius: 6,
    marginHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statLabel: { color: '#8a8a92', fontSize: 11 },
  statValue: {
    color: '#e4e4e7',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  widthBar: {
    height: 30,
    backgroundColor: '#6c63ff',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footnote: {
    color: '#6a6a72',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 10,
    fontStyle: 'italic',
  },
  prose: { color: '#8a8a92', fontSize: 11, lineHeight: 16, marginBottom: 8 },
  codeBlock: {
    backgroundColor: '#0f0f11',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#23232b',
  },
  code: {
    color: '#a5b4fc',
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    lineHeight: 16,
  },
});
