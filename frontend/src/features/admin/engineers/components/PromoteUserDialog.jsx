// "Promote existing user" dialog on the Engineers tab: search active
// employees, pick one, fill in their engineer profile and promote them
// (PATCH /users/{id} role engineer). Two steps in one dialog: pick, then set up.
import { useEffect, useState } from 'react';
import { Alert, Box, Button, ButtonBase, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useMediaQuery } from 'react-responsive';
import { admin } from '../../../../theme/adminTheme';
import { EMPTY_PROFILE, toProfile, validateProfile } from '../peopleModel';
import EngineerProfileFields from './EngineerProfileFields';

// Results shown at once; the search narrows a long list.
const SHOWN = 8;
const DEBOUNCE_MS = 300;

// [CONCEPT: Props] onSearch(q) resolves with matching employees; onPromote(person, profile) returns the action's promise.
export default function PromoteUserDialog({ open, categories, onSearch, onClose, onPromote }) {
  const [query, setQuery] = useState('');
  // null while a search is running (or before the first one); then Person[].
  const [results, setResults] = useState(null);
  const [searchError, setSearchError] = useState('');
  // The employee picked in step 1; null means "still searching".
  const [picked, setPicked] = useState(null);
  const [form, setForm] = useState(EMPTY_PROFILE);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // [CONCEPT: Responsive design] Full-screen on phones.
  const phone = useMediaQuery({ maxWidth: 599 });

  // [CONCEPT: useEffect] A clean dialog each time it opens.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setPicked(null);
    setForm(EMPTY_PROFILE);
    setErrors({});
    setError('');
    setBusy(false);
  }, [open]);

  // [CONCEPT: Async data fetching] Search after a typing pause; `stale` drops answers to an older query.
  useEffect(() => {
    if (!open || picked) return undefined;
    let stale = false;
    const t = setTimeout(async () => {
      setResults(null);
      setSearchError('');
      try {
        const list = await onSearch(query);
        if (!stale) setResults(list);
      } catch (e) {
        if (!stale) { setSearchError(e.message); setResults([]); }
      }
    }, DEBOUNCE_MS);
    return () => { stale = true; clearTimeout(t); };
  }, [open, picked, query, onSearch]);

  const set = (key) => (e) => {
    const value = key === 'isAvailable' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((errs) => (errs[key] ? { ...errs, [key]: undefined } : errs));
  };

  // [CONCEPT: Form submission] Validate the profile locally; the server has the last word (e.g. 409).
  const submit = async (e) => {
    e.preventDefault();
    if (!picked) return;
    const found = validateProfile(form);
    setErrors(found);
    setError('');
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await onPromote(picked, toProfile(form));
    } catch (err) {
      const fields = err.fields ?? {};
      setErrors(fields);
      setError(Object.keys(fields).length ? '' : err.message);
      setBusy(false);
    }
  };

  const term = query.trim();

  return (
    <Dialog slotProps={{ paper: { component: 'form', onSubmit: submit, noValidate: true, sx: { bgcolor: admin.bg, borderRadius: phone ? 0 : '16px' } } }}
      open={open}
      onClose={busy ? undefined : onClose}
      fullScreen={phone}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle sx={{ fontWeight: 600, fontSize: 20, borderBottom: `1px solid ${admin.line}` }}>Promote existing user</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '20px !important', alignContent: 'start' }}>
        {/* [CONCEPT: Conditional rendering] Step 1 (search and pick) until someone is picked, then step 2 (profile). */}
        {!picked ? (
          <>
            <Typography sx={{ fontSize: 14, color: admin.muted }}>
              Pick an employee to make them an engineer. They keep their account and password.
            </Typography>
            {/* [CONCEPT: Controlled input] The search text lives in state; the effect above searches on a pause. */}
            <TextField slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
              label="Search employees"
              placeholder="Name or email"
              size="small"
              fullWidth
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              helperText={term.length === 1 ? 'Type at least 2 characters' : ' '}
            />
            {searchError && <Alert severity="error">{searchError}</Alert>}
            {/* [CONCEPT: Loading and error state] Spinner while searching, then results or an empty message. */}
            {!results ? (
              <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}><CircularProgress size={28} color="secondary" /></Box>
            ) : results.length === 0 ? (
              !searchError && (
                <Box sx={{ py: 3, textAlign: 'center', fontSize: 14, color: admin.muted }}>
                  {term.length >= 2 ? `No active employees match “${term}”.` : 'There are no active employees to promote.'}
                </Box>
              )
            ) : (
              <Box role="group" aria-label="Matching employees" sx={{ display: 'grid', gap: 1 }}>
                {/* [CONCEPT: List rendering and keys] One tile per employee; user ids are unique. */}
                {results.slice(0, SHOWN).map((p) => (
                  // [CONCEPT: Accessibility] ButtonBase is a real button: keyboard focus, Enter/Space, and a spoken name.
                  <ButtonBase
                    key={p.id}
                    aria-label={`Pick ${p.name}`}
                    onClick={() => setPicked(p)}
                    sx={{ display: 'grid', justifyContent: 'stretch', alignContent: 'start', justifyItems: 'start', textAlign: 'left', p: '10px 14px', borderRadius: '10px', border: `1px solid ${admin.line}`, bgcolor: admin.surface, '&:hover, &.Mui-focusVisible': { borderColor: admin.red } }}
                  >
                    <Box sx={{ fontWeight: 500, fontSize: 14.5 }}>{p.name}</Box>
                    <Box sx={{ fontSize: 12.5, color: admin.muted, wordBreak: 'break-all' }}>{p.email}</Box>
                  </ButtonBase>
                ))}
                {results.length > SHOWN && (
                  <Typography sx={{ fontSize: 13, color: admin.muted }}>Showing {SHOWN} of {results.length}. Type to narrow the list.</Typography>
                )}
              </Box>
            )}
          </>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '10px 14px', borderRadius: '10px', border: `1px solid ${admin.line}`, bgcolor: admin.sand }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ fontWeight: 500 }}>{picked.name}</Box>
                <Box sx={{ fontSize: 12.5, color: admin.muted, wordBreak: 'break-all' }}>{picked.email}</Box>
              </Box>
              <Button size="small" color="secondary" onClick={() => { setPicked(null); setError(''); }} disabled={busy}>Change</Button>
            </Box>
            <Typography sx={{ fontSize: 14, color: admin.muted }}>
              They get the engineer workbench and appear on the Engineers list. Set up their profile:
            </Typography>
            <EngineerProfileFields form={form} errors={errors} categories={categories} onChange={set} disabled={busy} />
          </>
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${admin.line}` }}>
        <Button color="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={busy || !picked}>{busy ? 'Promoting…' : 'Promote to engineer'}</Button>
      </DialogActions>
    </Dialog>
  );
}
