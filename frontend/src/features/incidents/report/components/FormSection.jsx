import { Box, Stack, Typography } from '@mui/material';
import { crate, fonts } from '../../../../theme/crateTheme';

export const labelSx = { fontFamily: fonts.heading, fontWeight: 500, fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase' };

export default function FormSection({ number, title, children, last = false }) {
  return (
    <Box component="section" sx={{ px: 3, py: 2.5, borderBottom: last ? 'none' : `2px solid ${crate.ink}` }}>
      <Stack direction="row" spacing={1.25} alignItems="baseline" sx={{ mb: 1.75 }}>
        <Box component="span" sx={{ fontFamily: fonts.heading, fontWeight: 600, fontSize: 13, color: crate.red, letterSpacing: '.08em' }}>{number}</Box>
        <Typography component="h2" sx={{ fontFamily: fonts.heading, fontWeight: 600, fontSize: 15, letterSpacing: '.12em', textTransform: 'uppercase' }}>{title}</Typography>
      </Stack>
      <Stack spacing={1.75}>{children}</Stack>
    </Box>
  );
}
