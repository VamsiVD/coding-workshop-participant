import { createTheme } from '@mui/material/styles';

export const crate = {
  ink: '#2a1d14',
  paper: '#f3e6c8',
  field: '#fffaf0',
  wood: '#c9a268',
  tint: '#e8d5ab',
  red: '#b3261e',
  redDark: '#9a1f18',
  redDeep: '#7a1712',
  redBright: '#e0433a',
  errorBg: '#f7e3d6',
};

export const fonts = {
  heading: "'Oswald', sans-serif",
  body: "'Courier Prime', ui-monospace, monospace",
  stencil: "'Big Shoulders Stencil Display', sans-serif",
};

export const woodBackground = {
  backgroundColor: crate.wood,
  backgroundImage: [
    'repeating-linear-gradient(180deg, rgba(42,29,20,0) 0 118px, rgba(42,29,20,.35) 118px 121px)',
    'repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0 3px, rgba(0,0,0,.03) 3px 7px)',
  ].join(','),
};

const labelType = {
  fontFamily: fonts.heading,
  fontWeight: 500,
  fontSize: 12,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
};

const theme = createTheme({
  palette: {
    primary: { main: crate.red, dark: crate.redDark, contrastText: crate.paper },
    secondary: { main: crate.ink, contrastText: crate.paper },
    error: { main: crate.red, dark: crate.redDeep },
    background: { default: crate.wood, paper: crate.paper },
    text: { primary: crate.ink, secondary: 'rgba(42,29,20,.72)' },
    divider: crate.ink,
  },
  shape: { borderRadius: 0 },
  typography: {
    fontFamily: fonts.body,
    fontSize: 14,
    h1: { fontFamily: fonts.heading, fontWeight: 600, fontSize: 30, lineHeight: 1.1, letterSpacing: '.02em', textTransform: 'uppercase' },
    h2: { fontFamily: fonts.heading, fontWeight: 600, fontSize: 20, letterSpacing: '.08em', textTransform: 'uppercase' },
    overline: { fontFamily: fonts.heading, fontWeight: 500, fontSize: 12, letterSpacing: '.2em', lineHeight: 1.4 },
    body1: { fontSize: 14, lineHeight: 1.55 },
    body2: { fontSize: 13, lineHeight: 1.5 },
    caption: { fontSize: 12.5 },
    button: { fontFamily: fonts.heading, fontWeight: 600, fontSize: 15, letterSpacing: '.14em', textTransform: 'uppercase' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Hide scrollbars everywhere but keep scrolling (wheel, touch, keys),
        // so tall pages still reach their bottom on small screens.
        '*': { scrollbarWidth: 'none', msOverflowStyle: 'none' },
        '*::-webkit-scrollbar': { display: 'none' },
        html: { overflowX: 'hidden' },
        body: { ...woodBackground, minHeight: '100vh', color: crate.ink, overflowX: 'hidden' },
        a: { color: crate.red, textUnderlineOffset: 3 },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: 48, paddingInline: 28 },
        containedPrimary: {
          border: `2px solid ${crate.ink}`,
          boxShadow: `3px 3px 0 ${crate.ink}`,
          '&:hover': { backgroundColor: crate.redDark, boxShadow: `3px 3px 0 ${crate.ink}` },
          '&:active': { boxShadow: 'none', transform: 'translate(3px, 3px)' },
          '&.Mui-disabled': { backgroundColor: crate.red, color: crate.paper, opacity: 0.6, border: `2px solid ${crate.ink}` },
        },
        outlined: {
          border: `2px solid ${crate.ink}`,
          backgroundColor: crate.field,
          color: crate.ink,
          '&:hover': { border: `2px solid ${crate.ink}`, backgroundColor: crate.tint },
        },
        sizeSmall: { minHeight: 32, paddingInline: 12, fontSize: 11.5, fontWeight: 500, letterSpacing: '.12em' },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        root: { ...labelType, color: crate.ink, '&.Mui-focused': { color: crate.ink }, '&.Mui-error': { color: crate.redDeep } },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: crate.field,
          fontSize: 15,
          '& .MuiOutlinedInput-notchedOutline': { borderWidth: 2, borderColor: crate.ink },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: crate.ink },
          '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(179,38,30,.18)' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: crate.red, borderWidth: 2 },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: crate.red },
        },
        input: { padding: '11px 12px', '&::placeholder': { color: '#9a8566', opacity: 1 } },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: { marginLeft: 0, marginTop: 6, fontFamily: fonts.body, fontSize: 12.5, color: crate.ink, '&.Mui-error': { color: crate.redDeep, fontWeight: 700 } },
      },
    },
    MuiCheckbox: {
      defaultProps: { disableRipple: true },
      styleOverrides: { root: { color: crate.ink, padding: 0, marginRight: 10, '&.Mui-checked': { color: crate.red } } },
    },
    MuiAlert: {
      styleOverrides: {
        standardError: { border: `2px solid ${crate.red}`, backgroundColor: crate.errorBg, color: crate.redDeep, '& .MuiAlert-icon': { color: crate.redDeep } },
        standardSuccess: { border: `2px solid ${crate.ink}`, backgroundColor: crate.field, color: crate.ink, '& .MuiAlert-icon': { color: crate.ink } },
        standardInfo: { border: `2px dashed ${crate.ink}`, backgroundColor: crate.tint, color: crate.ink, '& .MuiAlert-icon': { color: crate.ink } },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          border: `2px solid ${crate.ink} !important`,
          borderRadius: 0,
          backgroundColor: crate.field,
          color: crate.ink,
          textTransform: 'none',
          '&:hover': { backgroundColor: crate.tint },
          '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: crate.ink, color: crate.paper },
        },
      },
    },
    MuiLink: { defaultProps: { underline: 'always' }, styleOverrides: { root: { color: crate.red, '&:hover': { color: crate.redDeep } } } },
    MuiMenuItem: { styleOverrides: { root: { fontFamily: fonts.body } } },
  },
});

export default theme;
