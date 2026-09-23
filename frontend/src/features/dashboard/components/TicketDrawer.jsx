import { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, IconButton, TextField, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { admin } from '../../../theme/adminTheme';
import { flowBars, timeAgo } from '../ticketModel';

export default function TicketDrawer({ ticket, location, open, onClose, onConfirm, onReopen, onEscalate, onAddNote, busy }) {
  const [draft, setDraft] = useState('');
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');

  if (!ticket) return null;
  const canNote = ticket.status !== 'Closed';
  const canEscalate = ticket.status !== 'Resolved' && ticket.status !== 'Closed';

  const send = async (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    await onAddNote(ticket.ref, draft.trim());
    setDraft('');
  };

  const submitEscalation = async () => {
    if (!escalateReason.trim()) return;
    await onEscalate(ticket.ref, escalateReason.trim());
    setEscalateOpen(false);
    setEscalateReason('');
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: 460, maxWidth: '100%', bgcolor: admin.bg, borderRadius: '16px 0 0 16px' } }}
      slotProps={{ backdrop: { sx: { bgcolor: 'rgba(42,29,20,.45)' } } }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, p: '14px 20px', borderBottom: `1px solid ${admin.line}`, position: 'sticky', top: 0, bgcolor: admin.bg, zIndex: 1 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 18, color: admin.brown }}>{ticket.ref}</Typography>
        <IconButton aria-label="Close" onClick={onClose} sx={{ border: `1px solid ${admin.line}`, borderRadius: '8px' }}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <Box sx={{ p: 2.5, display: 'grid', gap: 2.75 }}>
        <div>
          <Typography variant="h3">{ticket.title}</Typography>
          <Typography sx={{ fontSize: 13.5, mt: 0.5, color: admin.muted }}>{location}{ticket.seat ? ` · Seat ${ticket.seat}` : ''}</Typography>
        </div>

        <Box role="img" aria-label={`Status: ${ticket.status}`} sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px' }}>
          {flowBars(ticket.status).map((b) => (
            <Box key={b.name} sx={{ display: 'grid', gap: 0.75 }}>
              <Box component="span" sx={{ height: 4, borderRadius: 2, bgcolor: b.color }} />
              <Box component="span" sx={{ fontSize: 11.5, color: b.current ? admin.ink : admin.faint, fontWeight: b.current ? 500 : 400 }}>{b.name}</Box>
            </Box>
          ))}
        </Box>

        {ticket.status === 'Blocked' && ticket.blockedReason && (
          <Box sx={{ border: '1px solid oklch(0.8 0.08 25)', borderRadius: '10px', bgcolor: 'oklch(0.96 0.02 25)', p: '12px 16px', fontSize: 14, lineHeight: 1.5, color: admin.dangerFg }}>
            <b style={{ fontWeight: 500 }}>Blocked:</b> {ticket.blockedReason}
          </Box>
        )}

        {ticket.status === 'Resolved' && (
          <Box sx={{ border: `1px solid ${admin.tan}`, borderRadius: '10px', bgcolor: admin.sand, p: '14px 16px', display: 'grid', gap: 1.25 }}>
            <Typography sx={{ fontWeight: 600, fontSize: 16 }}>Is it fixed?</Typography>
            <Typography sx={{ fontSize: 14, lineHeight: 1.5 }}>{ticket.engineer} marked this resolved. Confirm, or reopen it if the problem is still there.</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button variant="contained" disabled={busy} onClick={() => onConfirm(ticket.ref)}>Yes, it’s fixed</Button>
              <Button variant="outlined" color="secondary" disabled={busy} onClick={() => onReopen(ticket.ref)} sx={{ bgcolor: admin.bg }}>Reopen</Button>
            </Box>
          </Box>
        )}

        <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.75, fontSize: 14, borderTop: `1px solid ${admin.line}`, borderBottom: `1px solid ${admin.line}`, py: 1.75 }}>
          {[
            ['Engineer', ticket.engineer ?? 'Unassigned'],
            ['Priority', `${ticket.priority}${ticket.escalationRequested ? ' · escalation requested' : ''}`],
            ['Category', ticket.category],
            ['Reported', timeAgo(ticket.createdAt)],
          ].map(([k, v]) => (
            <div key={k}>
              <Box component="dt" sx={{ fontSize: 12, color: admin.muted }}>{k}</Box>
              <Box component="dd" sx={{ m: 0 }}>{v}</Box>
            </div>
          ))}
        </Box>

        {canEscalate && (
          <Button
            variant="outlined"
            color="secondary"
            disabled={ticket.escalationRequested}
            onClick={() => setEscalateOpen(true)}
            sx={{ justifySelf: 'start' }}
          >
            {ticket.escalationRequested ? 'Escalation requested · waiting for admin' : 'Request escalation'}
          </Button>
        )}

        <Box sx={{ display: 'grid', gap: 1.25 }}>
          <Typography variant="h4">Activity</Typography>
          {ticket.notes?.map((n) => (
            <Box key={n.id} sx={{ borderLeft: `2px solid ${n.mine ? admin.tan : admin.red}`, py: 0.25, pl: 1.5, fontSize: 14, lineHeight: 1.45 }}>
              <Box sx={{ fontSize: 12, color: admin.muted, mb: 0.25 }}><Box component="span" sx={{ fontWeight: 500, color: admin.ink }}>{n.author}</Box> · {timeAgo(n.createdAt)}</Box>
              {n.text}
            </Box>
          ))}
          {canNote && (
            <Box component="form" onSubmit={send} sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
              <TextField size="small" fullWidth placeholder="Add a note for the engineer" value={draft} onChange={(e) => setDraft(e.target.value)} inputProps={{ 'aria-label': 'Add a note' }} />
              <Button type="submit" variant="contained" disabled={busy || !draft.trim()}>Send</Button>
            </Box>
          )}
        </Box>
      </Box>

      <Dialog open={escalateOpen} onClose={() => setEscalateOpen(false)} PaperProps={{ sx: { borderRadius: '16px', bgcolor: admin.bg } }}>
        <DialogTitle sx={{ fontWeight: 600, fontSize: 20 }}>Request escalation</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, mb: 1.5, color: '#4a3b2c' }}>For safety risks, or when a whole team can’t work. A facility admin reviews every request.</Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            placeholder="Why does this need escalating?"
            value={escalateReason}
            onChange={(e) => setEscalateReason(e.target.value)}
            inputProps={{ 'aria-label': 'Reason for escalation' }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" color="secondary" onClick={() => setEscalateOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!escalateReason.trim() || busy} onClick={submitEscalation}>Send request</Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
}
