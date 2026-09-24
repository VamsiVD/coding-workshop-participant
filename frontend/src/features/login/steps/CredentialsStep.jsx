// The sign-in form (email, password, "keep me signed in"). It only collects
// input; LoginPage validates it, calls the API and shows errors.
import { useState } from 'react';
import { Box, Button, Checkbox, FormControlLabel, Link } from '@mui/material';
import LabeledInput from '../../register/components/LabeledInput';
import PasswordInput from '../../register/components/PasswordInput';
import { admin } from '../../../theme/adminTheme';
import { checkSx } from '../../../components/layout/AuthShell';

export default function CredentialsStep({ loading, onSubmit }) {
  // [CONCEPT: useState] Local state for each input; the parent only sees the
  // values when the form is submitted.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // "Remember me" defaults to on: the token goes to localStorage (see session.js).
  const [remember, setRemember] = useState(true);

  return (
    // [CONCEPT: Form submission] preventDefault stops a full page reload. The email
    // is trimmed and lower-cased before it goes up, so "Name@ACME.inc " still works.
    // noValidate turns off the browser's own popups; LoginPage validates instead.
    <Box component="form" noValidate onSubmit={(e) => { e.preventDefault(); onSubmit({ email: email.trim().toLowerCase(), password, remember }); }} sx={{ display: 'grid', gap: 2.25 }}>
      {/* [CONCEPT: Controlled input] value comes from state and every keystroke goes through setEmail. autoComplete hints let password managers fill the form. */}
      <LabeledInput id="email" type="email" label="Work email" autoComplete="username" placeholder="name@acme.inc" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />

      {/* The "Forgot password?" link is absolutely positioned so it sits on the same line as the Password label. */}
      <Box sx={{ position: 'relative' }}>
        <Link href="/forgot-password" color="secondary" sx={{ position: 'absolute', right: 0, top: 0, fontSize: 13, zIndex: 1 }}>Forgot password?</Link>
        <PasswordInput id="password" label="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Box>

      <FormControlLabel
        sx={{ m: 0 }}
        control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} sx={checkSx} />}
        label={<Box component="span" sx={{ fontSize: 14 }}>Keep me signed in on this device for 12 hours</Box>}
      />

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', pt: 0.5 }}>
        {/* [CONCEPT: Loading and error state] Disabled with a "Signing in…" label while the parent's request runs, which also blocks double submits. */}
        <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ px: 4, whiteSpace: 'nowrap' }}>{loading ? 'Signing in…' : 'Sign in'}</Button>
        <Box component="span" sx={{ fontSize: 14, color: admin.muted }}>New here? <Link href="/register" color="secondary">Create an account</Link></Box>
      </Box>
    </Box>
  );
}
