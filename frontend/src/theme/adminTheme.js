import { createTheme } from '@mui/material/styles';

// Admin console look (matches Admin Report Viewer v3): cream ground, brown ink, ACME red, rounded corners.
// Load fonts in index.html: <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&display=swap" rel="stylesheet">
export const admin = {
  bg: '#faf6ee',
  surface: '#fffaf0',
  ink: '#2a1d14',
  brown: '#6b4a2e',
  tan: '#c9a268',
  tanLight: '#dcc08e',
  sand: '#f7ecd6',
  line: 'rgba(42,29,20,.18)',
  track: '#ede3cf',
  muted: '#6b5a45',
  faint: '#8a7458',
  red: '#b3261e',
  redBright: '#e0433a',
  danger: 'oklch(0.55 0.17 25)',
  dangerBg: 'oklch(0.95 0.03 25)',
  dangerFg: 'oklch(0.4 0.13 25)',
};

export const adminFont = "'Barlow', system-ui, sans-serif";

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: admin.red, contrastText: '#fff' },
    secondary: { main: admin.brown },
    error: { main: '#b3261e' },
    background: { default: admin.bg, paper: admin.surface },
    text: { primary: admin.ink, secondary: admin.muted },
    divider: admin.line,
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: adminFont,
    h1: { fontSize: 36, fontWeight: 600 },
    h2: { fontSize: 20, fontWeight: 600 },
    h3: { fontSize: 24, fontWeight: 600, lineHeight: 1.2 },
    h4: { fontSize: 17, fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: admin.bg, scrollbarWidth: 'none' },
        '*': { scrollbarWidth: 'none' },
        '*::-webkit-scrollbar': { display: 'none' },
      },
    },
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 8 } } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 8, backgroundColor: admin.surface } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 999, fontSize: 11, height: 22 } } },
    MuiTableCell: { styleOverrides: { root: { borderColor: admin.line }, head: { fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: admin.muted } } },
  },
});

export default theme;
