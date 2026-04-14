import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Track, formatDuration } from '../lib/tracks';

export const TrackCard = memo(function TrackCard({ track }: { track: Track }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.cardYear}>{track.year}</Text>
      </View>
      <Text style={styles.cardArtist} numberOfLines={1}>
        {track.artist} · {track.album}
      </Text>
      <View style={styles.cardMeta}>
        <Text style={styles.cardMetaText}>
          {formatDuration(track.durationSec)}
        </Text>
        <Text style={styles.cardMetaText}>
          {track.plays.toLocaleString()} plays
        </Text>
        <Text style={styles.cardMetaText}>★ {track.rating.toFixed(1)}</Text>
      </View>
      <View style={styles.tagRow}>
        {track.tags.map((tag) => (
          <View key={tag} style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#14141a',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#23232b',
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  cardTitle: { color: '#e4e4e7', fontSize: 13, fontWeight: '600', flex: 1 },
  cardYear: { color: '#6a6a72', fontSize: 11, marginLeft: 6 },
  cardArtist: { color: '#8a8a92', fontSize: 11, marginBottom: 6 },
  cardMeta: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  cardMetaText: { color: '#6a6a72', fontSize: 10 },
  tagRow: { flexDirection: 'row', gap: 6 },
  tag: {
    backgroundColor: '#1e1e28',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: { color: '#6c63ff', fontSize: 10, fontWeight: '600' },
});
