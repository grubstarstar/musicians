import { Image as ExpoImage } from 'expo-image';
import { useState } from 'react';
import {
  FlatList,
  Image as RNImage,
  ListRenderItem,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DATASET, formatDuration } from '../../../lib/tracks';

type Mode = 'rn' | 'expo';

// Picsum returns a deterministic image for a given seed. We key on the
// track id so each row gets a stable, distinct image. Cheap and perfect
// for cache-behaviour demos — expo-image will hit disk on subsequent
// mounts, RN Image will usually refetch from network.
const COVERS = DATASET.slice(0, 60).map((t) => ({
  ...t,
  cover: `https://picsum.photos/seed/${encodeURIComponent(t.id)}/200/200`,
}));

type Row = (typeof COVERS)[number];

// Arbitrary but valid blurhash — a dim, cool-toned gradient. expo-image
// will paint this immediately and fade the real image in on top.
const BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

const keyExtractor = (r: Row) => r.id;

export default function ImagesScreen() {
  const [mode, setMode] = useState<Mode>('rn');
  const [remountKey, setRemountKey] = useState(0);

  const renderItem: ListRenderItem<Row> = ({ item }) => (
    <RowView track={item} mode={mode} />
  );

  const clearCache = async () => {
    // expo-image exposes separate memory + disk cache controls. In real
    // apps you almost never need this — it's here to prove caching
    // exists by wiping it and watching the re-fetch happen.
    await ExpoImage.clearMemoryCache();
    await ExpoImage.clearDiskCache();
    setRemountKey((k) => k + 1);
  };

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <ModeButton
          label="RN <Image>"
          active={mode === 'rn'}
          onPress={() => setMode('rn')}
        />
        <ModeButton
          label="expo-image"
          active={mode === 'expo'}
          onPress={() => setMode('expo')}
        />
      </View>

      <View style={styles.actions}>
        <SmallButton
          label="Remount list"
          onPress={() => setRemountKey((k) => k + 1)}
        />
        <SmallButton label="Clear expo-image cache" onPress={clearCache} />
      </View>

      <Text style={styles.hint}>{HINTS[mode]}</Text>

      <FlatList
        key={`${mode}-${remountKey}`}
        data={COVERS}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        initialNumToRender={8}
        windowSize={5}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

function RowView({ track, mode }: { track: Row; mode: Mode }) {
  return (
    <View style={styles.row}>
      {mode === 'rn' ? (
        // RN's built-in Image: no memory cache control, no disk cache
        // guarantees beyond the OS-level HTTP cache, no placeholder,
        // no fade-in transition. resizeMode is the prop name.
        <RNImage
          source={{ uri: track.cover }}
          style={styles.cover}
          resizeMode="cover"
        />
      ) : (
        // expo-image: SDImage (iOS) + Glide (Android) under the hood.
        // Gives you memory + disk cache, placeholders, blurhash, fade-in
        // transitions, priority hints. contentFit replaces resizeMode
        // (CSS object-fit-style naming).
        <ExpoImage
          source={track.cover}
          style={styles.cover}
          contentFit="cover"
          placeholder={{ blurhash: BLURHASH }}
          transition={200}
          cachePolicy="memory-disk"
          priority="normal"
        />
      )}

      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track.artist} · {track.album}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{formatDuration(track.durationSec)}</Text>
          <Text style={styles.metaText}>★ {track.rating.toFixed(1)}</Text>
        </View>
      </View>
    </View>
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
      onPress={onPress}
      style={[styles.modeBtn, active && styles.modeBtnActive]}
    >
      <Text style={[styles.modeBtnText, active && styles.modeBtnTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SmallButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.smallBtn}>
      <Text style={styles.smallBtnText}>{label}</Text>
    </Pressable>
  );
}

const HINTS: Record<Mode, string> = {
  rn:
    'Plain RN <Image>. No placeholder (rows pop in as each image lands). Remount the list and watch them reload — the OS HTTP cache may help, but there\'s no disk cache you can rely on. No transition, no blurhash, no priority control.',
  expo:
    'expo-image with blurhash placeholder, 200ms fade-in, memory-disk cache. Remount the list — images appear instantly from disk. Clear the cache and remount to see the blurhash + network re-fetch in action. contentFit replaces resizeMode.',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f11' },
  controls: { flexDirection: 'row', gap: 8, padding: 16 },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a32',
    backgroundColor: '#1a1a1f',
    alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: '#6c63ff', borderColor: '#6c63ff' },
  modeBtnText: { color: '#8a8a92', fontSize: 13, fontWeight: '600' },
  modeBtnTextActive: { color: '#fff' },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  smallBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2a2a32',
    backgroundColor: '#14141a',
  },
  smallBtnText: { color: '#e4e4e7', fontSize: 11, fontWeight: '600' },
  hint: {
    color: '#8a8a92',
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    backgroundColor: '#14141a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#23232b',
    alignItems: 'center',
    gap: 12,
  },
  cover: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: '#23232b',
  },
  meta: { flex: 1 },
  title: { color: '#e4e4e7', fontSize: 13, fontWeight: '600' },
  artist: { color: '#8a8a92', fontSize: 11, marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  metaText: { color: '#6a6a72', fontSize: 10 },
});
