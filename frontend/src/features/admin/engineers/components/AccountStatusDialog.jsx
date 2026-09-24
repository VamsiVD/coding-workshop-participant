// Confirmation step before deactivating or reactivating an account from the
// people list. The server refuses (403 yourself, 409 last admin or an
// engineer with active tickets); that message is shown here, in place.
import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { useMediaQuery } from 'react-responsive';
import { admin } from '../../../../theme/adminTheme';

// `person` null keeps the dialog closed; the action is the opposite of their current status.
// onConfirm(person, isActive) returns the action's promise.
export default function AccountStatusDialog({ person, heldTickets, onClose, onConfirm }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Remember the last person so the text does not vanish while the dialog animates closed.
  const [shown, setShown] = useState(person);
  const phone = useMediaQuery({ maxWidth: 599 });

  useEffect(() => {
    if (person) { setShown(person); setError(''); setBusy(false); }
  }, [person]);

  const activating = shown ? !shown.isActive : false;

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm(person, activating);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Dialog slotProps={{ paper: { sx: { bgcolor: admin.bg, borderRadius: phone ? 0 : '16px' } } }} open={!!person} onClose={busy ? undefined : onClose} fullScreen={phone} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: 20 }}>{activating ? 'Reactivate' : 'Deactivate'} {shown?.name}?</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 1.5 }}>
        {/* [CONCEPT: Conditional rendering] The explanation depends on the direction and on their role. */}
        <Typography sx={{ fontSize: 14.5, lineHeight: 1.5 }}>
          {activating
            ? 'They will be able to sign in again with their existing password.'
            : 'They will no longer be able to sign in. Their incidents and past work stay on record, and you can reactivate them later.'}
          {!activating && shown?.role === 'engineer' && ' They also stop being offered new tickets.'}
          {!activating && shown?.role === 'admin' && ' At least one active admin must remain.'}
        </Typography>
        {/* Early warning from the workload report; the server still makes the final check. */}
        {!activating && shown?.role === 'engineer' && heldTickets > 0 && !error && (
          <Alert severity="warning">They currently hold {heldTickets} active {heldTickets === 1 ? 'ticket' : 'tickets'}. Reassign them first.</Alert>
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={confirm} disabled={busy}>
          {busy ? 'Saving…' : activating ? 'Reactivate' : 'Deactivate'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
