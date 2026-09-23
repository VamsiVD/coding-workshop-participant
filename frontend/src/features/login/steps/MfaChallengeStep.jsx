import { useState } from 'react';
import { Alert, Button, Link, Stack } from '@mui/material';
import CodeInput from '../../register/components/CodeInput';
import LabeledInput from '../../register/components/LabeledInput';

export default function MfaChallengeStep({ useBackup, onToggleBackup, loading, onSubmit, onBack }) {
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState('');

  // Placeholder: two-factor is not enforced by the backend yet, so any code
  // (or none) is accepted.
  const submit = (e) => {
    e.preventDefault();
    onSubmit({ code: useBackup ? undefined : code, backupCode: useBackup ? backup : undefined });
  };

  return (
    <Stack component="form" noValidate spacing={2.25} onSubmit={submit} sx={{ maxWidth: 420 }}>
      <Alert severity="info">Preview: two-factor is not enforced yet. Any code signs you in.</Alert>
      {useBackup ? (
        <LabeledInput
          id="backupCode"
          label="Backup code"
          placeholder="XXXX-XXXX"
          value={backup}
          onChange={(e) => setBackup(e.target.value.toUpperCase().slice(0, 9))}
          helperText="Each backup code works once."
          autoFocus
          inputSx={{ '& input': { height: 34, textAlign: 'center', fontSize: 24, fontWeight: 700, letterSpacing: '.2em' } }}
        />
      ) : (
        <CodeInput
          id="mfaCode"
          label="Authentication code"
          value={code}
          onChange={setCode}
          helperText="From the authenticator app on your registered device."
          autoFocus
        />
      )}

      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
        <Button type="submit" variant="contained" disabled={loading}>{loading ? 'Verifying…' : 'Verify'}</Button>
        <Link component="button" type="button" onClick={onToggleBackup} sx={{ fontSize: 13 }}>
          {useBackup ? 'Use authenticator app' : 'Use a backup code'}
        </Link>
        <Link component="button" type="button" onClick={onBack} sx={{ fontSize: 13 }}>Use another account</Link>
      </Stack>
    </Stack>
  );
}
