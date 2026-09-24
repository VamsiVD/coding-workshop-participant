// Confirmation step for changing someone's role. Explains what they gain and
// lose; promoting to engineer also asks for the engineer profile settings.
// The server may still refuse (403 yourself, 409 last admin or active
// tickets); that message is shown here, in place.
import { useEffect, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { useMediaQuery } from 'react-responsive';
import { admin } from '../../../../theme/adminTheme';
import { EMPTY_PROFILE, ROLE_LABEL, roleEffects, toProfile, validateProfile, withArticle } from '../peopleModel';
import EngineerProfileFields from './EngineerProfileFields';

// [CONCEPT: Props] `change` is { person, role } or null (closed). `heldTickets` is the engineer's
// active ticket count if known, for an early warning. onConfirm returns the action's promise.
export default function RoleChangeDialog({ change, categories, heldTickets, onClose, onConfirm }) {
  // Kept while the dialog animates closed, so the text does not vanish.
  const [shown, setShown] = useState(change);
  const [form, setForm] = useState(EMPTY_PROFILE);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // [CONCEPT: Responsive design] Full-screen on phones, where the profile fields would be cramped.
  const phone = useMediaQuery({ maxWidth: 599 });

  // [CONCEPT: useEffect] Fresh draft each time a new change is opened.
  useEffect(() => {
    if (!change) return;
    setShown(change);
    setForm(EMPTY_PROFILE);
    setErrors({});
    setError('');
    setBusy(false);
  }, [change]);

  const person = shown?.person;
  const to = shown?.role;
  const promoting = to === 'engineer';
  const { gains, loses, notes } = person ? roleEffects(person.role, to) : { gains: [], loses: [], notes: [] };

  const set = (key) => (e) => {
    const value = key === 'isAvailable' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((errs) => (errs[key] ? { ...errs, [key]: undefined } : errs));
  };

  // [CONCEPT: Form submission] Engineer settings are validated and sent only for a promotion.
  const submit = async (e) => {
    e.preventDefault();
    const found = promoting ? validateProfile(form) : {};
    setErrors(found);
    setError('');
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await onConfirm(person, { role: to, ...(promoting ? { engineer: toProfile(form) } : {}) });
    } catch (err) {
      // Field errors go under the inputs; refusals (403/409) have none and show as the alert.
      const fields = err.fields ?? {};
      setErrors(fields);
      setError(Object.keys(fields).length ? '' : err.message);
      setBusy(false);
    }
  };

  return (
    <Dialog slotProps={{ paper: { component: 'form', onSubmit: submit, noValidate: true, sx: { bgcolor: admin.bg, borderRadius: phone ? 0 : '16px' } } }}
      open={!!change}
      onClose={busy ? undefined : onClose}
      fullScreen={phone}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle sx={{ fontWeight: 600, fontSize: 20, borderBottom: `1px solid ${admin.line}` }}>
        Make {person?.name} {to ? withArticle(to) : ''}?
      </DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '20px !important' }}>
        <Typography sx={{ fontSize: 14, color: admin.muted }}>
          {person ? `${ROLE_LABEL[person.role]} → ${ROLE_LABEL[to]} · ${person.email}` : ''}
        </Typography>
        {/* [CONCEPT: List rendering and keys] The sentences are unique, so each doubles as its key. */}
        <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'grid', gap: 0.75, fontSize: 14.5, lineHeight: 1.5 }}>
          {gains.map((t) => <li key={t}>{t}</li>)}
          {loses.map((t) => <Box component="li" key={t} sx={{ color: admin.dangerFg }}>{t}</Box>)}
          {notes.map((t) => <Box component="li" key={t} sx={{ color: admin.muted }}>{t}</Box>)}
        </Box>
        {/* Early warning from the workload report; the server still makes the final check. */}
        {person?.role === 'engineer' && heldTickets > 0 && !error && (
          <Alert severity="warning">They currently hold {heldTickets} active {heldTickets === 1 ? 'ticket' : 'tickets'}. Reassign them first.</Alert>
        )}
        {/* [CONCEPT: Conditional rendering] Only a promotion to engineer needs the profile settings. */}
        {promoting && (
          <>
            <Typography variant="h4">Engineer profile</Typography>
            <EngineerProfileFields form={form} errors={errors} categories={categories} onChange={set} disabled={busy} />
          </>
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${admin.line}` }}>
        <Button color="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={busy}>{busy ? 'Saving…' : `Make ${to ?? ''}`}</Button>
      </DialogActions>
    </Dialog>
  );
}
