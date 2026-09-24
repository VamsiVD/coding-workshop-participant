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

const ACME_EMAIL = /^[^\s@]+@acme\.inc$/i;

const FEATURES = [
  { Icon: AddIcon, strong: 'Report', rest: 'a problem in under a minute' },
  { Icon: TimelineIcon, strong: 'Track', rest: 'status and engineer notes' },
  { Icon: CheckIcon, strong: 'Confirm', rest: 'the fix when it’s done' },
];

const Features = () => (
  <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.75, fontSize: 14, lineHeight: 1.45 }}>
    {FEATURES.map(({ Icon, strong, rest }) => (
      <Box component="li" key={strong} sx={{ display: 'grid', gridTemplateColumns: '22px minmax(0,1fr)', gap: 1.25 }}>
        <Icon sx={{ fontSize: 18, color: admin.redBright, mt: '1px' }} />
        <span><Box component="span" sx={{ fontWeight: 500 }}>{strong}</Box> <Box component="span" sx={{ color: admin.tanLight }}>{rest}</Box></span>
      </Box>
    ))}
  </Box>
);

export default function LoginPage({ onSignedIn }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const signIn = async ({ email, password, remember }) => {
    if (!email || !password) return setError('Enter your work email and password.');
    if (!ACME_EMAIL.test(email)) return setError('Use your @acme.inc work email.');
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
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
      {error && <Alert severity="error" role="alert" sx={authErrorSx}>{error}</Alert>}
      <CredentialsStep loading={loading} onSubmit={signIn} />
    </AuthShell>
  );
}
