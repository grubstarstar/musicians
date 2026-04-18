import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Track, type BandTrack } from "./Track";

interface TrackListProps {
  tracks: BandTrack[];
}

export function TrackList({ tracks }: TrackListProps) {
  const [activeTrackId, setActiveTrackId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.list}>
        {tracks.map((track) => {
          const onPress = () => {
            if (activeTrackId === track.id) {
              setIsPlaying((p) => !p);
            } else {
              setActiveTrackId(track.id);
              setIsPlaying(true);
            }
          };
          return (
            <Pressable key={track.id} onPress={onPress}>
              <Track
                isActive={activeTrackId === track.id}
                playing={isPlaying}
                track={track}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, marginBottom: 28 },
  list: {
    backgroundColor: "#1a1a1f",
    borderRadius: 12,
    overflow: "hidden",
  },
});
