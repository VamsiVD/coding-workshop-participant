// Sign-in page (/login). Checks the email locally, calls POST /auth/login,
// stores the returned token, then hands the user to App via onSignedIn.
// The form fields themselves live in CredentialsStep.
import { useState } from 'react';
import { Alert, Box } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import TimelineIcon from '@mui/icons-material/Timeline';
import CheckIcon from '@mui/icons-material/Check';
import { authApi } from '../../services/authApi';
import { saveSession } from '../../services/session';
import { admin } from '../../theme/adminTheme';
import AuthShell, { authErrorSx } from '../../components/layout/AuthShell';
import CredentialsStep from './steps/CredentialsStep';

// Only company addresses may sign in: anything@acme.inc, case-insensitive.
// (Same pattern as ACME_EMAIL in register/validation.js.)
const ACME_EMAIL = /^[^\s@]+@acme\.inc$/i;

// Selling points shown in the brand panel. `Icon` is a component reference
// (capitalised so JSX treats it as a component, not an HTML tag).
const FEATURES = [
  { Icon: AddIcon, strong: 'Report', rest: 'a problem in under a minute' },
  { Icon: TimelineIcon, strong: 'Track', rest: 'status and engineer notes' },
  { Icon: CheckIcon, strong: 'Confirm', rest: 'the fix when it’s done' },
];

// [CONCEPT: Component] A tiny local component: no props, no state, just markup.
const Features = () => (
  <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.75, fontSize: 14, lineHeight: 1.45 }}>
    {/* [CONCEPT: List rendering and keys] One <li> per feature, keyed by its unique heading word. */}
    {FEATURES.map(({ Icon, strong, rest }) => (
      <Box component="li" key={strong} sx={{ display: 'grid', gridTemplateColumns: '22px minmax(0,1fr)', gap: 1.25 }}>
        <Icon sx={{ fontSize: 18, color: admin.redBright, mt: '1px' }} />
        <span><Box component="span" sx={{ fontWeight: 500 }}>{strong}</Box> <Box component="span" sx={{ color: admin.tanLight }}>{rest}</Box></span>
      </Box>
    ))}
  </Box>
);

// [CONCEPT: Props] onSignedIn is a callback from App, which decides where the
// signed-in user goes (their role's home page).
export default function LoginPage({ onSignedIn }) {
  // [CONCEPT: Loading and error state] `error` feeds the Alert above the form;
  // `loading` disables the submit button while the request is in flight.
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // [CONCEPT: Lifting state up] CredentialsStep owns the input values and passes
  // them up here on submit; this page owns the request, error and loading state.
  const signIn = async ({ email, password, remember }) => {
    // [CONCEPT: Form validation] Cheap checks first, so obviously bad input never
    // reaches the server. Wrong passwords are only caught by the API.
    if (!email || !password) return setError('Enter your work email and password.');
    if (!ACME_EMAIL.test(email)) return setError('Use your @acme.inc work email.');
    setError('');
    setLoading(true);
    try {
      // [CONCEPT: Service layer] Resolves to { access_token, token_type,
      // expires_in, user }; a failed login throws an ApiError with a
      // user-facing message, shown by the catch below.
      const res = await authApi.login({ email, password });
      // [CONCEPT: Browser storage] saveSession keeps the bearer token in
      // localStorage when "remember" is ticked, otherwise sessionStorage, and
      // converts expires_in (seconds) into an absolute expiresAt timestamp.
      const session = saveSession(
        { accessToken: res.access_token, expiresIn: res.expires_in, user: res.user },
        { remember },
      );
      // Leave the button disabled: the page is about to navigate away.
      onSignedIn?.(session.user);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <AuthShell
      kicker="Welcome back"
      title="Sign in"
      blurb="Use your ACME work email and password."
      rail={<Features />}
      shieldText="Sessions expire automatically."
      footerText="© 2026 ACME Inc. · Access is logged."
    >
      {/* [CONCEPT: Component composition] AuthShell draws the two-panel frame; the page passes its form as children and the feature list as the `rail` slot. */}
      {/* [CONCEPT: Conditional rendering] `&&` shows the Alert only when there is an error message. */}
      {error && <Alert severity="error" role="alert" sx={authErrorSx}>{error}</Alert>}
      <CredentialsStep loading={loading} onSubmit={signIn} />
    </AuthShell>
  );
}
