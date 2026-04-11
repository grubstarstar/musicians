import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import { formatDuration, getProgress } from '../utils/playerUtils';

interface Track {
  id: number;
  title: string;
  url: string;
  position: number;
}

interface Props {
  tracks: Track[];
}

export default function MusicPlayer({ tracks }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const current = tracks[currentIndex];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration);
    const onEnded = () => {
      if (currentIndex < tracks.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        setPlaying(false);
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
    };
  }, [currentIndex, tracks.length]);

  // Load new src when track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    setCurrentTime(0);
    setDuration(0);
    if (playing) audio.play().catch(() => setPlaying(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  }

  function seekTo(_: Event, value: number | number[]) {
    const audio = audioRef.current;
    if (!audio || !isFinite(audio.duration)) return;
    const pct = Array.isArray(value) ? value[0] : value;
    audio.currentTime = (pct / 100) * audio.duration;
  }

  function selectTrack(index: number) {
    setCurrentIndex(index);
    setPlaying(true);
  }

  if (tracks.length === 0) return null;

  return (
    <Box>
      <audio ref={audioRef} src={current?.url} preload="metadata" />

      {/* Track list */}
      <List dense disablePadding sx={{ mb: 2 }}>
        {tracks.map((track, i) => (
          <ListItemButton
            key={track.id}
            selected={i === currentIndex}
            onClick={() => selectTrack(i)}
            sx={{
              borderRadius: 1,
              mb: 0.5,
              '&.Mui-selected': { bgcolor: 'primary.main', color: 'white' },
              '&.Mui-selected:hover': { bgcolor: 'primary.dark' },
            }}
          >
            <ListItemText
              primary={track.title}
              primaryTypographyProps={{ variant: 'body2' }}
            />
          </ListItemButton>
        ))}
      </List>

      {/* Controls */}
      <Box
        sx={{
          bgcolor: 'background.default',
          borderRadius: 2,
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Typography variant="body2" fontWeight={600} noWrap>
          {current?.title}
        </Typography>

        <Slider
          size="small"
          value={getProgress(currentTime, duration)}
          onChange={seekTo}
          sx={{ color: 'primary.main', py: 0.5 }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">
            {formatDuration(currentTime)}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              size="small"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => i - 1)}
            >
              <SkipPreviousIcon />
            </IconButton>
            <IconButton size="small" onClick={togglePlay} sx={{ mx: 0.5 }}>
              {playing ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
            <IconButton
              size="small"
              disabled={currentIndex === tracks.length - 1}
              onClick={() => setCurrentIndex((i) => i + 1)}
            >
              <SkipNextIcon />
            </IconButton>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {formatDuration(duration)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
