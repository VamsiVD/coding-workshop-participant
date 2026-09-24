// One note in a ticket's activity thread, with inline Edit and Delete for the
// people allowed to change it (its author, or an admin). Shared by the
// employee, admin and engineer drawers so all three behave the same.
// It holds only the edit draft; saving and deleting are the parent's handlers.
import { useState } from 'react';
import { Box, Button, TextField } from '@mui/material';
import { admin } from '../../../theme/adminTheme';

// [CONCEPT: Props] `canManage` decides whether the Edit/Delete links show; `when` is the
// already-formatted time ("3h ago"). onSave(id, text) and onDelete(id) resolve true on success.
export default function NoteItem({ note, when, canManage, busy, borderColor, onSave, onDelete }) {
  // [CONCEPT: useState] null: just showing the note. A string: the text being edited in place.
  const [editText, setEditText] = useState(null);
  // True while the "Delete this note?" confirmation is showing.
  const [confirming, setConfirming] = useState(false);
  // True while this note's save or delete is in flight, so its buttons cannot be pressed twice.
  const [working, setWorking] = useState(false);
  const disabled = busy || working;

  // Only leaves edit mode when the save worked, so a failed save keeps the typed text.
  const save = async () => {
    const text = editText.trim();
    if (!text) return;
    if (text === note.text) { setEditText(null); return; }
    setWorking(true);
    const ok = await onSave(note.id, text);
    setWorking(false);
    if (ok) setEditText(null);
  };
  // On success the note leaves the list and this component unmounts, so there is nothing to reset.
  const remove = async () => {
    setWorking(true);
    if (await onDelete(note.id)) return;
    setWorking(false);
    setConfirming(false);
  };

  // Small text-style action links under the note.
  const link = { minWidth: 0, p: 0, fontSize: 12, textTransform: 'none', color: admin.muted, '&:hover': { bgcolor: 'transparent', color: admin.ink } };

  return (
    <Box sx={{ borderLeft: `2px solid ${borderColor}`, py: 0.25, pl: 1.5, fontSize: 14, lineHeight: 1.45 }}>
      <Box sx={{ fontSize: 12, color: admin.muted, mb: 0.25 }}><Box component="span" sx={{ fontWeight: 500, color: admin.ink }}>{note.author}</Box> · {when}</Box>

      {/* [CONCEPT: Conditional rendering] Either the edit box or the note text, never both. */}
      {editText !== null ? (
        <Box sx={{ display: 'grid', gap: 1, mt: 0.5 }}>
          {/* [CONCEPT: Controlled input] The box shows `editText`; Escape cancels without saving. */}
          <TextField
            autoFocus
            multiline
            size="small"
            fullWidth
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setEditText(null)}
            slotProps={{ htmlInput: { 'aria-label': 'Edit note', maxLength: 5000 } }}
            sx={{ '& .MuiOutlinedInput-root': { bgcolor: admin.surface } }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" variant="contained" disabled={disabled || !editText.trim()} onClick={save}>Save</Button>
            <Button size="small" variant="text" color="secondary" onClick={() => setEditText(null)}>Cancel</Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ whiteSpace: 'pre-wrap' }}>{note.text}</Box>
      )}

      {/* [CONCEPT: Role-based rendering] Only the author (or an admin) gets the actions; the server enforces the same rule. */}
      {canManage && editText === null && (
        confirming ? (
          // [CONCEPT: Accessibility] role="alert" announces the confirmation question to screen readers.
          <Box role="alert" sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, fontSize: 12.5, color: admin.dangerFg }}>
            Delete this note?
            <Button size="small" color="primary" disabled={disabled} onClick={remove} sx={{ ...link, color: admin.red, fontWeight: 600 }}>Delete</Button>
            <Button size="small" onClick={() => setConfirming(false)} sx={link}>Cancel</Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 1.5, mt: 0.25 }}>
            <Button size="small" disabled={disabled} onClick={() => setEditText(note.text)} sx={link} aria-label={`Edit note from ${note.author}`}>Edit</Button>
            <Button size="small" disabled={disabled} onClick={() => setConfirming(true)} sx={link} aria-label={`Delete note from ${note.author}`}>Delete</Button>
          </Box>
        )
      )}
    </Box>
  );
}
