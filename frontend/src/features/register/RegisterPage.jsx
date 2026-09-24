import { useCallback, useState } from 'react';
import { Alert, Box, LinearProgress, Typography } from '@mui/material';
import { authApi } from '../../services/authApi';
import { admin } from '../../theme/adminTheme';
import AuthShell, { authErrorSx } from '../../components/layout/AuthShell';
import { validateDetails } from './validation';
import ProgressRail from './components/ProgressRail';
import DetailsStep from './steps/DetailsStep';
import VerifyEmailStep from './steps/VerifyEmailStep';
import DoneStep from './steps/DoneStep';

const STEPS = [
  { label: 'Account details', sub: 'Name, email, password' },
  { label: 'Verify email', sub: 'One-time code' },
];
const DONE = STEPS.length;

const COPY = [
  { title: 'Create your account', blurb: 'Use your ACME work email. Accounts are for employees only.' },
  { title: 'Verify your email', blurb: null },
  { title: 'Your account is ready', blurb: 'Sign in to report and track incidents.' },
];

// Backend field names -> form field names, so server validation errors land on
// the right input.
const SERVER_FIELDS = { full_name: 'firstName', email: 'email', password: 'password' };

const EMPTY_FORM = { firstName: '', lastName: '', email: '', password: '', acceptedPolicy: false };

export default function RegisterPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');

  const email = form.email.trim().toLowerCase();

  const run = useCallback(async (fn) => {
    setError('');
    setNotice('');
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

  const verifyEmail = (code) => run(async () => {
    await authApi.verifyEmail({ email, code });
    setStep(DONE);
  });

  const resendEmail = () => run(async () => {
    await authApi.resendEmailCode({ email });
    setNotice('A new code is on its way.');
  });

  const { title, blurb } = COPY[step];
  const stepLabel = step < DONE ? `Step ${step + 1} of ${DONE}` : 'Complete';

  return (
    <AuthShell
      maxWidth={960}
      kicker={stepLabel}
      title={title}
      blurb={step === 1 ? `Enter the 6-digit code for ${email} to confirm the address is yours.` : blurb}
      rail={<ProgressRail steps={STEPS} activeStep={step} />}
      mobileRail={
        <Box sx={{ display: 'grid', gap: 1 }}>
          <Typography sx={{ fontSize: 13, color: admin.tanLight }}>{step < DONE ? `${stepLabel} · ${STEPS[step].label}` : 'Complete'}</Typography>
          <LinearProgress variant="determinate" value={(step / DONE) * 100} sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,250,240,.15)', '& .MuiLinearProgress-bar': { bgcolor: admin.redBright, borderRadius: 3 } }} />
        </Box>
      }
      shieldText="Email codes confirm you own your work address."
      footerText="© 2026 ACME Inc. · Engineers and admins are invited by a facility admin."
    >
      {error && <Alert severity="error" role="alert" sx={authErrorSx}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ borderRadius: '10px' }}>{notice}</Alert>}

      {step === 0 && <DetailsStep form={form} onChange={updateField} errors={fieldErrors} loading={loading} onSubmit={submitDetails} />}
      {step === 1 && <VerifyEmailStep loading={loading} onSubmit={verifyEmail} onResend={resendEmail} />}
      {step === DONE && <DoneStep name={`${form.firstName} ${form.lastName}`.trim()} email={email} />}
    </AuthShell>
  );
}
