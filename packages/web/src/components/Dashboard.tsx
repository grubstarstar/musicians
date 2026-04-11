import { useAuth } from '../context/AuthContext';
import BandsManager from './BandsManager';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <Box sx={{ width: '100%', maxWidth: 720, p: 3 }}>
      <Box
        component="header"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 4,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {user?.username}
        </Typography>
        <Button variant="outlined" size="small" onClick={logout}>
          Sign out
        </Button>
      </Box>
      <BandsManager />
    </Box>
  );
}
