import { useState } from 'react';
import { Alert, Box, Button, Checkbox, FormControl, FormControlLabel, FormHelperText, Stack } from '@mui/material';
import { crate, fonts } from '../../../theme/crateTheme';

export default function BackupCodesStep({ codes, email, onFinish }) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const text = `ACME Coyote Dispatch backup codes for ${email}\n\n${codes.join('\n')}\n`;

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'coyote-dispatch-backup-codes.txt' });
    a.click();
    URL.revokeObjectURL(url);
  };

  const finish = () => {
    if (!saved) return setError('Confirm you’ve stored your backup codes.');
    onFinish();
  };

  return (
    <Stack spacing={2.25}>
      <Alert severity="info">Preview: these codes are not saved to your account yet and cannot be used to sign in.</Alert>
      <Box sx={{ border: `2px solid ${crate.ink}`, bgcolor: crate.field }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', px: 1.75, py: 1, borderBottom: `2px solid ${crate.ink}`, bgcolor: crate.paper }}>
          <Box component="span" sx={{ fontFamily: fonts.heading, fontWeight: 500, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase' }}>Backup codes · {email}</Box>
          <Stack direction="row" spacing={0.75}>
            <Button size="small" variant="outlined" onClick={download}>Download</Button>
            <Button size="small" variant="outlined" onClick={() => window.print()}>Print</Button>
          </Stack>
        </Box>
        <Box component="ol" sx={{ listStyle: 'none', m: 0, p: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px 24px' }}>
          {codes.map((c, i) => (
            <Box component="li" key={c} sx={{ display: 'flex', gap: 1.5, fontSize: 15, letterSpacing: '.08em' }}>
              <Box component="span" sx={{ opacity: 0.5, minWidth: '1.4em' }}>{String(i + 1).padStart(2, '0')}</Box>
              <Box component="span" sx={{ fontWeight: 700 }}>{c}</Box>
            </Box>
          ))}
        </Box>
      </Box>

      <FormControl error={Boolean(error)}>
        <FormControlLabel
          sx={{ alignItems: 'flex-start', m: 0 }}
          control={<Checkbox checked={saved} onChange={(e) => { setSaved(e.target.checked); setError(''); }} />}
          label={<Box component="span" sx={{ fontSize: 13.5, lineHeight: 1.5 }}>I’ve stored these codes somewhere safe. Each one works once.</Box>}
        />
        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>

      <Box>
        <Button variant="contained" onClick={finish}>Finish setup</Button>
      </Box>
    </Stack>
  );
}
