import { useState } from 'react';
import { Box, Button, Checkbox, FormControl, FormControlLabel, FormHelperText, InputAdornment, Link, Stack } from '@mui/material';
import LabeledInput from '../components/LabeledInput';
import PasswordRules from '../components/PasswordRules';
import { ACME_EMAIL } from '../validation';
import { crate } from '../../../theme/crateTheme';

export default function DetailsStep({ form, onChange, errors, loading, onSubmit }) {
  const [showPassword, setShowPassword] = useState(false);
  const emailTyped = form.email.trim().length > 0;
  const emailInvalid = emailTyped && !ACME_EMAIL.test(form.email.trim());
  const set = (field) => (e) => onChange(field, e.target.value);

  return (
    <Stack component="form" noValidate spacing={2.25} onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 2 }}>
        <LabeledInput id="firstName" label="First name" autoComplete="given-name" value={form.firstName} onChange={set('firstName')} error={errors.firstName} />
        <LabeledInput id="lastName" label="Last name" autoComplete="family-name" value={form.lastName} onChange={set('lastName')} error={errors.lastName} />
      </Box>

      <LabeledInput
        id="email"
        type="email"
        label="Work email"
        autoComplete="email"
        placeholder="name@acme.inc"
        value={form.email}
        onChange={set('email')}
        error={errors.email || (emailInvalid ? 'Only @acme.inc addresses can register.' : false)}
      />

      <Stack spacing={1}>
        <LabeledInput
          id="password"
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          error={errors.password}
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
        <PasswordRules password={form.password} />
      </Stack>

      <FormControl error={Boolean(errors.acceptedPolicy)}>
        <FormControlLabel
          sx={{ alignItems: 'flex-start', m: 0 }}
          control={<Checkbox checked={form.acceptedPolicy} onChange={(e) => onChange('acceptedPolicy', e.target.checked)} />}
          label={
            <Box component="span" sx={{ fontSize: 13, lineHeight: 1.5 }}>
              I agree to the <Link href="/acceptable-use">acceptable use policy</Link> and understand activity is logged.
            </Box>
          }
        />
        {errors.acceptedPolicy && <FormHelperText>{errors.acceptedPolicy}</FormHelperText>}
      </FormControl>

      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap sx={{ pt: 0.5 }}>
        <Button type="submit" variant="contained" disabled={loading}>{loading ? 'Creating…' : 'Continue'}</Button>
        <Box component="span" sx={{ fontSize: 13 }}>Already registered? <Link href="/login">Sign in</Link></Box>
      </Stack>
    </Stack>
  );
}
