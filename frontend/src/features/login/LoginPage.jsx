import { useState } from 'react';
import { useMediaQuery } from 'react-responsive';
import { Alert, Box, Button, Link, Paper, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import TimelineIcon from '@mui/icons-material/Timeline';
import CheckIcon from '@mui/icons-material/Check';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { authApi } from '../../services/authApi';
import { clearSession, saveSession } from '../../services/session';
import { crate, fonts } from '../../theme/crateTheme';
import CredentialsStep from './steps/CredentialsStep';
import MfaChallengeStep from './steps/MfaChallengeStep';

const ACME_EMAIL = /^[^\s@]+@acme\.inc$/i;

const FEATURES = [
  { Icon: AddIcon, strong: 'Report', rest: 'a problem in under a minute' },
  { Icon: TimelineIcon, strong: 'Track', rest: 'status and engineer notes' },
  { Icon: CheckIcon, strong: 'Confirm', rest: 'the fix when it’s done' },
];

const ROLE_LABELS = { employee: 'Employee', engineer: 'Engineer', admin: 'Facility admin' };

function sessionRows({ session, remember }) {
  if (!session) return [];
  const expires = new Date(session.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return [
    ['Account', session.user.email],
    ['Role', ROLE_LABELS[session.user.role] ?? session.user.role],
    ['Session', remember ? `Expires at ${expires}` : `Ends when you close the browser, or at ${expires}`],
  ];
}

export default function LoginPage({ onSignedIn }) {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const [step, setStep] = useState('credentials');
  // Login response held until the two-factor step passes; only then is the
  // token stored.
  const [pending, setPending] = useState(null);
  const [account, setAccount] = useState({ remember: true, session: null });
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async (fn) => {
    setError('');
    setLoading(true);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const signIn = ({ email, password, remember }) => {
    if (!email || !password) return setError('Enter your work email and password.');
    if (!ACME_EMAIL.test(email)) return setError('Use your @acme.inc work email.');
    run(async () => {
      const res = await authApi.login({ email, password });
      setPending(res);
      setAccount({ remember, session: null });
      setStep('mfa');
    });
  };

  const verify = ({ code, backupCode }) => run(async () => {
    await authApi.verifyLoginMfa({ code, backupCode });
    const session = saveSession(
      { accessToken: pending.access_token, expiresIn: pending.expires_in, user: pending.user },
      { remember: account.remember },
    );
    setPending(null);
    setAccount((a) => ({ ...a, session }));
    setStep('done');
    onSignedIn?.(session.user);
  });

  const reset = () => {
    clearSession();
    setStep('credentials');
    setPending(null);
    setUseBackup(false);
    setError('');
  };

  const copy = {
    credentials: { kicker: 'Welcome back', title: 'Sign in', blurb: 'Use your ACME work email and password.' },
    mfa: {
      kicker: 'Two-factor check',
      title: 'Verify it’s you',
      blurb: useBackup ? 'Enter one of the backup codes you saved when you registered.' : 'Enter the 6-digit code from your authenticator app.',
    },
    done: { kicker: 'Authenticated', title: 'You’re signed in', blurb: 'Your session is active.' },
  }[step];

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2.5, py: isMobile ? 3 : 6 }}>
      <Stack spacing={1.75} sx={{ width: '100%', maxWidth: 880 }}>
        <Paper elevation={0} sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', border: `2px solid ${crate.ink}`, boxShadow: `6px 6px 0 ${crate.ink}`, bgcolor: crate.paper }}>
          <Box
            component="aside"
            sx={{ flex: isMobile ? 'none' : '0 0 320px', bgcolor: crate.ink, color: crate.paper, borderTop: `6px solid ${crate.red}`, p: isMobile ? '20px' : '32px 28px', display: 'flex', flexDirection: 'column', gap: isMobile ? 1 : 3.5 }}
          >
            <Box>
              <Typography component="div" sx={{ fontFamily: fonts.stencil, fontWeight: 900, fontSize: isMobile ? 38 : 52, lineHeight: 0.9, letterSpacing: '.08em', color: crate.redBright }}>ACME</Typography>
              <Typography component="div" sx={{ fontFamily: fonts.heading, fontWeight: 500, fontSize: 13, letterSpacing: '.24em', textTransform: 'uppercase' }}>Coyote Dispatch</Typography>
            </Box>
            {!isMobile && (
              <>
                <Typography sx={{ fontSize: 14, lineHeight: 1.6, maxWidth: '30ch', opacity: 0.9 }}>
                  Report and track facility and workplace technology issues across every ACME building.
                </Typography>
                <Stack component="ul" spacing={1.75} sx={{ listStyle: 'none', m: 0, p: 0, fontSize: 13, lineHeight: 1.45 }}>
                  {FEATURES.map(({ Icon, strong, rest }) => (
                    <Box component="li" key={strong} sx={{ display: 'grid', gridTemplateColumns: '22px minmax(0,1fr)', gap: 1.25 }}>
                      <Icon sx={{ fontSize: 18, color: crate.redBright, mt: '1px' }} />
                      <span><b>{strong}</b> {rest}</span>
                    </Box>
                  ))}
                </Stack>
                <Stack direction="row" spacing={1.25} sx={{ mt: 'auto', pt: 2, borderTop: '1px solid rgba(243,230,200,.2)', fontSize: 12, lineHeight: 1.5, opacity: 0.8 }}>
                  <ShieldOutlinedIcon sx={{ fontSize: 18, flex: 'none' }} />
                  <span>Protected by two-factor authentication.</span>
                </Stack>
              </>
            )}
          </Box>

          <Box component="main" sx={{ flex: 1, minWidth: 0, p: isMobile ? '24px 20px' : '40px 40px 32px' }}>
            <Stack spacing={3}>
              <Stack spacing={0.75}>
                <Typography variant="overline" sx={{ color: crate.redDeep }}>{copy.kicker}</Typography>
                <Typography variant="h1" sx={{ fontSize: isMobile ? 24 : 30 }}>{copy.title}</Typography>
                <Typography variant="body1" sx={{ maxWidth: '46ch' }}>{copy.blurb}</Typography>
              </Stack>

              {error && <Alert severity="error" role="alert">{error}</Alert>}

              {step === 'credentials' && <CredentialsStep loading={loading} onSubmit={signIn} />}
              {step === 'mfa' && (
                <MfaChallengeStep useBackup={useBackup} onToggleBackup={() => setUseBackup((v) => !v)} loading={loading} onSubmit={verify} onBack={reset} />
              )}
              {step === 'done' && (
                <Stack spacing={2.5}>
                  <Box sx={{ alignSelf: 'flex-start', border: `3px double ${crate.red}`, color: crate.red, px: 1.75, py: 0.75, fontFamily: fonts.stencil, fontWeight: 900, fontSize: 24, letterSpacing: '.16em' }}>SIGNED IN</Box>
                  <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'max-content minmax(0,1fr)', gap: '10px 24px', borderTop: `2px solid ${crate.ink}`, borderBottom: `2px solid ${crate.ink}`, py: 1.75, fontSize: 14 }}>
                    {sessionRows(account).map(([k, v]) => [
                      <Box component="dt" key={`${k}-k`} sx={{ fontFamily: fonts.heading, fontWeight: 500, fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', pt: '2px' }}>{k}</Box>,
                      <Box component="dd" key={`${k}-v`} sx={{ m: 0 }}>{v}</Box>,
                    ])}
                  </Box>
                  <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Button variant="contained" href="/dashboard">Open Coyote Dispatch</Button>
                    <Link component="button" type="button" onClick={reset} sx={{ fontSize: 13 }}>Sign in as someone else</Link>
                  </Stack>
                </Stack>
              )}
            </Stack>
          </Box>
        </Paper>

        <Stack direction={isMobile ? 'column' : 'row'} justifyContent="space-between" spacing={1} sx={{ fontSize: 12 }}>
          <span>© 2026 ACME Inc. · Access is logged.</span>
          <Stack direction="row" spacing={2.25}>
            <Link href="/privacy" sx={{ color: crate.ink }}>Privacy</Link>
            <Link href="/acceptable-use" sx={{ color: crate.ink }}>Acceptable use</Link>
            <Link href="/help" sx={{ color: crate.ink }}>Service desk</Link>
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
}
