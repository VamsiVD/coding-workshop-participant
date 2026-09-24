// Small dialog to correct someone's display name. Anyone may be renamed,
// including the signed-in admin; the sign-in email stays as it is.
import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { useMediaQuery } from 'react-responsive';
import { admin } from '../../../../theme/adminTheme';
import { validateName } from '../peopleModel';

// `person` null keeps the dialog closed; onSave(person, name) returns the action's promise.
export default function RenameDialog({ person, onClose, onSave }) {
  const [shown, setShown] = useState(person);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const phone = useMediaQuery({ maxWidth: 599 });

  // [CONCEPT: useEffect] Start from the current name each time the dialog opens.
  useEffect(() => {
    if (!person) return;
    setShown(person);
    setName(person.name);
    setNameError('');
    setError('');
    setBusy(false);
  }, [person]);

  const submit = async (e) => {
    e.preventDefault();
    const problem = validateName(name);
    setNameError(problem);
    setError('');
    if (problem) return;
    setBusy(true);
    try {
      await onSave(person, name.trim());
    } catch (err) {
      setNameError(err.fields?.name ?? '');
      setError(err.fields?.name ? '' : err.message);
      setBusy(false);
    }
  };

  return (
    <Dialog slotProps={{ paper: { component: 'form', onSubmit: submit, noValidate: true, sx: { bgcolor: admin.bg, borderRadius: phone ? 0 : '16px' } } }}
      open={!!person}
      onClose={busy ? undefined : onClose}
      fullScreen={phone}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle sx={{ fontWeight: 600, fontSize: 20 }}>Rename {shown?.name}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        {/* [CONCEPT: Controlled input] The draft name lives in state; typing clears its error. */}
        <TextField
          label="Full name"
          required
          autoFocus
          size="small"
          fullWidth
          value={name}
          onChange={(e) => { setName(e.target.value); setNameError(''); }}
          error={!!nameError}
          helperText={nameError || shown?.email}
          disabled={busy}
        />
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={busy}>{busy ? 'Saving…' : 'Save name'}</Button>
      </DialogActions>
    </Dialog>
  );
}
