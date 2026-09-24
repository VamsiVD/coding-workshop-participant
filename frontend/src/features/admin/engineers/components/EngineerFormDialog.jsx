// Add / edit dialog for an engineer profile. Holds the form draft and its
// errors; saving is delegated to the page, whose promise either resolves (the
// dialog closes) or rejects with field errors shown under the inputs.
import { useEffect, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Switch, TextField } from '@mui/material';
import { useMediaQuery } from 'react-responsive';
import { admin } from '../../../../theme/adminTheme';
import { CAPACITY_MAX, CAPACITY_MIN, EMAIL_DOMAIN, EMPTY_FORM, PASSWORD_MIN, formFrom, toPayload, validateEngineer } from '../engineersModel';

// [CONCEPT: Props] `engineer` null means "add"; an EngineerProfile means "edit". `open` controls visibility
// separately so the dialog can animate closed while still showing its last contents.
export default function EngineerFormDialog({ open, engineer: incoming, categories, onClose, onSave }) {
  // The engineer captured when the dialog opened; kept while it animates closed so the title does not flip to "Add".
  const [engineer, setEngineer] = useState(incoming);
  const isNew = !engineer;
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  // A server message with no matching field (e.g. a network failure).
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  // [CONCEPT: Responsive design] Full-screen on phones, where a centred dialog would be cramped.
  const phone = useMediaQuery({ maxWidth: 599 });

  // [CONCEPT: useEffect] Reset the draft each time the dialog opens, from the engineer being edited or blank.
  useEffect(() => {
    if (!open) return;
    setEngineer(incoming);
    setForm(incoming ? formFrom(incoming) : EMPTY_FORM);
    setErrors({});
    setFormError('');
    setSaving(false);
  }, [open, incoming]);

  // [CONCEPT: Event handling] One change handler for every field; editing a field clears its error.
  const set = (key) => (e) => {
    const value = key === 'isAvailable' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((errs) => (errs[key] ? { ...errs, [key]: undefined } : errs));
  };

  // [CONCEPT: Form submission] Validate locally first; only a clean form reaches the server.
  const submit = async (e) => {
    e.preventDefault();
    const found = validateEngineer(form, isNew);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await onSave(toPayload(form, isNew));
    } catch (err) {
      // Field errors go under their inputs; the headline message is shown only when no field explains it.
      const fields = err.fields ?? {};
      setErrors(fields);
      setFormError(Object.keys(fields).length ? '' : err.message);
      setSaving(false);
    }
  };

  // Shared props for the text inputs: value, change handler and error state by field name.
  const field = (key) => ({ value: form[key], onChange: set(key), error: !!errors[key], helperText: errors[key], fullWidth: true, size: 'small' });

  return (
    <Dialog slotProps={{ paper: { component: 'form', onSubmit: submit, noValidate: true, sx: { bgcolor: admin.bg, borderRadius: phone ? 0 : '16px' } } }}
      open={open}
      onClose={saving ? undefined : onClose}
      fullScreen={phone}
      fullWidth
      maxWidth="sm"
     
    >
      <DialogTitle sx={{ fontWeight: 600, fontSize: 20, borderBottom: `1px solid ${admin.line}` }}>
        {isNew ? 'Add engineer' : `Edit ${engineer.name}`}
      </DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '20px !important' }}>
        {formError && <Alert severity="error">{formError}</Alert>}
        {/* [CONCEPT: Controlled input] Every input's value comes from `form`, and every keystroke goes through set(). */}
        <TextField label="Full name" required autoFocus {...field('name')} />
        {/* [CONCEPT: Conditional rendering] Email and password make the account, so they are only asked for once, on create. */}
        {isNew ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField label="Work email" required type="email" autoComplete="off" placeholder={`name@${EMAIL_DOMAIN}`} {...field('email')} />
            <TextField
              label="Temporary password"
              required
              type="password"
              autoComplete="new-password"
              {...field('password')}
              helperText={errors.password ?? `At least ${PASSWORD_MIN} characters; share it with the engineer.`}
            />
          </Box>
        ) : (
          <TextField label="Work email" value={engineer.email} size="small" disabled helperText="The sign-in email cannot be changed." />
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField select label="Specialisation" {...field('specializationId')}>
            <MenuItem value="">None (general facilities)</MenuItem>
            {/* [CONCEPT: List rendering and keys] Category ids are unique. */}
            {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.label}</MenuItem>)}
            {/* Keep a now-inactive specialisation selectable, so the current value still displays. */}
            {engineer?.specializationId && !categories.some((c) => c.id === engineer.specializationId) && (
              <MenuItem value={engineer.specializationId}>{engineer.specialization}</MenuItem>
            )}
          </TextField>
          <TextField label="Phone" type="tel" placeholder="Optional" {...field('phone')} />
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, alignItems: 'start' }}>
          <TextField slotProps={{ htmlInput: { min: CAPACITY_MIN, max: CAPACITY_MAX, step: 1 } }}
            label="Max active tickets"
            type="number"
           
            {...field('capacity')}
            helperText={errors.capacity ?? 'Open, in-progress and blocked tickets they can hold.'}
          />
          <FormControlLabel
            sx={{ mt: 0.5 }}
            control={<Switch checked={form.isAvailable} onChange={set('isAvailable')} color="primary" />}
            label="Available for new work"
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${admin.line}` }}>
        <Button color="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : isNew ? 'Create engineer' : 'Save changes'}</Button>
      </DialogActions>
    </Dialog>
  );
}
