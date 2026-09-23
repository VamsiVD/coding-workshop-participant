import { useState } from 'react';
import { Box, Button, Checkbox, FormControlLabel, InputAdornment, Link, Stack } from '@mui/material';
import LabeledInput from '../../register/components/LabeledInput';
import { crate } from '../../../theme/crateTheme';

export default function CredentialsStep({ loading, onSubmit }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Stack component="form" noValidate spacing={2.25} onSubmit={(e) => { e.preventDefault(); onSubmit({ email: email.trim().toLowerCase(), password, remember }); }}>
      <LabeledInput id="email" type="email" label="Work email" autoComplete="username" placeholder="name@acme.inc" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />

      <Box sx={{ position: 'relative' }}>
        <Link href="/forgot-password" sx={{ position: 'absolute', right: 0, top: 0, fontSize: 12.5, zIndex: 1 }}>Forgot password?</Link>
        <LabeledInput
          id="password"
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          inputSx={{ pr: 0 }}
          endAdornment={
            <InputAdornment position="end" sx={{ height: '100%', maxHeight: 'none', ml: 0 }}>
              <Button
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                sx={{ minHeight: 44, px: 2, fontSize: 12, fontWeight: 500, letterSpacing: '.12em', color: crate.ink, bgcolor: crate.paper, borderLeft: `2px solid ${crate.ink}`, '&:hover': { bgcolor: crate.tint } }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </Button>
            </InputAdornment>
          }
        />
      </Box>

      <FormControlLabel
        sx={{ m: 0 }}
        control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
        label={<Box component="span" sx={{ fontSize: 13 }}>Keep me signed in on this device</Box>}
      />

      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap sx={{ pt: 0.5 }}>
        <Button type="submit" variant="contained" disabled={loading} sx={{ px: 4 }}>{loading ? 'Signing in…' : 'Sign in'}</Button>
        <Box component="span" sx={{ fontSize: 13 }}>New to Coyote Dispatch? <Link href="/register">Create an account</Link></Box>
      </Stack>
    </Stack>
  );
}
