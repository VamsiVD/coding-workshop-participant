// Confirmation step before deactivating an engineer, or (mode="reactivate")
// bringing an inactive one back. The server refuses a deactivation (409) while
// they still hold tickets; any refusal is shown here, in place.
import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { admin } from '../../../../theme/adminTheme';

// `engineer` null keeps the dialog closed; onConfirm returns the action's promise.
export default function DeactivateDialog({ engineer, onClose, onConfirm, mode = 'deactivate' }) {
  const reviving = mode === 'reactivate';
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Remember the last engineer so the text does not vanish while the dialog animates closed.
  const [shown, setShown] = useState(engineer);

  useEffect(() => {
    if (engineer) { setShown(engineer); setError(''); setBusy(false); }
  }, [engineer]);

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm(engineer);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const held = shown?.activeTickets;

  return (
    <Dialog slotProps={{ paper: { sx: { bgcolor: admin.bg, borderRadius: '16px' } } }} open={!!engineer} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: 20 }}>{reviving ? 'Reactivate' : 'Deactivate'} {shown?.name}?</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 1.5 }}>
        <Typography sx={{ fontSize: 14.5, lineHeight: 1.5 }}>
          {reviving
            ? 'They can sign in again and be assigned tickets. Their engineer profile is as they left it.'
            : 'They will no longer be able to sign in or be assigned tickets. Their past work stays on record. You can reactivate them later.'}
        </Typography>
        {/* Early warning from the workload report; the server still makes the final check. */}
        {!reviving && held > 0 && !error && (
          <Alert severity="warning">They currently hold {held} active {held === 1 ? 'ticket' : 'tickets'}. Reassign them first.</Alert>
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={confirm} disabled={busy}>{busy ? (reviving ? 'Reactivating…' : 'Deactivating…') : (reviving ? 'Reactivate' : 'Deactivate')}</Button>
      </DialogActions>
    </Dialog>
  );
}
