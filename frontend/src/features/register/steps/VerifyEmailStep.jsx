// Step 2 of the registration wizard: the user enters the code "emailed" to
// them. For now no email is sent and any 6-digit code is accepted.
import { useState } from 'react';
import { Alert, Box, Button } from '@mui/material';
import CodeInput from '../components/CodeInput';

// [CONCEPT: Props] onSubmit(code) and onResend() are RegisterPage callbacks that
// call the API; `loading` comes back down to disable the buttons meanwhile.
export default function VerifyEmailStep({ loading, onSubmit, onResend }) {
  // [CONCEPT: useState] The code is local: only the finished value is passed up.
  // `error` here is only the local length check; API errors show in RegisterPage.
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  // [CONCEPT: Form validation] CodeInput already keeps it digits-only, so length
  // is the only thing left to check before calling the parent.
  const submit = (e) => {
    e.preventDefault();
    if (code.length !== 6) return setError('Enter the full 6-digit code.');
    setError('');
    onSubmit(code);
  };

  return (
    <Box component="form" noValidate onSubmit={submit} sx={{ display: 'grid', gap: 2.25, maxWidth: 420 }}>
      <Alert severity="info" sx={{ borderRadius: '10px' }}>Preview: no email is sent yet. Any 6-digit code continues to the next step.</Alert>
      {/* [CONCEPT: Controlled input] CodeInput calls setCode with the cleaned digits, not an event. */}
      <CodeInput id="emailCode" label="Verification code" value={code} onChange={setCode} error={error} helperText="Code expires in 30 minutes." autoFocus />
      <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ px: 3.5, whiteSpace: 'nowrap' }}>{loading ? 'Verifying…' : 'Verify email'}</Button>
        {/* Not a submit button, so clicking it does not submit the form. */}
        <Button color="secondary" onClick={onResend} disabled={loading}>Resend code</Button>
      </Box>
    </Box>
  );
}
