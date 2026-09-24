// Side drawer for one ticket on the engineer workbench. For a pool job: request
// or withdraw. For an assigned ticket: move it through the workflow and talk to
// the reporter through notes.
import { useEffect, useState } from 'react';
import { Box, Button, Drawer, IconButton, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { admin } from '../../../theme/adminTheme';
import { PRIORITY_TAG, flowBars, timeAgo } from '../engineerModel';
import NoteItem from '../../dashboard/components/NoteItem';

// Wording for the reason box shown before a Blocked or Resolved change is saved.
const REASON = {
  Blocked: { label: 'What’s blocking it?', placeholder: 'e.g. Waiting for a replacement part', confirm: 'Mark blocked', border: 'oklch(0.8 0.08 25)', bg: 'oklch(0.96 0.02 25)' },
  Resolved: { label: 'What did you fix?', placeholder: 'e.g. Replaced the faulty cable', confirm: 'Mark resolved', border: admin.tan, bg: admin.sand },
};

// Two-column label/value list (a <dl>) for the incident's key facts.
const Meta = ({ rows }) => (
  <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.75, fontSize: 14, borderTop: `1px solid ${admin.line}`, borderBottom: `1px solid ${admin.line}`, py: 1.75 }}>
    {rows.map(([k, v]) => (
      <div key={k}><Box component="dt" sx={{ fontSize: 12, color: admin.muted }}>{k}</Box><Box component="dd" sx={{ m: 0 }}>{v}</Box></div>
    ))}
  </Box>
);

