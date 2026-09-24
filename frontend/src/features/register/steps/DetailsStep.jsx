import { Box, Button, Checkbox, FormControl, FormControlLabel, FormHelperText, Link } from '@mui/material';
import LabeledInput from '../components/LabeledInput';
import PasswordInput from '../components/PasswordInput';
import PasswordRules from '../components/PasswordRules';
import { ACME_EMAIL } from '../validation';
import { admin } from '../../../theme/adminTheme';
import { checkSx } from '../../../components/layout/AuthShell';

export default function DetailsStep({ form, onChange, errors, loading, onSubmit }) {
  const emailTyped = form.email.trim().length > 0;
  const emailInvalid = emailTyped && !ACME_EMAIL.test(form.email.trim());
  const set = (field) => (e) => onChange(field, e.target.value);

  return (
    <Box component="form" noValidate onSubmit={(e) => { e.preventDefault(); onSubmit(); }} sx={{ display: 'grid', gap: 2.25 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 2 }}>
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

      <Box sx={{ display: 'grid', gap: 1 }}>
        <PasswordInput id="password" label="Password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} />
        <PasswordRules password={form.password} />
      </Box>

      <FormControl error={Boolean(errors.acceptedPolicy)}>
        <FormControlLabel
          sx={{ alignItems: 'flex-start', m: 0 }}
          control={<Checkbox checked={form.acceptedPolicy} onChange={(e) => onChange('acceptedPolicy', e.target.checked)} sx={{ ...checkSx, mt: '2px' }} />}
          label={<Box component="span" sx={{ fontSize: 14, lineHeight: 1.5 }}>I agree to the <Link href="/acceptable-use" color="secondary">acceptable use policy</Link> and understand activity is logged.</Box>}
        />
        {errors.acceptedPolicy && <FormHelperText sx={{ mx: 0 }}>{errors.acceptedPolicy}</FormHelperText>}
      </FormControl>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', pt: 0.5 }}>
        <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ px: 3.5, whiteSpace: 'nowrap' }}>{loading ? 'Creating…' : 'Continue'}</Button>
        <Box component="span" sx={{ fontSize: 14, color: admin.muted }}>Already registered? <Link href="/login" color="secondary">Sign in</Link></Box>
      </Box>
    </Box>
  );
}
