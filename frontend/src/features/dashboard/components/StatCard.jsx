import { Box, ButtonBase } from '@mui/material';
import { crate, fonts } from '../../../theme/crateTheme';

export default function StatCard({ label, value, hint, active = false, tone = 'default', onClick }) {
  const clickable = Boolean(onClick);
  const bg = active ? crate.ink : tone === 'alert' ? crate.errorBg : crate.field;
  const fg = active ? crate.paper : crate.ink;
  const content = (
    <>
      <Box component="span" sx={{ fontFamily: fonts.heading, fontWeight: 500, fontSize: 11.5, letterSpacing: '.14em', textTransform: 'uppercase' }}>{label}</Box>
      <Box component="span" sx={{ fontFamily: fonts.heading, fontWeight: 600, fontSize: 34, lineHeight: 1.05 }}>{value}</Box>
      <Box component="span" sx={{ fontSize: 12 }}>{hint}</Box>
    </>
  );
  const sx = {
    display: 'grid',
    gap: '2px',
    textAlign: 'left',
    justifyItems: 'start',
    p: '12px 14px',
    border: `2px solid ${crate.ink}`,
    bgcolor: bg,
    color: fg,
    boxShadow: active ? `3px 3px 0 ${crate.red}` : 'none',
    fontFamily: fonts.body,
  };
  return clickable ? (
    <ButtonBase onClick={onClick} aria-pressed={active} sx={{ ...sx, '&:focus-visible': { outline: `2px solid ${crate.red}`, outlineOffset: 2 } }}>{content}</ButtonBase>
  ) : (
    <Box sx={sx}>{content}</Box>
  );
}
