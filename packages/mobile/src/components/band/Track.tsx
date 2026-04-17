import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { MockTrack } from "../../data/mockBands";

interface TrackProps {
  isActive: boolean;
  playing: boolean;
  track: MockTrack;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Track({ isActive, playing, track }: TrackProps) {
  const player = useAudioPlayer({ uri: track.url });
  const status = useAudioPlayerStatus(player);

  const isPlaying = isActive && status.playing;
  const isLoading =
    isActive && status.isBuffering && !status.playing && !status.isLoaded;

  useEffect(() => {
    if (isActive) {
      if (playing) {
        player.play();
      } else {
        player.pause();
      }
    } else {
      player.pause();
      player.seekTo(0);
    }
  }, [isActive, playing]);

  return (
    <View key={track.id} style={[styles.row, styles.rowBorder]}>
      <View style={styles.trackInfo}>
        <Text
          style={[styles.trackTitle, isActive && styles.trackActive]}
          numberOfLines={1}
        >
          {track.title}
        </Text>
        <Text style={styles.time}>
          {formatTime(status.currentTime)} / {formatTime(status.duration)}
        </Text>
      </View>
      <Text
        style={[
          styles.playButton,
          isLoading && {
            opacity: 0.5,
          },
        ]}
      >
        {isPlaying ? "⏸" : "▶️"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2a2a30",
  },
  trackInfo: { flex: 1, marginLeft: 12 },
  trackTitle: { color: "#fff", fontSize: 15, fontWeight: "500" },
  trackActive: { color: "#6c63ff" },
  time: { color: "#7a7a85", fontSize: 12, marginTop: 2 },
  playButton: { fontSize: 18, marginLeft: 12 },
});
