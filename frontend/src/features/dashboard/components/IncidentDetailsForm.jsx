// Inline form for correcting an incident's title, description and category.
// Used by the reporter's ticket drawer (while the ticket is Open) and by the
// admin incident drawer (at any time). It owns only the drafts; the parent
// saves them and says whether that worked.
import { useState } from 'react';
import { Box, Button, MenuItem, TextField } from '@mui/material';
import { admin } from '../../../theme/adminTheme';

// Same limits as IncidentUpdate in the backend, so most mistakes are caught before sending.
const LIMITS = { title: [3, 160], description: [3, 5000] };

// [CONCEPT: Props] `incident` supplies the starting values ({ title, description, category, categoryId }).
// `categories` is [{ id, label }] or null while loading. onSave(changes) resolves true on success;
// `changes` holds only the fields that differ, as { title?, description?, categoryId? }.
export default function IncidentDetailsForm({ incident, categories, busy, onSave, onCancel }) {
  // Mock rows may lack categoryId, so fall back to matching the label.
  const startCategory = incident.categoryId ?? categories?.find((c) => c.label === incident.category)?.id ?? '';
  // [CONCEPT: useState] One object for the three drafts, started from the incident.
  const [form, setForm] = useState({ title: incident.title ?? '', description: incident.description ?? '', categoryId: startCategory });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // [CONCEPT: Form validation] Length checks mirror the server's; Save stays disabled until they pass.
  const tooShort = (k) => form[k].trim().length < LIMITS[k][0];
  const invalid = tooShort('title') || tooShort('description');

  // [CONCEPT: Form submission] preventDefault keeps the browser from posting the form; only changed fields are sent.
  const submit = async (e) => {
    e.preventDefault();
    if (invalid) return;
    const changes = {};
    if (form.title.trim() !== incident.title) changes.title = form.title.trim();
    if (form.description.trim() !== (incident.description ?? '')) changes.description = form.description.trim();
    if (form.categoryId !== '' && form.categoryId !== startCategory) changes.categoryId = form.categoryId;
    // Nothing changed: just close, no request.
    if (!Object.keys(changes).length) { onCancel(); return; }
    await onSave(changes);
  };

  return (
    <Box component="form" onSubmit={submit} aria-label="Edit incident details" sx={{ display: 'grid', gap: 1.5, border: `1px solid ${admin.line}`, borderRadius: '10px', bgcolor: admin.surface, p: '14px 16px' }}>
      {/* [CONCEPT: Controlled input] Each field reads from `form` and writes back through set(). */}
      <TextField
        size="small"
        label="Title"
        value={form.title}
        onChange={(e) => set('title', e.target.value)}
        error={form.title !== '' && tooShort('title')}
        helperText={form.title !== '' && tooShort('title') ? 'At least 3 characters.' : ' '}
        slotProps={{ htmlInput: { maxLength: LIMITS.title[1] } }}
      />
      <TextField
        size="small"
        label="Description"
        multiline
        minRows={3}
        value={form.description}
        onChange={(e) => set('description', e.target.value)}
        error={form.description !== '' && tooShort('description')}
        helperText={form.description !== '' && tooShort('description') ? 'At least 3 characters.' : ' '}
        slotProps={{ htmlInput: { maxLength: LIMITS.description[1] } }}
      />
      {/* [CONCEPT: Loading and error state] The picker is disabled until the categories arrive. */}
      <TextField select size="small" label="Category" value={categories ? form.categoryId : ''} disabled={!categories} onChange={(e) => set('categoryId', e.target.value)}>
        {!categories && <MenuItem value="">Loading…</MenuItem>}
        {/* The current category may be inactive and missing from the list; keep it pickable by label. */}
        {categories && form.categoryId === '' && <MenuItem value="" disabled>{incident.category}</MenuItem>}
        {/* [CONCEPT: List rendering and keys] Category ids are unique keys. */}
        {categories?.map((c) => <MenuItem key={c.id} value={c.id}>{c.label}</MenuItem>)}
      </TextField>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button type="submit" variant="contained" disabled={busy || invalid}>Save changes</Button>
        <Button variant="text" color="secondary" onClick={onCancel}>Cancel</Button>
      </Box>
    </Box>
  );
}
