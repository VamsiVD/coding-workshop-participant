import { Box, Button, Link, Stack } from '@mui/material';
import { crate, fonts } from '../../../theme/crateTheme';

export default function DoneStep({ name, email, method }) {
  const rows = [
    ['Name', name],
    ['Account', email],
    ['Role', 'Employee'],
    ['Two-factor', method === 'app' ? 'Authenticator app' : 'Text message'],
  ];

  return (
    <Stack spacing={2.5}>
      <Box sx={{ alignSelf: 'flex-start', border: `3px double ${crate.red}`, color: crate.red, px: 1.75, py: 0.75, fontFamily: fonts.stencil, fontWeight: 900, fontSize: 24, letterSpacing: '.16em' }}>
        VERIFIED
      </Box>
      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', gap: '10px 24px', borderTop: `2px solid ${crate.ink}`, borderBottom: `2px solid ${crate.ink}`, py: 1.75, fontSize: 14 }}>
        {rows.map(([k, v]) => [
          <Box component="dt" key={`${k}-k`} sx={{ fontFamily: fonts.heading, fontWeight: 500, fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', pt: '2px' }}>{k}</Box>,
          <Box component="dd" key={`${k}-v`} sx={{ m: 0 }}>{v}</Box>,
        ])}
      </Box>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
        <Button variant="contained" href="/incidents/new">Go to Coyote Dispatch</Button>
        <Link href="/settings/security" sx={{ fontSize: 13 }}>Manage security settings</Link>
      </Stack>
    </Stack>
  );
}
