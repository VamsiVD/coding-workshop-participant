import { useState } from 'react';
import { Alert, Box, Button } from '@mui/material';
import CodeInput from '../components/CodeInput';

export default function VerifyEmailStep({ loading, onSubmit, onResend }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (code.length !== 6) return setError('Enter the full 6-digit code.');
    setError('');
    onSubmit(code);
  };

  return (
    <Box component="form" noValidate onSubmit={submit} sx={{ display: 'grid', gap: 2.25, maxWidth: 420 }}>
      <Alert severity="info" sx={{ borderRadius: '10px' }}>Preview: no email is sent yet. Any 6-digit code continues to the next step.</Alert>
      <CodeInput id="emailCode" label="Verification code" value={code} onChange={setCode} error={error} helperText="Code expires in 30 minutes." autoFocus />
      <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ px: 3.5, whiteSpace: 'nowrap' }}>{loading ? 'Verifying…' : 'Verify email'}</Button>
        <Button color="secondary" onClick={onResend} disabled={loading}>Resend code</Button>
      </Box>
    </Box>
  );
}
