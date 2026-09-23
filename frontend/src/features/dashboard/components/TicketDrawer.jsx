import { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, IconButton, Link, OutlinedInput, Stack } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { crate, fonts } from '../../../theme/crateTheme';
import { flowBars, timeAgo } from '../ticketModel';

const dt = { fontFamily: fonts.heading, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', opacity: 0.75 };
const smallBtn = { minHeight: 38, px: 1.75, fontSize: 12, letterSpacing: '.12em' };

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
      PaperProps={{ sx: { width: 460, maxWidth: '100%', bgcolor: crate.paper, borderLeft: `2px solid ${crate.ink}` } }}
      slotProps={{ backdrop: { sx: { bgcolor: 'rgba(42,29,20,.55)' } } }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2.25, py: 1.5, bgcolor: crate.ink, color: crate.paper, borderTop: `4px solid ${crate.red}`, position: 'sticky', top: 0, zIndex: 1 }}>
        <Box component="span" sx={{ fontFamily: fonts.heading, fontWeight: 600, fontSize: 20, letterSpacing: '.06em' }}>{ticket.ref}</Box>
        <IconButton onClick={onClose} aria-label="Close" sx={{ color: crate.paper, border: `1.5px solid ${crate.paper}`, borderRadius: 0, width: 40, height: 40 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Stack spacing={2} sx={{ p: 2.25 }}>
        <div>
          <Box sx={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>{ticket.title}</Box>
          <Box sx={{ fontSize: 13, mt: 0.5 }}>{location}{ticket.seat ? ` · Seat ${ticket.seat}` : ''}</Box>
        </div>

        <Box role="img" aria-label={`Status: ${ticket.status}`} sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.5 }}>
          {flowBars(ticket.status).map((b) => (
            <Box key={b.name} sx={{ display: 'grid', gap: 0.625, textAlign: 'center' }}>
              <Box component="span" sx={{ height: 6, bgcolor: b.color }} />
              <Box component="span" sx={{ fontFamily: fonts.heading, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: b.current ? 600 : 400 }}>{b.name}</Box>
            </Box>
          ))}
        </Box>

        {ticket.status === 'Blocked' && ticket.blockedReason && (
          <Box sx={{ border: `2px solid ${crate.red}`, bgcolor: crate.field, px: 1.5, py: 1.25, fontSize: 13.5, lineHeight: 1.45 }}>
            <Box component="b" sx={{ color: crate.red }}>Blocked:</Box> {ticket.blockedReason}
          </Box>
        )}

        {ticket.status === 'Resolved' && (
          <Stack spacing={1.25} sx={{ border: `2px solid ${crate.ink}`, bgcolor: crate.field, p: 1.5 }}>
            <Box sx={{ fontSize: 13.5, lineHeight: 1.45 }}><b>Is it fixed?</b> {ticket.engineer} marked this resolved. Confirm, or reopen it if the problem is still there.</Box>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" disabled={busy} onClick={() => onConfirm(ticket.ref)} sx={{ ...smallBtn, boxShadow: `2px 2px 0 ${crate.ink}` }}>Yes, it’s fixed</Button>
              <Button variant="outlined" disabled={busy} onClick={() => onReopen(ticket.ref)} sx={smallBtn}>Reopen</Button>
            </Stack>
          </Stack>
        )}

        <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25, fontSize: 13, borderTop: `2px solid ${crate.ink}`, borderBottom: `2px solid ${crate.ink}`, py: 1.5 }}>
          {[
            ['Engineer', ticket.engineer ?? 'Unassigned'],
            ['Priority', `${ticket.priority}${ticket.escalationRequested ? ' · escalation requested' : ''}`],
            ['Category', ticket.category],
            ['Reported', timeAgo(ticket.createdAt)],
          ].map(([k, v]) => (
            <div key={k}>
              <Box component="dt" sx={dt}>{k}</Box>
              <Box component="dd" sx={{ m: 0, mt: 0.25 }}>{v}</Box>
            </div>
          ))}
        </Box>

        {canEscalate && (
          ticket.escalationRequested
            ? <Box sx={{ fontSize: 13 }}>Escalation requested · waiting for admin</Box>
            : <Link component="button" type="button" onClick={() => setEscalateOpen(true)} sx={{ fontSize: 13, alignSelf: 'flex-start' }}>Request escalation</Link>
        )}

        <Stack spacing={1}>
          <Box sx={{ fontFamily: fonts.heading, fontWeight: 600, fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase' }}>Notes</Box>
          {canNote && (
            <Box component="form" onSubmit={send} sx={{ display: 'flex', gap: 1 }}>
              <OutlinedInput
                placeholder="Add a note for the engineer"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                inputProps={{ 'aria-label': 'Add a note' }}
                sx={{ flex: 1, minWidth: 0, '& input': { py: '9px', px: '10px', fontSize: 13.5 } }}
              />
              <Button type="submit" variant="contained" color="secondary" disabled={busy || !draft.trim()} sx={{ minHeight: 40, px: 1.75, fontSize: 12, boxShadow: 'none', border: `2px solid ${crate.ink}` }}>Send</Button>
            </Box>
          )}
          {ticket.notes?.map((n) => (
            <Box key={n.id} sx={{ bgcolor: n.mine ? crate.tint : crate.field, border: `1.5px solid ${crate.ink}`, px: 1.25, py: 1, fontSize: 13, lineHeight: 1.45 }}>
              <Box sx={{ fontSize: 11.5, mb: 0.25 }}><b>{n.author}</b> · {timeAgo(n.createdAt)}</Box>
              {n.text}
            </Box>
          ))}
        </Stack>
      </Stack>

      <Dialog open={escalateOpen} onClose={() => setEscalateOpen(false)} PaperProps={{ sx: { border: `2px solid ${crate.ink}`, boxShadow: `6px 6px 0 ${crate.ink}`, bgcolor: crate.paper } }}>
        <DialogTitle sx={{ fontFamily: fonts.heading, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', fontSize: 18 }}>Request escalation</DialogTitle>
        <DialogContent>
          <Box sx={{ fontSize: 13.5, mb: 1.5 }}>For safety risks, or when a whole team can’t work. A facility admin reviews every request.</Box>
          <OutlinedInput
            autoFocus
            fullWidth
            multiline
            minRows={3}
            placeholder="Why does this need escalating?"
            value={escalateReason}
            onChange={(e) => setEscalateReason(e.target.value)}
            inputProps={{ 'aria-label': 'Reason for escalation' }}
            sx={{ p: 0, '& textarea': { p: '10px', fontSize: 14 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" onClick={() => setEscalateOpen(false)} sx={smallBtn}>Cancel</Button>
          <Button variant="contained" disabled={!escalateReason.trim() || busy} onClick={submitEscalation} sx={{ ...smallBtn, boxShadow: `2px 2px 0 ${crate.ink}` }}>Send request</Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
}
