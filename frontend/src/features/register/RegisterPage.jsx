// Registration wizard (/register): step 0 account details, step 1 workspace
// (building, floor, desk or room), step 2 verify email, then a "done" screen. This page owns all wizard state (current step, form
// values, errors) and passes it down to the step components as props.
import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, LinearProgress, Typography } from '@mui/material';
import { authApi } from '../../services/authApi';
import { admin } from '../../theme/adminTheme';
import AuthShell, { authErrorSx } from '../../components/layout/AuthShell';
import { validateDetails, validateWorkspace } from './validation';
import ProgressRail from './components/ProgressRail';
import DetailsStep from './steps/DetailsStep';
import WorkspaceStep from './steps/WorkspaceStep';
import VerifyEmailStep from './steps/VerifyEmailStep';
import DoneStep from './steps/DoneStep';

const STEPS = [
  { label: 'Account details', sub: 'Name, email, password' },
  { label: 'Your workspace', sub: 'Building, floor, desk or room' },
  { label: 'Verify email', sub: 'One-time code' },
];
const WORKSPACE = 1;
const VERIFY = 2;
// The "done" screen is the index just past the last real step (3), so it is
// not shown as a step in the progress rail.
const DONE = STEPS.length;

// Heading text per step, indexed by `step` (0, 1, 2, DONE). The verify step's
// blurb is null because it is built from the email address at render time.
const COPY = [
  { title: 'Create your account', blurb: 'Use your ACME work email. Accounts are for employees only.' },
  { title: 'Where do you work?', blurb: 'Pick your building and floor, and your desk or meeting room if you have one.' },
  { title: 'Verify your email', blurb: null },
  { title: 'Your account is ready', blurb: 'Sign in to report and track incidents.' },
];

// Backend field names -> form field names, so server validation errors land on
// the right input. The form splits the name in two but the API takes one
// full_name, so name errors are shown under "First name".
const SERVER_FIELDS = {
  full_name: 'firstName', email: 'email', password: 'password',
  building_id: 'buildingId', floor_id: 'floorId', seat_id: 'seatId',
};
// Errors on these belong to step 0, so the wizard goes back there to show them.
const DETAIL_FIELDS = new Set(['firstName', 'email', 'password']);

// spotKind: 'desk' | 'room' | 'none'. Ids stay '' until chosen, which is what MUI's Select expects.
const EMPTY_FORM = {
  firstName: '', lastName: '', email: '', password: '', acceptedPolicy: false,
  buildingId: '', floorId: '', spotKind: 'desk', seatId: '',
};

export default function RegisterPage() {
  // [CONCEPT: Lifting state up] The form lives here, not in DetailsStep, so it
  // survives moving between steps and the email is still known on steps 1 and 2.
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  // { field: message } shown under individual inputs.
  const [fieldErrors, setFieldErrors] = useState({});
  // [CONCEPT: Loading and error state] `error` is a page-level Alert, `notice`
  // a success Alert (e.g. code resent), `loading` disables the step's buttons.
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  // The building tree for the workspace step: null while loading.
  const [locations, setLocations] = useState(null);
  const [locationsError, setLocationsError] = useState('');

  // [CONCEPT: useCallback] Stable, so the effect below runs once and Retry can call it again.
  const loadLocations = useCallback(() => {
    setLocationsError('');
    authApi.listLocations()
      .then(setLocations)
      .catch(() => setLocationsError('Could not load the list of buildings. Check your connection and try again.'));
  }, []);

  // [CONCEPT: useEffect] Fetched on page load, so the list is ready by the time step 1 opens.
  useEffect(() => { loadLocations(); }, [loadLocations]);

  // [CONCEPT: Derived state] Normalised email computed from the form each render,
  // so the value sent to the API always matches what was typed.
  const email = form.email.trim().toLowerCase();

  // Shared wrapper for every API call on this page: clears old messages, sets
  // loading, and turns a thrown ApiError into either per-field errors (when the
  // server named fields we know) or a single page-level message.
  // [CONCEPT: useCallback] Empty deps: it only uses state setters, which React
  // keeps stable, so the same function is reused on every render.
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
      if (Object.keys(mapped).length) {
        setFieldErrors(mapped);
        // A problem with the name, email or password is shown on step 0.
        if (Object.keys(mapped).some((k) => DETAIL_FIELDS.has(k))) setStep(0);
      } else if (e.status === 409) {
        // The only 409 here is an email that is already registered.
        setFieldErrors({ email: e.message });
        setStep(0);
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Called by DetailsStep on every change. Also clears that field's error, so a
  // message disappears as soon as the user starts fixing it.
  // [CONCEPT: Immutable update] Spread copies the old object and overrides one key.
  const updateField = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((e) => ({ ...e, [field]: undefined }));
  };

  // Step 0 -> 1: check the details locally; nothing is sent yet.
  // [CONCEPT: Form validation] validateDetails returns {} when everything passes.
  const submitDetails = () => {
    const errors = validateDetails(form);
    setFieldErrors(errors);
    if (!Object.keys(errors).length) {
      setError('');
      setStep(WORKSPACE);
    }
  };

  // Step 1 -> 2: validate the workspace, then create the account
  // (POST /auth/register). Only moves on if the API call succeeds.
  const submitWorkspace = () => {
    const errors = validateWorkspace(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    run(async () => {
      // [CONCEPT: Service layer] authApi maps these to the backend's snake_case fields.
      await authApi.register({
        fullName: `${form.firstName.trim()} ${form.lastName.trim()}`,
        email,
        password: form.password,
        buildingId: form.buildingId,
        floorId: form.floorId,
        seatId: form.spotKind === 'none' ? null : form.seatId,
      });
      setStep(VERIFY);
    });
  };

  // Step 2 -> done. Email verification is currently a placeholder in authApi
  // that accepts any code (see services/authApi.js).
  const verifyEmail = (code) => run(async () => {
    await authApi.verifyEmail({ email, code });
    setStep(DONE);
  });

  const resendEmail = () => run(async () => {
    await authApi.resendEmailCode({ email });
    setNotice('A new code is on its way.');
  });

  // Heading copy for the current step, and a label like "Step 1 of 2"
  // (or "Complete" on the done screen).
  const { title, blurb } = COPY[step];
  const stepLabel = step < DONE ? `Step ${step + 1} of ${DONE}` : 'Complete';

  return (
    <AuthShell
      maxWidth={960}
      kicker={stepLabel}
      title={title}
      blurb={step === VERIFY ? `Enter the 6-digit code for ${email} to confirm the address is yours.` : blurb}
      // [CONCEPT: Responsive design] AuthShell shows `rail` (vertical stepper) on
      // wide screens and `mobileRail` (one line plus a progress bar) on narrow ones.
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

      {/* [CONCEPT: Conditional rendering] Exactly one step component renders, chosen by `step`. Each gets only the props it needs. */}
      {step === 0 && <DetailsStep form={form} onChange={updateField} errors={fieldErrors} loading={loading} onSubmit={submitDetails} />}
      {step === WORKSPACE && (
        <WorkspaceStep
          form={form}
          onChange={updateField}
          errors={fieldErrors}
          loading={loading}
          onSubmit={submitWorkspace}
          onBack={() => { setError(''); setStep(0); }}
          locations={locations}
          locationsError={locationsError}
          onRetry={loadLocations}
        />
      )}
      {step === VERIFY && <VerifyEmailStep loading={loading} onSubmit={verifyEmail} onResend={resendEmail} />}
      {step === DONE && <DoneStep name={`${form.firstName} ${form.lastName}`.trim()} email={email} />}
    </AuthShell>
  );
}
