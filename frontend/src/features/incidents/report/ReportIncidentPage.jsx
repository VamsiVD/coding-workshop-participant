// "Report an incident" page for employees: a three-section form (location,
// issue, impact) with a live summary panel, a duplicate check for the chosen
// floor, and a confirmation card once the ticket is created.
import { useEffect, useMemo, useState } from 'react';
import { useMediaQuery } from 'react-responsive';
import {
  Alert, Box, Button, Checkbox, FormControl, FormControlLabel, FormHelperText, FormLabel,
  MenuItem, OutlinedInput, Select, Typography,
} from '@mui/material';
import { admin } from '../../../theme/adminTheme';
import { incidentApi } from '../../../services/incidentApi';
import FormSection from './components/FormSection';
import CategoryPicker from './components/CategoryPicker';
import SegmentedChoice from './components/SegmentedChoice';
import SimilarTickets from './components/SimilarTickets';
import SummaryPanel from './components/SummaryPanel';
import SubmittedCard from './components/SubmittedCard';
import { SCOPE, WORKING, floorLabel, groupCategories, suggestPriority, validateIncident } from './incidentModel';

// Tag colours for the suggested priority.
const PRIORITY = {
  Low: ['#ede3cf', '#4a3b2c'],
  Medium: ['#f3e6c8', admin.brown],
  High: [admin.brown, admin.surface],
  Critical: [admin.red, '#fff'],
};

// [CONCEPT: sx prop] Shared style object passed to several MUI inputs via `sx`,
// so every field looks the same without a separate stylesheet.
const inputSx = { bgcolor: admin.bg, '& .MuiOutlinedInput-input': { py: '9px', px: '12px', fontSize: 14.5 } };

// A function (not a constant) so each call returns a fresh object. It doubles
// as the lazy initialiser for useState and as the reset value after submitting.
// Field names are camelCase here and mapped to the API's snake_case in submit().
const emptyForm = () => ({
  buildingId: '',
  floorId: '',
  seatId: '',
  categoryId: '',
  title: '',
  description: '',
  scope: 'Just me',
  working: 'Partly',
  escalate: false,
  escalateReason: '',
});

// The backend has no impact fields, so the answers travel in the description
// where the assigning admin will read them.
const withImpact = (description, scope, working, priority) =>
  `${description}\n\nImpact: ${scope.toLowerCase()} affected; can keep working: ${working.toLowerCase()}. Suggested priority: ${priority}.`;

// [CONCEPT: Children prop] Small wrapper that adds a label, "(optional)" hint and
// error text around whatever input is passed in as `children`.
// `htmlFor={id}` ties the label to the input with the same id (accessibility).
function Field({ id, label, optional, error, children }) {
  return (
    <FormControl fullWidth error={Boolean(error)}>
      <FormLabel htmlFor={id} sx={{ mb: 0.75, fontSize: 13, color: admin.muted, '&.Mui-focused': { color: admin.muted } }}>
        {label}
        {optional && <Box component="span" sx={{ ml: 0.5, color: admin.faint }}>(optional)</Box>}
      </FormLabel>
      {children}
      {error && <FormHelperText sx={{ mx: 0 }}>{error}</FormHelperText>}
    </FormControl>
  );
}

