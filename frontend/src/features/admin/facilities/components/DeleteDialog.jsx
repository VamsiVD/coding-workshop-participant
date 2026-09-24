// Confirmation step before deleting a building, floor or seat. The server
// refuses (409) while the item is still in use; that message is shown here, in
// place, with an optional way out such as "Deactivate instead".
import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { admin } from '../../../../theme/adminTheme';

// [CONCEPT: Props] `target` null keeps the dialog closed; otherwise { name, what, warning?, alternative? }.
// onConfirm returns the delete's promise; alternative.run returns its own.
export default function DeleteDialog({ target, onClose, onConfirm }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Keep the last target so the text does not vanish while the dialog animates closed.
  const [shown, setShown] = useState(target);

  useEffect(() => {
    if (target) { setShown(target); setError(''); setBusy(false); }
  }, [target]);

  const run = (action) => async () => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const alt = shown?.alternative;

  return (
    <Dialog slotProps={{ paper: { sx: { bgcolor: admin.bg, borderRadius: '16px', mx: 2 } } }} open={!!target} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: 20, overflowWrap: 'anywhere' }}>Delete {shown?.name}?</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 1.5 }}>
        <Typography sx={{ fontSize: 14.5, lineHeight: 1.5 }}>
          This permanently removes the {shown?.what}. Only items with nothing on them and no incident history can be deleted.
        </Typography>
        {/* Early warning from the counts on screen; the server still makes the final check. */}
        {shown?.warning && !error && <Alert severity="warning">{shown.warning}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button color="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        {alt && <Button variant="outlined" onClick={run(alt.run)} disabled={busy}>{alt.label}</Button>}
        <Button variant="contained" onClick={run(onConfirm)} disabled={busy}>{busy ? 'Working…' : 'Delete'}</Button>
      </DialogActions>
    </Dialog>
  );
}
