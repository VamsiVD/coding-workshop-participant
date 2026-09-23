import { useCallback, useEffect, useState } from 'react';
import { useMediaQuery } from 'react-responsive';
import { Alert, Box, LinearProgress, Link, Paper, Stack, Typography } from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { authApi } from '../../services/authApi';
import { crate, fonts } from '../../theme/crateTheme';
import { validateDetails } from './validation';
import ProgressRail from './components/ProgressRail';
import DetailsStep from './steps/DetailsStep';
import MfaStep from './steps/MfaStep';
import BackupCodesStep from './steps/BackupCodesStep';
import DoneStep from './steps/DoneStep';

const STEPS = [
  { label: 'Account details', sub: 'Name, email, password' },
  { label: 'Two-factor', sub: 'App or text message' },
  { label: 'Backup codes', sub: 'Recovery access' },
];
const DONE = STEPS.length;

const COPY = [
  { title: 'Create your account', blurb: 'Use your ACME work email. Accounts are for employees only.' },
  { title: 'Set up two-factor authentication', blurb: 'Adds a second check each time you sign in.' },
  { title: 'Save your backup codes', blurb: 'Use one if you lose access to your authenticator. Each code works once.' },
  { title: 'Your account is ready', blurb: 'You can now report and track incidents.' },
];

// Backend field names -> form field names, so server validation errors land on
// the right input.
const SERVER_FIELDS = { full_name: 'firstName', email: 'email', password: 'password' };

const EMPTY_FORM = { firstName: '', lastName: '', email: '', password: '', acceptedPolicy: false };

export default function RegisterPage() {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState('app');
  const [phone, setPhone] = useState('');
  const [mfaSetup, setMfaSetup] = useState({ otpauthUrl: '', secret: '', smsSent: false });
  const [backupCodes, setBackupCodes] = useState([]);

  const email = form.email.trim().toLowerCase();

  const run = useCallback(async (fn) => {
    setError('');
    setLoading(true);
    try {
      await fn();
    } catch (e) {
      const mapped = Object.fromEntries(
        Object.entries(e.fields ?? {}).filter(([k]) => SERVER_FIELDS[k]).map(([k, v]) => [SERVER_FIELDS[k], v]),
      );
      if (Object.keys(mapped).length) setFieldErrors(mapped);
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step !== 1 || method !== 'app' || mfaSetup.otpauthUrl) return;
    run(async () => {
      const { otpauthUrl, secret } = await authApi.startMfa({ email, method: 'app' });
      setMfaSetup((s) => ({ ...s, otpauthUrl, secret }));
    });
  }, [step, method, mfaSetup.otpauthUrl, email, run]);

  const updateField = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((e) => ({ ...e, [field]: undefined }));
  };

  const submitDetails = () => {
    const errors = validateDetails(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    run(async () => {
      await authApi.register({
        fullName: `${form.firstName.trim()} ${form.lastName.trim()}`,
        email,
        password: form.password,
      });
      setStep(1);
    });
  };

  const sendSms = () => run(async () => {
    await authApi.startMfa({ email, method: 'sms', phone: phone.trim() });
    setMfaSetup((s) => ({ ...s, smsSent: true }));
  });

  const confirmMfa = (code) => run(async () => {
    const { backupCodes: codes } = await authApi.confirmMfa({ method, code });
    setBackupCodes(codes);
    setStep(2);
  });

  const { title, blurb } = COPY[step];
  const stepLabel = step < DONE ? `Step ${step + 1} of ${DONE}` : 'Complete';

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2.5, py: isMobile ? 3 : 6 }}>
      <Stack spacing={1.75} sx={{ width: '100%', maxWidth: 960 }}>
        <Paper
          elevation={0}
          sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', border: `2px solid ${crate.ink}`, boxShadow: `6px 6px 0 ${crate.ink}`, bgcolor: crate.paper }}
        >
          <Box
            component="aside"
            sx={{ flex: isMobile ? 'none' : '0 0 340px', bgcolor: crate.ink, color: crate.paper, borderTop: `6px solid ${crate.red}`, p: isMobile ? '20px 20px' : '32px 28px', display: 'flex', flexDirection: 'column', gap: isMobile ? 2 : 4 }}
          >
            <Box>
              <Typography component="div" sx={{ fontFamily: fonts.stencil, fontWeight: 900, fontSize: isMobile ? 38 : 52, lineHeight: 0.9, letterSpacing: '.08em', color: crate.redBright }}>
                ACME
              </Typography>
              <Typography component="div" sx={{ fontFamily: fonts.heading, fontWeight: 500, fontSize: 13, letterSpacing: '.24em', textTransform: 'uppercase' }}>
                Coyote Dispatch
              </Typography>
            </Box>

            {isMobile ? (
              <Stack spacing={1}>
                <Typography variant="caption" sx={{ fontFamily: fonts.heading, letterSpacing: '.14em', textTransform: 'uppercase' }}>
                  {step < DONE ? `${stepLabel} · ${STEPS[step].label}` : 'Complete'}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(step / DONE) * 100}
                  sx={{ height: 6, bgcolor: 'rgba(243,230,200,.2)', '& .MuiLinearProgress-bar': { bgcolor: crate.redBright } }}
                />
              </Stack>
            ) : (
              <>
                <Typography sx={{ fontSize: 14, lineHeight: 1.6, maxWidth: '30ch', opacity: 0.9 }}>
                  Report and track facility and workplace technology issues across every ACME building.
                </Typography>
                <ProgressRail steps={STEPS} activeStep={step} />
                <Stack direction="row" spacing={1.25} sx={{ mt: 'auto', pt: 2, borderTop: '1px solid rgba(243,230,200,.2)', fontSize: 12, lineHeight: 1.5, opacity: 0.8 }}>
                  <ShieldOutlinedIcon sx={{ fontSize: 18, flex: 'none' }} />
                  <span>Two-factor authentication is required for all accounts.</span>
                </Stack>
              </>
            )}
          </Box>

          <Box component="main" sx={{ flex: 1, minWidth: 0, p: isMobile ? '24px 20px' : '36px 40px 32px' }}>
            <Stack spacing={3}>
              <Stack spacing={0.75}>
                <Typography variant="overline" sx={{ color: crate.redDeep }}>{stepLabel}</Typography>
                <Typography variant="h1" sx={{ fontSize: isMobile ? 24 : 30 }}>{title}</Typography>
                <Typography variant="body1" sx={{ maxWidth: '52ch' }}>{blurb}</Typography>
              </Stack>

              {error && <Alert severity="error" role="alert">{error}</Alert>}

              {step === 0 && (
                <DetailsStep form={form} onChange={updateField} errors={fieldErrors} loading={loading} onSubmit={submitDetails} />
              )}
              {step === 1 && (
                <MfaStep
                  method={method}
                  onMethodChange={(m) => { setMethod(m); setError(''); }}
                  setup={mfaSetup}
                  phone={phone}
                  onPhoneChange={setPhone}
                  onSendSms={sendSms}
                  loading={loading}
                  onSubmit={confirmMfa}
                />
              )}
              {step === 2 && <BackupCodesStep codes={backupCodes} email={email} onFinish={() => setStep(DONE)} />}
              {step === DONE && (
                <DoneStep name={`${form.firstName} ${form.lastName}`.trim()} email={email} method={method} />
              )}
            </Stack>
          </Box>
        </Paper>

        <Stack direction={isMobile ? 'column' : 'row'} justifyContent="space-between" spacing={1} sx={{ fontSize: 12 }}>
          <span>© 2026 ACME Inc. · Engineers and admins are invited by a facility admin.</span>
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