// [CONCEPT: Props] Default values let the parent hide the duplicate check or the
// "What happens next" panel without passing anything in the common case.
export default function ReportIncidentPage({ showDuplicateCheck = true, showWorkflow = true }) {
  // [CONCEPT: Responsive design] Below 900px wide the summary panel stacks under
  // the form and the workflow list is hidden (see the JSX below).
  const isMobile = useMediaQuery({ maxWidth: 899 });
  // [CONCEPT: useState] Reference data from the API, the form itself, and the
  // submit lifecycle (errors, submitting, serverError, ticket) each get a slot.
  const [buildings, setBuildings] = useState([]);
  const [categories, setCategories] = useState([]);
  // Set of ids of the caller's own incidents (used by SimilarTickets).
  const [mine, setMine] = useState(() => new Set());
  // Passing the function itself (not emptyForm()) makes it a lazy initialiser.
  const [form, setForm] = useState(emptyForm);
  // { fieldName: message } for every invalid field; empty object = valid.
  const [errors, setErrors] = useState({});
  // True after the first submit attempt. Errors only show from then on, so the
  // user is not shouted at while filling the form for the first time.
  const [tried, setTried] = useState(false);
  const [similar, setSimilar] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  // The created ticket ({ ref, status, priority, escalated }); non-null swaps
  // the form for the SubmittedCard.
  const [ticket, setTicket] = useState(null);

  // [CONCEPT: Async data fetching] Runs once on mount (empty dependency array):
  // loads buildings and categories in parallel, then the caller's own ticket ids.
  // Failing to load "mine" is harmless, so that error is ignored.
  useEffect(() => {
    Promise.all([incidentApi.listBuildings(), incidentApi.listCategories()])
      .then(([b, c]) => { setBuildings(b); setCategories(c); })
      .catch(() => setServerError('Couldn’t load buildings and categories. Refresh to try again.'));
    incidentApi.listMyIncidentIds().then(setMine).catch(() => {});
  }, []);

  // [CONCEPT: useEffect] Re-fetches open tickets whenever the floor changes (and
  // after a submit/reset, via `ticket`). The `live` flag plus the cleanup
  // function drop responses from an older request if the user switches floor
  // before it returns, so a slow reply cannot overwrite a newer one.
  useEffect(() => {
    if (!showDuplicateCheck || !form.floorId) return setSimilar([]);
    let live = true;
    incidentApi.listOpenOnFloor({ floorId: form.floorId })
      .then((rows) => live && setSimilar(rows))
      .catch(() => live && setSimilar([]));
    return () => { live = false; };
  }, [form.floorId, showDuplicateCheck, ticket]);

  // [CONCEPT: useMemo] Grouping only needs to rerun when the category list changes,
  // not on every keystroke in the form.
  const groups = useMemo(() => groupCategories(categories), [categories]);
  // [CONCEPT: Derived state] Everything below is computed from state on each
  // render instead of being stored, so it can never go out of sync with the form.
  const building = buildings.find((b) => b.id === form.buildingId);
  const floor = building?.floors.find((f) => f.id === form.floorId);
  const seat = floor?.seats.find((x) => x.id === form.seatId);
  const category = categories.find((c) => c.id === form.categoryId);
  const priority = suggestPriority(form.scope, form.working);
  // e.g. "HQ North · Level 3 · HQ1-3F-A14"; missing parts are skipped.
  const location = [building?.name, floor && floorLabel(floor), seat?.code].filter(Boolean).join(' · ');
  const errorCount = useMemo(() => Object.keys(errors).length, [errors]);

  // One change handler for every field. Changing the building clears floor and
  // seat, and changing the floor clears the seat, because the old choices may
  // not exist in the new building/floor. Once the user has tried to submit,
  // errors are re-checked on every change so they disappear as fields are fixed.
  // [CONCEPT: Immutable update] Builds a new object with spread instead of
  // mutating `f`, so React sees a new reference and re-renders.
  const set = (field, value) => {
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === 'buildingId') { next.floorId = ''; next.seatId = ''; }
      if (field === 'floorId') next.seatId = '';
      if (tried) setErrors(validateIncident(next));
      return next;
    });
  };

  // [CONCEPT: Form submission] preventDefault stops the browser's full-page form
  // post; we validate first and only call the API when there are no errors.
  const submit = async (e) => {
    e.preventDefault();
    setTried(true);
    const v = validateIncident(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    // [CONCEPT: Loading and error state] `submitting` disables the button and
    // changes its label; `serverError` shows the API's message in an Alert.
    setSubmitting(true);
    setServerError('');
    try {
      // [CONCEPT: Service layer] The page never calls fetch directly: incidentApi
      // creates the ticket, then (if requested) files the escalation as a second
      // call. It resolves to { ref, status, priority, escalated }, where
      // escalated is null if only the escalation call failed.
      const res = await incidentApi.createIncident({
        building_id: form.buildingId,
        floor_id: form.floorId,
        seat_id: form.seatId || null,
        category_id: form.categoryId,
        title: form.title.trim(),
        description: withImpact(form.description.trim(), form.scope, form.working, priority),
      }, { escalationReason: form.escalate ? form.escalateReason.trim() : null });
      setTicket(res);
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    // Keep the location: a second report is usually from the same place.
    setForm((f) => ({ ...emptyForm(), buildingId: f.buildingId, floorId: f.floorId, seatId: f.seatId }));
    setErrors({});
    setTried(false);
    setTicket(null);
  };

  // Background and text colour for the suggested-priority pill.
  const [pBg, pFg] = PRIORITY[priority];
  const checkSx = { color: 'rgba(42,29,20,.35)', '&.Mui-checked': { color: admin.red }, p: 0, mr: 1.25 };

  return (
    <Box component="main" sx={{ maxWidth: 1080, mx: 'auto', px: { xs: 2, sm: 3.5 }, pt: 4, pb: 8, display: 'grid', gap: 3 }}>
      <div>
        <Typography sx={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: admin.brown, mb: 0.5 }}>New incident</Typography>
        <Typography variant="h1">Report an incident</Typography>
        <Typography sx={{ mt: 0.5, fontSize: 14, color: admin.muted }}>Tell us where and what. Follow progress from your dashboard until it’s resolved.</Typography>
      </div>

      {/* [CONCEPT: Conditional rendering] After a successful submit the whole form is replaced by the confirmation card. */}
      {ticket ? (
        <SubmittedCard ticket={ticket} location={location} onReportAnother={reset} />
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1fr) 320px', gap: 3, alignItems: 'start' }}>
          {/* noValidate turns off the browser's built-in validation popups; validateIncident() does it instead. */}
          <Box component="form" noValidate onSubmit={submit} sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
            {/* [CONCEPT: Form validation] Error summary only after the first submit attempt; per-field messages appear under each Field. */}
            {tried && errorCount > 0 && (
              <Alert severity="error" sx={{ borderRadius: '10px', border: '1px solid oklch(0.8 0.08 25)', bgcolor: 'oklch(0.96 0.02 25)', color: admin.dangerFg }}>
                <b style={{ fontWeight: 500 }}>{errorCount === 1 ? '1 field needs attention' : `${errorCount} fields need attention`}.</b> Fix the fields marked below.
              </Alert>
            )}
            {serverError && <Alert severity="error" sx={{ borderRadius: '10px' }}>{serverError}</Alert>}

            {/* [CONCEPT: Component composition] FormSection supplies the numbered card; the fields inside are passed as its children. */}
            <FormSection number="01" title="Location">
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: 1.75 }}>
                <Field id="building" label="Building" error={errors.buildingId}>
                  {/* [CONCEPT: Controlled input] The Select shows form.buildingId and reports changes through set(); React state is the single source of truth. */}
                  <Select id="building" value={form.buildingId} onChange={(e) => set('buildingId', e.target.value)} displayEmpty sx={inputSx}>
                    <MenuItem value="" disabled>Select building</MenuItem>
                    {/* [CONCEPT: List rendering and keys] One MenuItem per building, keyed by its database id. */}
                    {buildings.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                  </Select>
                </Field>
                <Field id="floor" label="Floor" error={errors.floorId}>
                  {/* Cascading dropdowns: floors come from the chosen building, so this stays disabled until one is picked. */}
                  <Select id="floor" value={form.floorId} onChange={(e) => set('floorId', e.target.value)} displayEmpty disabled={!building} sx={inputSx}>
                    <MenuItem value="" disabled>Select floor</MenuItem>
                    {(building?.floors ?? []).map((f) => <MenuItem key={f.id} value={f.id}>{floorLabel(f)}</MenuItem>)}
                  </Select>
                </Field>
                <Field id="seat" label="Desk or room" optional>
                  <Select id="seat" value={form.seatId} onChange={(e) => set('seatId', e.target.value)} displayEmpty disabled={!floor?.seats.length} sx={inputSx}>
                    <MenuItem value="">{floor?.seats.length ? 'Not at a desk or room' : 'No desks or rooms listed'}</MenuItem>
                    {/* Rooms share the list with desks (a room is a kind of seat), so they are labelled. */}
                    {(floor?.seats ?? []).map((x) => <MenuItem key={x.id} value={x.id}>{x.kind === 'room' ? `${x.code} (room)` : x.code}</MenuItem>)}
                  </Select>
                </Field>
              </Box>
              {/* Renders nothing when there are no open tickets on the chosen floor. */}
              <SimilarTickets tickets={similar} mine={mine} />
            </FormSection>

            <FormSection number="02" title="Issue">
              {/* [CONCEPT: Lifting state up] CategoryPicker holds no state of its own: the page owns form.categoryId and passes value + onChange down. */}
              <CategoryPicker groups={groups} value={form.categoryId} onChange={(c) => set('categoryId', c)} error={errors.categoryId} />
              <Field id="title" label="Title" error={errors.title}>
                <OutlinedInput id="title" placeholder="e.g. Second monitor won’t turn on" value={form.title} onChange={(e) => set('title', e.target.value)} inputProps={{ maxLength: 160 }} sx={inputSx} />
              </Field>
              <Field id="description" label="Description" error={errors.description}>
                <OutlinedInput
                  id="description"
                  multiline
                  minRows={4}
                  placeholder="What you see, since when, and anything you’ve already tried."
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  inputProps={{ maxLength: 4800 }}
                  sx={{ bgcolor: admin.bg, p: 0, '& textarea': { p: '10px 12px', fontSize: 14.5, lineHeight: 1.5 } }}
                />
              </Field>
              {/* [CONCEPT: JSX expression] Live character counter against the 20-character minimum enforced in validateIncident(). */}
              <Box sx={{ mt: -1, fontSize: 12.5, color: admin.muted, textAlign: 'right' }}>{form.description.trim().length} / 20 min</Box>
            </FormSection>

            <FormSection number="03" title="Impact">
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 2 }}>
                <SegmentedChoice id="scope" label="Who is affected?" options={SCOPE} value={form.scope} onChange={(v) => set('scope', v)} />
                <SegmentedChoice id="working" label="Can you keep working?" options={WORKING} value={form.working} onChange={(v) => set('working', v)} />
              </Box>
              <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: admin.muted }}>
                {/* Recomputed from the two impact answers on every render; advisory only, it is not sent as the ticket's priority. */}
                <span>Suggested priority</span>
                <Box component="span" sx={{ px: 1.25, py: 0.25, borderRadius: 999, fontSize: 12, fontWeight: 500, bgcolor: pBg, color: pFg }}>{priority}</Box>
                <span>A facility admin sets the priority when assigning.</span>
              </Box>
              <Box sx={{ borderTop: `1px solid ${admin.line}`, pt: 1.75 }}>
                <FormControlLabel
                  sx={{ alignItems: 'flex-start', m: 0 }}
                  control={<Checkbox checked={form.escalate} onChange={(e) => set('escalate', e.target.checked)} sx={{ ...checkSx, mt: '1px' }} />}
                  label={<Box component="span" sx={{ fontSize: 14, lineHeight: 1.45 }}><Box component="span" sx={{ fontWeight: 500 }}>Request escalation</Box> <Box component="span" sx={{ color: admin.muted }}>for safety risks or when a team can’t work. Reviewed by an admin.</Box></Box>}
                />
              </Box>
              {/* The reason field only appears (and is only validated) when escalation is ticked. */}
              {form.escalate && (
                <Box sx={{ pl: 4 }}>
                  <Field id="escalateReason" label="Reason for escalation" error={errors.escalateReason}>
                    <OutlinedInput id="escalateReason" autoFocus placeholder="e.g. Exposed wiring near desks, 20 people on this floor" value={form.escalateReason} onChange={(e) => set('escalateReason', e.target.value)} inputProps={{ maxLength: 2000 }} sx={{ ...inputSx, '& .MuiOutlinedInput-notchedOutline': { borderColor: `${admin.red} !important` } }} />
                  </Field>
                </Box>
              )}
            </FormSection>

            <Box sx={{ py: 0.5 }}>
              <Button type="submit" variant="contained" size="large" disabled={submitting} sx={{ px: 3.25, whiteSpace: 'nowrap' }}>{submitting ? 'Submitting…' : 'Submit incident'}</Button>
            </Box>
          </Box>

          {/* Read-only preview that updates as the user types, because it is fed from the same form state. */}
          <SummaryPanel
            location={location || '—'}
            category={category?.label}
            title={form.title.trim()}
            priority={form.escalate ? `${priority} (suggested) · escalation requested` : `${priority} (suggested)`}
            showWorkflow={showWorkflow && !isMobile}
          />
        </Box>
      )}
    </Box>
  );
}
