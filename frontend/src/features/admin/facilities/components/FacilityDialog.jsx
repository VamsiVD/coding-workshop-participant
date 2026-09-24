// Shared frame for the building, floor and seat forms: a dialog whose paper is
// the <form>, with a title, an optional headline error and Cancel / Save.
// Full-screen on phones, like the other admin dialogs.
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { useMediaQuery } from 'react-responsive';
import { admin } from '../../../../theme/adminTheme';

// [CONCEPT: Children prop] The caller's inputs arrive as `children`; this component only draws the frame.
export default function FacilityDialog({ open, title, context, submitLabel, saving, formError, onClose, onSubmit, children }) {
  // [CONCEPT: Responsive design] Full-screen on phones, where a centred dialog would be cramped.
  const phone = useMediaQuery({ maxWidth: 599 });

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullScreen={phone}
      fullWidth
      maxWidth="xs"
      slotProps={{ paper: { component: 'form', onSubmit, noValidate: true, sx: { bgcolor: admin.bg, borderRadius: phone ? 0 : '16px' } } }}
    >
      <DialogTitle sx={{ borderBottom: `1px solid ${admin.line}` }}>
        {/* Which building or floor this belongs to, so the admin knows where the new item will go. */}
        {context && <Typography component="span" sx={{ display: 'block', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: admin.brown }}>{context}</Typography>}
        <Box component="span" sx={{ display: 'block', fontWeight: 600, fontSize: 20, overflowWrap: 'anywhere' }}>{title}</Box>
      </DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '20px !important' }}>
        {formError && <Alert severity="error">{formError}</Alert>}
        {children}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${admin.line}` }}>
        <Button color="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : submitLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}
