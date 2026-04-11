import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Alert from '@mui/material/Alert';
import CloseIcon from '@mui/icons-material/Close';

interface Member {
  id: number;
  username: string;
  firstName: string | null;
  lastName: string | null;
}

interface Band {
  id: number;
  name: string;
  members: Member[];
}


function displayName(user: Member) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return full || user.username;
}

export default function BandsManager() {
  const navigate = useNavigate();
  const [bands, setBands] = useState<Band[]>([]);
  const [users, setUsers] = useState<Member[]>([]);
  const [newBandName, setNewBandName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function fetchData() {
    const [bandsRes, usersRes] = await Promise.all([
      fetch('/api/bands'),
      fetch('/api/users'),
    ]);
    if (bandsRes.ok) setBands(await bandsRes.json());
    if (usersRes.ok) setUsers(await usersRes.json());
  }

  useEffect(() => { fetchData(); }, []);

  async function createBand(e: React.FormEvent) {
    e.preventDefault();
    if (!newBandName.trim()) return;
    setCreating(true);
    setError('');
    const res = await fetch('/api/bands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newBandName.trim() }),
    });
    if (res.ok) {
      setNewBandName('');
      await fetchData();
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to create band');
    }
    setCreating(false);
  }

  async function deleteBand(bandId: number) {
    await fetch(`/api/bands/${bandId}`, { method: 'DELETE' });
    await fetchData();
  }

  async function addMember(bandId: number, userId: number) {
    await fetch(`/api/bands/${bandId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    await fetchData();
  }

  async function removeMember(bandId: number, userId: number) {
    await fetch(`/api/bands/${bandId}/members/${userId}`, { method: 'DELETE' });
    await fetchData();
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header: title + create form */}
      <Box>
        <Typography variant="h6" fontWeight={600} mb={1.5}>
          Bands
        </Typography>
        <Box
          component="form"
          onSubmit={createBand}
          sx={{ display: 'flex', gap: 1 }}
        >
          <TextField
            placeholder="New band name…"
            value={newBandName}
            onChange={(e) => setNewBandName(e.target.value)}
            disabled={creating}
            size="small"
            sx={{ flex: 1 }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={creating || !newBandName.trim()}
            sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {creating ? 'Adding…' : 'Add band'}
          </Button>
        </Box>
        {error && (
          <Alert severity="error" sx={{ mt: 1, py: 0.5 }}>
            {error}
          </Alert>
        )}
      </Box>

      {/* Band list */}
      {bands.length === 0 ? (
        <Typography variant="body2" color="text.disabled">
          No bands yet. Create one above.
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 2,
          }}
        >
          {bands.map((band) => {
            const memberIds = new Set(band.members.map((m) => m.id));
            const available = users.filter((u) => !memberIds.has(u.id));

            return (
              <Card
                key={band.id}
                variant="outlined"
                sx={{ bgcolor: 'background.paper' }}
              >
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, '&:last-child': { pb: 2 } }}>
                  {/* Band name + actions */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {band.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => navigate(`/bands/${band.id}`)}
                        sx={{ minWidth: 0, px: 1, fontSize: '0.75rem' }}
                      >
                        View
                      </Button>
                      <IconButton
                        size="small"
                        onClick={() => deleteBand(band.id)}
                        title="Delete band"
                        sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Member list */}
                  {band.members.length === 0 ? (
                    <Typography variant="caption" color="text.disabled">
                      No members yet
                    </Typography>
                  ) : (
                    <List dense disablePadding>
                      {band.members.map((m) => (
                        <ListItem
                          key={m.id}
                          disablePadding
                          sx={{
                            bgcolor: 'background.default',
                            borderRadius: 1,
                            mb: 0.5,
                            px: 1,
                          }}
                          secondaryAction={
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={() => removeMember(band.id, m.id)}
                              title="Remove member"
                              sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          }
                        >
                          <ListItemText
                            primary={displayName(m)}
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}

                  {/* Add member dropdown */}
                  {available.length > 0 && (
                    <Select
                      size="small"
                      displayEmpty
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          addMember(band.id, Number(e.target.value));
                        }
                      }}
                      renderValue={() => 'Add member…'}
                      sx={{ fontSize: '0.875rem' }}
                    >
                      {available.map((u) => (
                        <MenuItem key={u.id} value={u.id}>
                          {displayName(u)}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
