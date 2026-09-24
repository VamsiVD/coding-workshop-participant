// Step 1 of the registration wizard: name, work email, password and policy
// consent. Holds no state; RegisterPage owns `form` and `errors`.
import { Box, Button, Checkbox, FormControl, FormControlLabel, FormHelperText, Link } from '@mui/material';
import LabeledInput from '../components/LabeledInput';
import PasswordInput from '../components/PasswordInput';
import PasswordRules from '../components/PasswordRules';
import { ACME_EMAIL } from '../validation';
import { admin } from '../../../theme/adminTheme';
import { checkSx } from '../../../components/layout/AuthShell';

// [CONCEPT: Lifting state up] A "controlled" step: values come in via `form`,
// every change goes back up through onChange(field, value), and submitting
// just calls onSubmit(); RegisterPage validates and calls the API.
export default function DetailsStep({ form, onChange, errors, loading, onSubmit }) {
  // [CONCEPT: Derived state] Live email check while typing, so the user sees the
  // @acme.inc rule before submitting. Stays quiet while the field is empty.
  const emailTyped = form.email.trim().length > 0;
  const emailInvalid = emailTyped && !ACME_EMAIL.test(form.email.trim());
  // Curried handler: set('email') returns the onChange function for that field.
  const set = (field) => (e) => onChange(field, e.target.value);

  return (
    // [CONCEPT: Form submission] preventDefault keeps the page from reloading;
    // noValidate leaves validation to validateDetails() instead of the browser.
    <Box component="form" noValidate onSubmit={(e) => { e.preventDefault(); onSubmit(); }} sx={{ display: 'grid', gap: 2.25 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 2 }}>
        {/* [CONCEPT: Controlled input] value from the parent's form, changes reported through set('firstName'). */}
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
        // A server/submit error wins; otherwise show the live format error, or false for none.
        error={errors.email || (emailInvalid ? 'Only @acme.inc addresses can register.' : false)}
      />

      <Box sx={{ display: 'grid', gap: 1 }}>
        <PasswordInput id="password" label="Password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} />
        {/* Checklist that updates on every keystroke from the same password value. */}
        <PasswordRules password={form.password} />
      </Box>

      <FormControl error={Boolean(errors.acceptedPolicy)}>
        <FormControlLabel
          sx={{ alignItems: 'flex-start', m: 0 }}
          // Checkboxes report e.target.checked (a boolean), not e.target.value, so this one skips set().
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
