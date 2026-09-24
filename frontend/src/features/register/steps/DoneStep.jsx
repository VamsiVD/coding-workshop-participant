import { Box, Button, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { admin } from '../../../theme/adminTheme';

export default function DoneStep({ name, email }) {
  const rows = [
    ['Name', name],
    ['Account', email],
    ['Role', 'Employee'],
    ['Email', 'Verified'],
  ];

  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: admin.sand, color: admin.red, display: 'grid', placeItems: 'center' }}><CheckIcon /></Box>
        <Typography sx={{ fontSize: 15 }}>Your account has been created.</Typography>
      </Box>
      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.75, fontSize: 14, borderTop: `1px solid ${admin.line}`, borderBottom: `1px solid ${admin.line}`, py: 1.75 }}>
        {rows.map(([k, v]) => (
          <div key={k}>
            <Box component="dt" sx={{ fontSize: 12, color: admin.muted }}>{k}</Box>
            <Box component="dd" sx={{ m: 0 }}>{v}</Box>
          </div>
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant="contained" size="large" href="/login" sx={{ px: 3.5, whiteSpace: 'nowrap' }}>Sign in</Button>
      </Box>
    </Box>
  );
}