// [CONCEPT: Props] Everything the drawer changes goes back to the page through callback props.
// onEditNote and onDeleteNote resolve true on success and false on failure.
export default function EngineerDrawer({ incident, myId, open, onClose, onRequest, onWithdraw, onStatus, onAddNote, onEditNote, onDeleteNote, busy }) {
  const [pending, setPending] = useState(null);
  const [reason, setReason] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [draft, setDraft] = useState('');

  // [CONCEPT: useEffect] Opening a different ticket clears any half-typed reason, request note or reply.
  useEffect(() => { setPending(null); setReason(''); setRequestNote(''); setDraft(''); }, [incident?.ref]);

  if (!incident) return null;
  const mine = incident.assigneeId === myId;
  const inPool = !incident.assigneeId;
  const [pBg, pFg] = PRIORITY_TAG[incident.priority];
  const location = [incident.buildingName, incident.floor && `Floor ${incident.floor}`, incident.seat].filter(Boolean).join(' · ');

  // Blocked and Resolved need a reason first; In Progress is saved straight away.
  const pick = (st) => {
    if (!st) return;
    if (st === 'Blocked' || st === 'Resolved') { setPending(st); setReason(''); return; }
    setPending(null);
    onStatus(incident.ref, st);
  };
  const confirm = async () => {
    if (!reason.trim()) return;
    await onStatus(incident.ref, pending, reason.trim());
    setPending(null);
    setReason('');
  };
  // [CONCEPT: Form submission] preventDefault keeps the browser from reloading the page on submit.
  const send = async (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    await onAddNote(incident.ref, draft.trim());
    setDraft('');
  };

  return (
    <Drawer slotProps={{ backdrop: { sx: { bgcolor: 'rgba(42,29,20,.45)' } }, paper: { sx: { width: 480, maxWidth: '100%', bgcolor: admin.bg, borderRadius: '16px 0 0 16px' } } }}
      anchor="right"
      open={open}
      onClose={onClose}
     
     
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, p: '14px 20px', borderBottom: `1px solid ${admin.line}`, position: 'sticky', top: 0, bgcolor: admin.bg, zIndex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 18, color: admin.brown }}>{incident.ref}</Typography>
          <Box component="span" sx={{ px: 1.25, py: 0.25, borderRadius: 999, fontSize: 12, fontWeight: 500, bgcolor: pBg, color: pFg }}>{incident.priority}</Box>
        </Box>
        <IconButton aria-label="Close" onClick={onClose} sx={{ border: `1px solid ${admin.line}`, borderRadius: '8px' }}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <Box sx={{ p: 2.5, display: 'grid', gap: 2.75 }}>
        <div>
          <Typography variant="h3">{incident.title}</Typography>
          <Typography sx={{ fontSize: 13.5, mt: 0.5, color: admin.muted }}>{location}</Typography>
        </div>

        <Box role="img" aria-label={`Status: ${incident.status}`} sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px' }}>
          {flowBars(incident.status).map((b) => (
            <Box key={b.name} sx={{ display: 'grid', gap: 0.75 }}>
              <Box component="span" sx={{ height: 4, borderRadius: 2, bgcolor: b.color }} />
              <Box component="span" sx={{ fontSize: 11.5, color: b.current ? admin.ink : admin.faint, fontWeight: b.current ? 500 : 400 }}>{b.name}</Box>
            </Box>
          ))}
        </Box>

        <Meta rows={[['Category', incident.category], ['Status', incident.status], ['Reported by', incident.reporter], ['Age', timeAgo(incident.createdAt).replace(' ago', ' old')]]} />

        {/* [CONCEPT: Conditional rendering] Pool jobs offer a request; my own tickets offer status and notes. */}
        {inPool && (
          <Box sx={{ border: `1px solid ${admin.tan}`, borderRadius: '10px', bgcolor: admin.sand, p: '14px 16px', display: 'grid', gap: 1.5 }}>
            <Typography sx={{ fontWeight: 600, fontSize: 16 }}>{incident.requestedByMe ? 'Request sent' : 'Want this job?'}</Typography>
            {incident.requestedByMe ? (
              <>
                <Typography sx={{ fontSize: 14 }}>Your request is waiting for an admin to confirm.</Typography>
                <Button variant="outlined" color="secondary" disabled={busy} onClick={() => onWithdraw(incident.ref)} sx={{ justifySelf: 'start', bgcolor: admin.bg }}>Withdraw request</Button>
              </>
            ) : (
              <>
                <TextField size="small" label="Note to admin (optional)" placeholder="e.g. I’m on floor 7 this afternoon" value={requestNote} onChange={(e) => setRequestNote(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { bgcolor: admin.surface } }} />
                <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Button variant="contained" disabled={busy} onClick={() => onRequest(incident.ref, requestNote.trim())}>Request this job</Button>
                  <Box component="span" sx={{ fontSize: 12.5, color: admin.muted }}>An admin confirms the assignment.</Box>
                </Box>
              </>
            )}
          </Box>
        )}

        {mine && (
          <>
            <Box sx={{ display: 'grid', gap: 1.25 }}>
              <Typography variant="h4">Update status</Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                value={pending || incident.status}
                onChange={(_, v) => pick(v)}
                aria-label="Update status"
                disabled={busy}
                sx={{
                  '& .MuiToggleButton-root': { textTransform: 'none', fontSize: 13.5, py: 1, whiteSpace: 'nowrap', color: admin.ink, borderColor: admin.line, '&.Mui-selected, &.Mui-selected:hover': { bgcolor: admin.red, color: '#fff' } },
                  '& .MuiToggleButton-root[value="Blocked"].Mui-selected': { bgcolor: admin.danger },
                }}
              >
                <ToggleButton value="In Progress">{incident.status === 'Open' ? 'Start work' : 'In progress'}</ToggleButton>
                <ToggleButton value="Blocked">Blocked</ToggleButton>
                <ToggleButton value="Resolved">Resolved</ToggleButton>
              </ToggleButtonGroup>
              {pending && (
                <Box sx={{ border: `1px solid ${REASON[pending].border}`, borderRadius: '10px', bgcolor: REASON[pending].bg, p: '14px 16px', display: 'grid', gap: 1.25 }}>
                  <TextField size="small" autoFocus label={REASON[pending].label} placeholder={REASON[pending].placeholder} value={reason} onChange={(e) => setReason(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { bgcolor: admin.surface } }} />
                  <Typography sx={{ fontSize: 12.5, color: admin.muted }}>The reporter sees this as a note on their ticket.</Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button variant="contained" disabled={busy || !reason.trim()} onClick={confirm}>{REASON[pending].confirm}</Button>
                    <Button variant="outlined" color="secondary" onClick={() => setPending(null)} sx={{ bgcolor: admin.bg }}>Cancel</Button>
                  </Box>
                </Box>
              )}
            </Box>

            <Box sx={{ display: 'grid', gap: 1.25 }}>
              <Typography variant="h4">Notes with {incident.reporter}</Typography>
              {!incident.detailLoaded && <Typography sx={{ fontSize: 13.5, color: admin.muted }}>Loading notes…</Typography>}
              {/* [CONCEPT: Role-based rendering] Only my own notes get Edit and Delete (`mine` compares the author with my id). */}
              {incident.notes?.map((n) => (
                <NoteItem
                  key={n.id}
                  note={n}
                  when={timeAgo(n.createdAt)}
                  canManage={n.mine}
                  busy={busy}
                  borderColor={n.mine ? admin.red : admin.tan}
                  onSave={(id, text) => onEditNote(incident.ref, id, text)}
                  onDelete={(id) => onDeleteNote(incident.ref, id)}
                />
              ))}
              <Box component="form" onSubmit={send} sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                <TextField slotProps={{ htmlInput: { 'aria-label': 'Write to the reporter' } }} size="small" fullWidth placeholder="Write to the reporter" value={draft} onChange={(e) => setDraft(e.target.value)} />
                <Button type="submit" variant="contained" disabled={busy || !draft.trim()}>Send</Button>
              </Box>
            </Box>
          </>
        )}
      </Box>
    </Drawer>
  );
}
