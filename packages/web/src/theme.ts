import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6c63ff',
    },
    background: {
      default: '#0f0f11',
      paper: '#1a1a1f',
    },
  },
});

export default theme;
