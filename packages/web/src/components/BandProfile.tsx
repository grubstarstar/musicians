import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MusicPlayer from './MusicPlayer';

interface Member {
  id: number;
  username: string;
  firstName: string | null;
  lastName: string | null;
}

interface Track {
  id: number;
  title: string;
  url: string;
  position: number;
}

interface BandProfile {
  id: number;
  name: string;
  imageUrl: string | null;
  members: Member[];
  tracks: Track[];
}

function displayName(user: Member) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return full || user.username;
}

interface Props {
  bandId: number;
}

export default function BandProfile({ bandId }: Props) {
  const navigate = useNavigate();
  const [band, setBand] = useState<BandProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/bands/${bandId}`)
      .then((r) => r.json())
      .then((data) => setBand(data))
      .finally(() => setLoading(false));
  }, [bandId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!band) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/')}
        sx={{ alignSelf: 'flex-start' }}
      >
        Back to bands
      </Button>

      {/* Hero image */}
      {band.imageUrl && (
        <Box
          component="img"
          src={band.imageUrl}
          alt={band.name}
          sx={{
            width: '100%',
            maxHeight: 300,
            objectFit: 'cover',
            borderRadius: 2,
          }}
        />
      )}

      <Typography variant="h4" fontWeight={700}>
        {band.name}
      </Typography>

      {/* Members */}
      <Box>
        <Typography variant="overline" color="text.secondary" display="block" mb={1}>
          Members
        </Typography>
        {band.members.length === 0 ? (
          <Typography variant="body2" color="text.disabled">
            No members yet
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {band.members.map((m) => (
              <Chip key={m.id} label={displayName(m)} variant="outlined" />
            ))}
          </Box>
        )}
      </Box>

      {/* Music player */}
      {band.tracks.length > 0 && (
        <Box>
          <Typography variant="overline" color="text.secondary" display="block" mb={1}>
            Tracks
          </Typography>
          <MusicPlayer tracks={band.tracks} />
        </Box>
      )}
    </Box>
  );
}
