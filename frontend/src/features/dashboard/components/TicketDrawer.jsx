// Right-hand drawer showing one of the employee's own tickets: progress,
// details and notes, plus the reporter's actions (confirm or reopen a fix,
// request escalation, add a note, correct the details while the ticket is
// Open, edit or delete their own notes). Actions are the page's handlers.
import { useEffect, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, IconButton, TextField, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { admin } from '../../../theme/adminTheme';
import { flowBars, timeAgo } from '../ticketModel';
import NoteItem from './NoteItem';
import IncidentDetailsForm from './IncidentDetailsForm';

// [CONCEPT: Props] onAddNote, onEditTicket, onEditNote and onDeleteNote resolve true on success and
// false on failure, so the drawer only clears a draft or closes an editor once the server has it.
// `categories` ([{ id, label }] or null) feeds the edit form; onNeedCategories asks the page to load them.
export default function TicketDrawer({ ticket, location, open, onClose, onConfirm, onReopen, onEscalate, onAddNote, onEditTicket, onEditNote, onDeleteNote, categories, onNeedCategories, busy }) {
  // [CONCEPT: useState] Local drafts only: the note text, and the escalation dialog's open flag and reason.
  const [draft, setDraft] = useState('');
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  // True while the details edit form replaces the title block.
  const [editing, setEditing] = useState(false);

  // [CONCEPT: useEffect] Keyed on the ref, not the object: opening a different ticket clears the drafts
  // (so an unsent note cannot carry over to the wrong ticket), but a refresh of the same ticket does not.
  useEffect(() => {
    setDraft('');
    setEscalateOpen(false);
    setEscalateReason('');
    setEditing(false);
  }, [ticket?.ref]);

  // [CONCEPT: Conditional rendering] Early return after all hooks (hooks must run in the same order every render).
  if (!ticket) return null;
  // Closed is final: no notes. Escalation only makes sense while work is still outstanding.
  const canNote = ticket.status !== 'Closed';
  const canEscalate = ticket.status !== 'Resolved' && ticket.status !== 'Closed';
  // The reporter may correct the details only until work starts (the server enforces the same rule).
  const canEdit = ticket.status === 'Open';

  // [CONCEPT: Form submission] preventDefault stops the browser's full-page form post; the note goes through the API instead.
  // The draft is cleared only when the page reports the note was saved, so a failed send keeps the text.
  const send = async (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    if (await onAddNote(ticket.ref, draft.trim())) setDraft('');
  };

  // Opens the details editor and asks the page for the category list the first time.
  const startEdit = () => {
    onNeedCategories();
    setEditing(true);
  };
  const saveDetails = async (changes) => {
    if (await onEditTicket(ticket.ref, changes)) setEditing(false);
  };

  // [CONCEPT: Form validation] A reason is required; the Send request button is also disabled while it is blank.
  // The dialog stays open with the reason if the request failed.
  const submitEscalation = async () => {
    if (!escalateReason.trim()) return;
    if (!(await onEscalate(ticket.ref, escalateReason.trim()))) return;
    setEscalateOpen(false);
    setEscalateReason('');
  };

  return (
    // [CONCEPT: MUI component] MUI Drawer provides the slide-in panel, backdrop, Escape-to-close and focus handling.
    <Drawer slotProps={{ backdrop: { sx: { bgcolor: 'rgba(42,29,20,.45)' } }, paper: { sx: { width: 460, maxWidth: '100%', bgcolor: admin.bg, borderRadius: '16px 0 0 16px' } } }}
      anchor="right"
      open={open}
      onClose={onClose}
     
     
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, p: '14px 20px', borderBottom: `1px solid ${admin.line}`, position: 'sticky', top: 0, bgcolor: admin.bg, zIndex: 1 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 18, color: admin.brown }}>{ticket.ref}</Typography>
        <IconButton aria-label="Close" onClick={onClose} sx={{ border: `1px solid ${admin.line}`, borderRadius: '8px' }}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <Box sx={{ p: 2.5, display: 'grid', gap: 2.75 }}>
        {/* [CONCEPT: Conditional rendering] The edit form replaces the title block while editing. */}
        {editing ? (
          <IncidentDetailsForm incident={ticket} categories={categories} busy={busy} onSave={saveDetails} onCancel={() => setEditing(false)} />
        ) : (
          <div>
            <Typography variant="h3">{ticket.title}</Typography>
            <Typography sx={{ fontSize: 13.5, mt: 0.5, color: admin.muted }}>{location}{ticket.seat ? ` · Seat ${ticket.seat}` : ''}</Typography>
            {ticket.description && <Typography sx={{ fontSize: 14, mt: 1.25, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{ticket.description}</Typography>}
            {/* The description arrives with the full ticket, so Edit waits for it (a list row has none). */}
            {canEdit ? (
              <Button size="small" variant="outlined" color="secondary" disabled={busy || ticket.description === undefined} onClick={startEdit} sx={{ mt: 1.25 }}>Edit details</Button>
            ) : (
              <Typography sx={{ fontSize: 12.5, mt: 1, color: admin.faint }}>Details can’t be changed once work has started. Add a note instead.</Typography>
            )}
          </div>
        )}

        {/* [CONCEPT: Accessibility] The bars are purely visual, so role="img" with an aria-label reads the status as one phrase. */}
        <Box role="img" aria-label={`Status: ${ticket.status}`} sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px' }}>
          {/* [CONCEPT: List rendering and keys] flowBars returns one entry per status; the status name is the key. */}
          {flowBars(ticket.status).map((b) => (
            <Box key={b.name} sx={{ display: 'grid', gap: 0.75 }}>
              <Box component="span" sx={{ height: 4, borderRadius: 2, bgcolor: b.color }} />
              <Box component="span" sx={{ fontSize: 11.5, color: b.current ? admin.ink : admin.faint, fontWeight: b.current ? 500 : 400 }}>{b.name}</Box>
            </Box>
          ))}
        </Box>

        {/* blockedReason only exists on the full ticket, so this appears once getTicket has loaded it. */}
        {ticket.status === 'Blocked' && ticket.blockedReason && (
          <Box sx={{ border: '1px solid oklch(0.8 0.08 25)', borderRadius: '10px', bgcolor: 'oklch(0.96 0.02 25)', p: '12px 16px', fontSize: 14, lineHeight: 1.5, color: admin.dangerFg }}>
            <b style={{ fontWeight: 500 }}>Blocked:</b> {ticket.blockedReason}
          </Box>
        )}

        {/* The reporter closes the loop: confirming moves the ticket to Closed, reopening sends it back to In Progress. */}
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
          {/* [CONCEPT: Component composition] NoteItem draws the note and, for my own notes on a ticket that is
              not Closed, inline Edit and Delete. */}
          {ticket.notes?.map((n) => (
            <NoteItem
              key={n.id}
              note={n}
              when={timeAgo(n.createdAt)}
              canManage={n.mine && canNote}
              busy={busy}
              borderColor={n.mine ? admin.tan : admin.red}
              onSave={(id, text) => onEditNote(ticket.ref, id, text)}
              onDelete={(id) => onDeleteNote(ticket.ref, id)}
            />
          ))}
          {/* A real <form>, so pressing Enter in the field submits it. */}
          {canNote && (
            <Box component="form" onSubmit={send} sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
              {/* [CONCEPT: Controlled input] value comes from `draft` state and each keystroke calls setDraft. */}
              <TextField slotProps={{ htmlInput: { 'aria-label': 'Add a note' } }} size="small" fullWidth placeholder="Add a note for the engineer" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <Button type="submit" variant="contained" disabled={busy || !draft.trim()}>Send</Button>
            </Box>
          )}
        </Box>
      </Box>

      {/* Modal dialog for the escalation reason, opened by the Request escalation button. */}
      <Dialog slotProps={{ paper: { sx: { borderRadius: '16px', bgcolor: admin.bg } } }} open={escalateOpen} onClose={() => setEscalateOpen(false)}>
        <DialogTitle sx={{ fontWeight: 600, fontSize: 20 }}>Request escalation</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, mb: 1.5, color: '#4a3b2c' }}>For safety risks, or when a whole team can’t work. A facility admin reviews every request.</Typography>
          <TextField slotProps={{ htmlInput: { 'aria-label': 'Reason for escalation' } }}
            autoFocus
            fullWidth
            multiline
            minRows={3}
            placeholder="Why does this need escalating?"
            value={escalateReason}
            onChange={(e) => setEscalateReason(e.target.value)}
           
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
