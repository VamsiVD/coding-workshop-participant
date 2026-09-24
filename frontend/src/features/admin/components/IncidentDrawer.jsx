// Right-hand drawer showing one incident's details and actions for an admin:
// assign an engineer, move the status, decide an escalation, answer engineers'
// job requests, add, edit and delete notes, correct the details, and delete the incident.
// It holds only form drafts; the incident and all actions come from the page.
import { useEffect, useState } from 'react';
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, IconButton, MenuItem, TextField, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { admin } from '../../../theme/adminTheme';
import { NEXT_STATUSES, PRIORITY_STYLE, STATUSES, age, isBlocked, isEscalation } from '../adminModel';
import NoteItem from '../../dashboard/components/NoteItem';
import IncidentDetailsForm from '../../dashboard/components/IncidentDetailsForm';

// [CONCEPT: Props] `incident` is undefined when nothing is open; the on* callbacks are the hook's actions passed down by the page.
// `requests` are the pending job requests on this incident (oldest first).
// onNote, onEditNote, onDeleteNote, onUpdate and onDelete resolve true on success and false on failure.
// `categories` ([{ id, label }] or null) feeds the edit form; onNeedCategories asks for them to be loaded.
export default function IncidentDrawer({ incident, engineers, requests = [], categories, onClose, onAssign, onStatus, onDecide, onNote, onEditNote, onDeleteNote, onNeedCategories, onUpdate, onDelete, onApproveRequest, onDeclineRequest }) {
  // [CONCEPT: useState] Local, unsaved text for the note box.
  const [draft, setDraft] = useState('');
  // null: not blocking. A string: the reason being typed for a move to Blocked.
  const [blockReason, setBlockReason] = useState(null);
  // Id of the job request being approved or declined, so its buttons cannot be pressed twice.
  const [answering, setAnswering] = useState(null);
  // True while the details edit form replaces the title block.
  const [editing, setEditing] = useState(false);
  // Delete confirmation dialog: open flag, and whether the delete is in flight.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // [CONCEPT: useEffect] Keyed on the ref, not the object: clear the drafts when a different incident opens,
  // but not when the same incident is refreshed after an update.
  useEffect(() => { setDraft(''); setBlockReason(null); setEditing(false); setConfirmDelete(false); }, [incident?.ref]);

  // [CONCEPT: Derived state] Everything below is computed from props each render. The `i ?` guards (rather than
  // an early return) keep the Drawer mounted with no incident, so it can animate closed.
  const i = incident;
  const at = i ? STATUSES.indexOf(i.status) : -1;
  const [pBg, pFg] = i ? PRIORITY_STYLE[i.priority] : [];
  const closed = i?.status === 'Closed';
  // Current status first (so the select can show it), then only the moves the backend allows.
  const statusOptions = i ? [i.status, ...NEXT_STATUSES[i.status]] : [];
  // The picker lists engineers who can take work, plus whoever already has it.
  const pickable = i ? engineers.filter((e) => e.availability !== 'On leave' || e.id === i.assigneeId) : [];
  // False when the assignee is missing from the engineer list entirely (e.g. deactivated);
  // an extra menu item is then added so the select still has a matching value.
  const assigneeListed = i ? pickable.some((e) => e.id === i.assigneeId) : true;

  // [CONCEPT: Event handling] Handlers are plain closures over the current incident and drafts.
  // The draft is cleared only once the note is saved, so a failed send keeps the text.
  const send = async () => {
    if (!draft.trim()) return;
    if (await onNote(i.ref, draft.trim())) setDraft('');
  };
  // Opens the details editor and asks for the category list the first time.
  const startEdit = () => { onNeedCategories(); setEditing(true); };
  const saveDetails = async (changes) => { if (await onUpdate(i.ref, changes)) setEditing(false); };
  // On success the page closes the drawer; on failure the dialog closes and the error toast shows.
  const confirmDeleteIncident = async () => {
    setDeleting(true);
    await onDelete(i.ref);
    setDeleting(false);
    setConfirmDelete(false);
  };
  const pickStatus = (s) => {
    if (s === i.status) return;
    // Blocked needs a reason, so ask before sending.
    if (s === 'Blocked') { setBlockReason(''); return; }
    setBlockReason(null);
    onStatus(i.ref, s);
  };
  // [CONCEPT: Form validation] An empty reason is ignored here, and the Mark blocked button is disabled for it too.
  // Awaits the page's action (which never rejects) before re-enabling the buttons.
  const answer = async (req, action) => {
    setAnswering(req.id);
    await action(req);
    setAnswering(null);
  };
  const confirmBlock = () => {
    if (!blockReason.trim()) return;
    onStatus(i.ref, 'Blocked', blockReason.trim());
    setBlockReason(null);
  };

  return (
    // [CONCEPT: MUI component] MUI Drawer handles the slide-in, backdrop, Escape key and focus trap; open follows whether an incident is set.
    <Drawer slotProps={{ backdrop: { sx: { bgcolor: 'rgba(42,29,20,.45)' } }, paper: { sx: { width: 480, maxWidth: '100%', bgcolor: admin.bg, borderRadius: '16px 0 0 16px' } } }}
      anchor="right"
      open={!!i}
      onClose={onClose}
     
     
    >
      {/* [CONCEPT: Conditional rendering] `i && (...)` renders the body only when an incident is open. */}
      {i && (
        // [CONCEPT: Accessibility] role and aria-label give screen readers a name for the drawer's content.
        <Box role="dialog" aria-label="Incident details">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, p: '14px 20px', borderBottom: `1px solid ${admin.line}`, position: 'sticky', top: 0, bgcolor: admin.bg, zIndex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 18, color: admin.brown }}>{i.ref}</Typography>
              <Chip label={i.priority} sx={{ bgcolor: pBg, color: pFg }} />
            </Box>
            <IconButton aria-label="Close" onClick={onClose} sx={{ border: `1px solid ${admin.line}`, borderRadius: '8px' }}><CloseIcon fontSize="small" /></IconButton>
          </Box>

          <Box sx={{ p: 2.5, display: 'grid', gap: 2.75 }}>
            {/* [CONCEPT: Conditional rendering] The edit form replaces the title block while editing. An admin may edit at any status. */}
            {editing ? (
              <IncidentDetailsForm incident={i} categories={categories} busy={false} onSave={saveDetails} onCancel={() => setEditing(false)} />
            ) : (
              <Box>
                <Typography variant="h3">{i.title}</Typography>
                <Typography sx={{ fontSize: 13.5, mt: 0.5, color: admin.muted }}>{[i.building, i.floor, i.seat].filter(Boolean).join(' · ')}</Typography>
                {i.description && <Typography sx={{ fontSize: 14, mt: 1.25, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{i.description}</Typography>}
                <Box sx={{ display: 'flex', gap: 1, mt: 1.25 }}>
                  {/* The description comes with the full incident, so Edit waits for detailLoaded. */}
                  <Button size="small" variant="outlined" color="secondary" disabled={!i.detailLoaded} onClick={startEdit}>Edit details</Button>
                  <Button size="small" variant="text" onClick={() => setConfirmDelete(true)} sx={{ color: admin.red }}>Delete incident</Button>
                </Box>
              </Box>
            )}

            {/* Status progress bar: past steps light, current step red (danger when Blocked), future steps grey. */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px' }}>
              {/* [CONCEPT: List rendering and keys] Status names are unique, so they serve as keys. */}
              {STATUSES.map((s, idx) => (
                <Box key={s} sx={{ display: 'grid', gap: 0.75 }}>
                  <Box sx={{ height: 4, borderRadius: 2, bgcolor: idx === at ? (s === 'Blocked' ? admin.danger : admin.red) : idx < at ? admin.tanLight : admin.track }} />
                  <Box sx={{ fontSize: 11.5, color: idx === at ? admin.ink : admin.faint, fontWeight: idx === at ? 500 : 400 }}>{s}</Box>
                </Box>
              ))}
            </Box>

            {/* A reporter asked for higher priority; approving raises it one level (see adminApi.decideEscalation). */}
            {isEscalation(i) && (
              <Box sx={{ border: `1px solid ${admin.tan}`, borderRadius: '10px', bgcolor: admin.sand, p: '14px 16px', display: 'grid', gap: 1.25 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 16 }}>Escalation requested</Typography>
                <Typography sx={{ fontSize: 14, lineHeight: 1.5 }}>{i.escalationReason ? `“${i.escalationReason}” — ` : ''}{i.reporter}</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button variant="contained" onClick={() => onDecide(i.ref, 'approve')}>Approve and raise priority</Button>
                  <Button variant="outlined" color="secondary" onClick={() => onDecide(i.ref, 'decline')} sx={{ bgcolor: admin.bg }}>Decline</Button>
                </Box>
              </Box>
            )}

            {/* Engineers asking for this job. Assigning uses the normal assign flow, after which the server drops every request here. */}
            {requests.length > 0 && (
              <Box component="section" aria-label="Job requests" sx={{ border: `1px solid ${admin.line}`, borderRadius: '10px', bgcolor: admin.surface, p: '14px 16px', display: 'grid', gap: 1.5 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 16 }}>Job requests <Box component="span" sx={{ color: admin.muted, fontWeight: 400 }}>· {requests.length}</Box></Typography>
                {requests.map((r) => {
                  const eng = engineers.find((e) => e.id === r.engineerId);
                  const busy = answering === r.id;
                  return (
                    <Box key={r.id} sx={{ display: 'grid', gap: 0.75, pt: 1.25, borderTop: `1px solid ${admin.line}`, '&:first-of-type': { borderTop: 0, pt: 0 } }}>
                      <Box sx={{ fontSize: 14 }}>
                        <Box component="span" sx={{ fontWeight: 500 }}>{r.engineerName}</Box>
                        <Box component="span" sx={{ color: admin.muted }}>{eng ? ` · ${eng.skill} · ${eng.availability}` : ''} · {age(r.createdAt)} ago</Box>
                      </Box>
                      {r.note && <Box sx={{ fontSize: 13.5, lineHeight: 1.45, color: admin.ink, borderLeft: `2px solid ${admin.tanLight}`, pl: 1.25 }}>“{r.note}”</Box>}
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button size="small" variant="contained" disabled={closed || answering !== null} onClick={() => answer(r, onApproveRequest)}>Assign to {r.engineerName}</Button>
                        <Button size="small" variant="outlined" color="secondary" disabled={answering !== null} onClick={() => answer(r, onDeclineRequest)}>{busy ? 'Working…' : 'Decline'}</Button>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}

            {isBlocked(i) && i.blockedReason && (
              <Box sx={{ border: '1px solid oklch(0.8 0.08 25)', borderRadius: '10px', bgcolor: 'oklch(0.96 0.02 25)', p: '12px 16px', fontSize: 14, lineHeight: 1.5, color: admin.dangerFg }}>
                <b style={{ fontWeight: 500 }}>Blocked:</b> {i.blockedReason}
              </Box>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.75 }}>
              {/* [CONCEPT: Controlled input] value comes from the incident; picking an engineer calls onAssign, and the
                  new value shows once the page's state updates. The current status is passed so an Open ticket also starts work. */}
              <TextField
                select
                size="small"
                label="Engineer"
                value={i.assigneeId ?? ''}
                disabled={closed}
                onChange={(e) => e.target.value !== '' && onAssign(i.ref, e.target.value, i.status)}
              >
                <MenuItem value="" disabled={Boolean(i.assigneeId)}>Unassigned</MenuItem>
                {!assigneeListed && i.assigneeId && <MenuItem value={i.assigneeId}>{i.assigneeName ?? `Engineer #${i.assigneeId}`}</MenuItem>}
                {pickable.map((e) => (
                  <MenuItem key={e.id} value={e.id}>{e.name} · {e.skill}</MenuItem>
                ))}
              </TextField>
              <TextField select size="small" label="Status" value={i.status} disabled={closed} onChange={(e) => pickStatus(e.target.value)}>
                {statusOptions.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Box>

            {/* Inline prompt shown after choosing Blocked; nothing is sent until a reason is confirmed. */}
            {blockReason !== null && (
              <Box sx={{ display: 'grid', gap: 1, border: `1px solid ${admin.line}`, borderRadius: '10px', p: '12px 16px' }}>
                <TextField
                  autoFocus
                  size="small"
                  label="Why is it blocked?"
                  placeholder="Waiting on a part, access or a vendor"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && confirmBlock()}
                />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button variant="contained" onClick={confirmBlock} disabled={!blockReason.trim()}>Mark blocked</Button>
                  <Button variant="text" color="secondary" onClick={() => setBlockReason(null)}>Cancel</Button>
                </Box>
              </Box>
            )}

            <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.75, fontSize: 14, borderTop: `1px solid ${admin.line}`, borderBottom: `1px solid ${admin.line}`, py: 1.75 }}>
              {[['Category', i.category], ['Priority', i.priority], ['Reported by', i.reporter], ['Age', age(i.createdAt)]].map(([k, v]) => (
                <div key={k}><Box component="dt" sx={{ fontSize: 12, color: admin.muted }}>{k}</Box><Box component="dd" sx={{ m: 0 }}>{v}</Box></div>
              ))}
            </Box>

            <Box sx={{ display: 'grid', gap: 1.25 }}>
              <Typography variant="h4">Activity</Typography>
              {/* [CONCEPT: Loading and error state] List rows arrive with detailLoaded false and no notes; the page's load(ref) fills them in. */}
              {!i.detailLoaded && <Box sx={{ fontSize: 13, color: admin.muted }}>Loading notes…</Box>}
              {i.detailLoaded && i.notes.length === 0 && <Box sx={{ fontSize: 13, color: admin.muted }}>No notes yet.</Box>}
              {/* [CONCEPT: Role-based rendering] This page is admin-only and an admin may edit or delete any note. */}
              {i.notes.map((n) => (
                <NoteItem
                  key={n.id}
                  note={n}
                  when={`${age(n.createdAt)} ago`}
                  canManage
                  busy={false}
                  borderColor={admin.tanLight}
                  onSave={(id, text) => onEditNote(i.ref, id, text)}
                  onDelete={(id) => onDeleteNote(i.ref, id)}
                />
              ))}
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                <TextField
                  size="small"
                  fullWidth
                  disabled={closed}
                  placeholder={closed ? 'Closed incidents take no notes' : 'Add a note for the reporter'}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                />
                <Button variant="contained" onClick={send} disabled={closed || !draft.trim()}>Send</Button>
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* [CONCEPT: MUI component] A modal Dialog asks before the permanent delete; Escape or Cancel backs out. */}
      <Dialog slotProps={{ paper: { sx: { borderRadius: '16px', bgcolor: admin.bg } } }} open={confirmDelete && !!i} onClose={() => !deleting && setConfirmDelete(false)}>
        <DialogTitle sx={{ fontWeight: 600, fontSize: 20 }}>Delete {i?.ref}?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, lineHeight: 1.5, color: admin.ink }}>
            “{i?.title}” will be removed for good, with its notes and history. The reporter and engineer will no longer see it. This can’t be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" color="secondary" disabled={deleting} onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="contained" disabled={deleting} onClick={confirmDeleteIncident}>{deleting ? 'Deleting…' : 'Delete incident'}</Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
}
