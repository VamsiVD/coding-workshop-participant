// Admin engineers page (/admin/engineers): the facility admin creates
// engineer profiles, edits them, switches availability and deactivates
// accounts. Data and server calls live in useAdminEngineers.
import { useMemo, useState } from 'react';
import { Alert, Box, Button, CircularProgress, InputAdornment, Snackbar, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { admin } from '../../../theme/adminTheme';
import useAdminEngineers from './useAdminEngineers';
import { FILTERS, isFull } from './engineersModel';
import EngineerTable from './components/EngineerTable';
import EngineerFormDialog from './components/EngineerFormDialog';
import DeactivateDialog from './components/DeactivateDialog';

// [CONCEPT: Component] Page shell: header, filters, table and the two dialogs.
export default function AdminEngineersPage() {
  const { engineers, categories, loadError, reload, create, update, setAvailable, deactivate } = useAdminEngineers();
  const [filter, setFilter] = useState('active');
  const [query, setQuery] = useState('');
  // Form dialog: closed, 'new', or the engineer being edited.
  const [editing, setEditing] = useState(null);
  const [retiring, setRetiring] = useState(null);
  // Id whose availability switch is saving.
  const [pending, setPending] = useState(null);
  // One toast at a time: { severity, text }.
  const [toast, setToast] = useState(null);

  // [CONCEPT: useMemo] Filter, search and sort, re-run only when an input changes.
  const rows = useMemo(() => {
    if (!engineers) return [];
    const q = query.trim().toLowerCase();
    return engineers
      .filter(FILTERS[filter][1])
      .filter((e) => !q || [e.name, e.email, e.specialization ?? '', e.phone ?? ''].join(' ').toLowerCase().includes(q))
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
  }, [engineers, filter, query]);

  // [CONCEPT: Loading and error state] Spinner until the first load; a retry button if it failed.
  if (!engineers) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        {loadError
          ? <Alert severity="error" action={<Button color="inherit" size="small" onClick={reload}>Retry</Button>}>{loadError}</Alert>
          : <CircularProgress color="secondary" />}
      </Box>
    );
  }

  // [CONCEPT: Derived state] Header counts come from the list on each render.
  const active = engineers.filter((e) => e.isActive);
  const available = active.filter((e) => e.isAvailable && !isFull(e)).length;
  const full = active.filter(isFull).length;

  // The dialog awaits this; a rejection (with field errors) keeps it open.
  const save = async (payload) => {
    if (editing === 'new') {
      const created = await create(payload);
      setToast({ severity: 'success', text: `${created.name} added. Share their temporary password with them.` });
    } else {
      const saved = await update(editing.id, payload);
      setToast({ severity: 'success', text: `${saved.name} updated` });
    }
    setEditing(null);
  };

  const toggle = async (e, isAvailable) => {
    setPending(e.id);
    try {
      await setAvailable(e.id, isAvailable);
      setToast({ severity: 'success', text: `${e.name} is now ${isAvailable ? 'available' : 'unavailable'}` });
    } catch (err) {
      setToast({ severity: 'error', text: err.message });
    }
    setPending(null);
  };

  const retire = async (e) => {
    await deactivate(e.id);
    setRetiring(null);
    setToast({ severity: 'success', text: `${e.name} deactivated` });
  };

  return (
    <Box component="main" sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, sm: 3.5 }, pt: 4, pb: 8, display: 'grid', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: admin.brown, mb: 0.5 }}>Operations</Typography>
          <Typography variant="h1">Engineers</Typography>
          <Typography sx={{ mt: 0.5, fontSize: 14, color: admin.muted }}>
            {active.length} active · {available} free for new work · {full} at capacity
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>Add engineer</Button>
      </Box>

      <Box component="section" sx={{ border: `1px solid ${admin.line}`, borderRadius: '12px', overflow: 'hidden', bgcolor: admin.surface }}>
        <Box sx={{ p: '12px 16px', borderBottom: `1px solid ${admin.line}`, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* [CONCEPT: MUI component] Exclusive toggle group; clicking the selected one sends null, which is ignored. */}
          <ToggleButtonGroup
            exclusive
            size="small"
            value={filter}
            onChange={(_, v) => v && setFilter(v)}
            sx={{ flexWrap: 'wrap', '& .MuiToggleButton-root': { textTransform: 'none', px: 1.5, color: admin.ink }, '& .Mui-selected': { bgcolor: `${admin.red} !important`, color: '#fff !important' } }}
          >
            {Object.entries(FILTERS).map(([k, [label]]) => <ToggleButton key={k} value={k}>{label}</ToggleButton>)}
          </ToggleButtonGroup>
          <Typography sx={{ fontSize: 13, color: admin.muted }}>{rows.length} {rows.length === 1 ? 'engineer' : 'engineers'}</Typography>
          {/* [CONCEPT: Controlled input] Search text lives in state and re-filters the rows as you type. */}
          <TextField slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            size="small"
            placeholder="Search name, email, specialisation"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ ml: { sm: 'auto' }, flex: { xs: '1 1 100%', sm: '0 1 300px' }, minWidth: 0, '& .MuiOutlinedInput-root': { bgcolor: admin.bg } }}
           
          />
        </Box>

        {/* [CONCEPT: Conditional rendering] Empty states differ: no engineers at all vs. nothing matching the view. */}
        {rows.length > 0 ? (
          <EngineerTable engineers={rows} pending={pending} onEdit={setEditing} onToggle={toggle} onDeactivate={setRetiring} />
        ) : (
          <Box sx={{ py: 6, px: 2, textAlign: 'center', fontSize: 14, color: admin.muted, display: 'grid', gap: 1.5, justifyItems: 'center' }}>
            {engineers.length === 0 ? (
              <>
                No engineer profiles yet.
                <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setEditing('new')}>Add the first engineer</Button>
              </>
            ) : 'No engineers match this view.'}
          </Box>
        )}
      </Box>

      {/* [CONCEPT: Lifting state up] The dialogs hold only drafts; which engineer is open, and saving, live here. */}
      <EngineerFormDialog
        open={editing !== null}
        engineer={editing === 'new' ? null : editing}
        categories={categories}
        onClose={() => setEditing(null)}
        onSave={save}
      />
      <DeactivateDialog engineer={retiring} onClose={() => setRetiring(null)} onConfirm={retire} />

      <Snackbar open={!!toast} autoHideDuration={4500} onClose={() => setToast(null)}>
        {/* Snackbar needs a single element child; a fallback keeps it valid while the toast closes. */}
        {toast ? <Alert severity={toast.severity} onClose={() => setToast(null)}>{toast.text}</Alert> : <span />}
      </Snackbar>
    </Box>
  );
}
