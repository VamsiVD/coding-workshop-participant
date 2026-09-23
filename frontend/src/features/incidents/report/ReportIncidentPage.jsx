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

const inputSx = { bgcolor: admin.bg, '& .MuiOutlinedInput-input': { py: '9px', px: '12px', fontSize: 14.5 } };

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

export default function ReportIncidentPage({ showDuplicateCheck = true, showWorkflow = true }) {
  const isMobile = useMediaQuery({ maxWidth: 899 });
  const [buildings, setBuildings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [mine, setMine] = useState(() => new Set());
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [tried, setTried] = useState(false);
  const [similar, setSimilar] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [ticket, setTicket] = useState(null);

  useEffect(() => {
    Promise.all([incidentApi.listBuildings(), incidentApi.listCategories()])
      .then(([b, c]) => { setBuildings(b); setCategories(c); })
      .catch(() => setServerError('Couldn’t load buildings and categories. Refresh to try again.'));
    incidentApi.listMyIncidentIds().then(setMine).catch(() => {});
  }, []);

  useEffect(() => {
    if (!showDuplicateCheck || !form.floorId) return setSimilar([]);
    let live = true;
    incidentApi.listOpenOnFloor({ floorId: form.floorId })
      .then((rows) => live && setSimilar(rows))
      .catch(() => live && setSimilar([]));
    return () => { live = false; };
  }, [form.floorId, showDuplicateCheck, ticket]);

  const groups = useMemo(() => groupCategories(categories), [categories]);
  const building = buildings.find((b) => b.id === form.buildingId);
  const floor = building?.floors.find((f) => f.id === form.floorId);
  const seat = floor?.seats.find((x) => x.id === form.seatId);
  const category = categories.find((c) => c.id === form.categoryId);
  const priority = suggestPriority(form.scope, form.working);
  const location = [building?.name, floor && floorLabel(floor), seat?.code].filter(Boolean).join(' · ');
  const errorCount = useMemo(() => Object.keys(errors).length, [errors]);

  const set = (field, value) => {
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === 'buildingId') { next.floorId = ''; next.seatId = ''; }
      if (field === 'floorId') next.seatId = '';
      if (tried) setErrors(validateIncident(next));
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setTried(true);
    const v = validateIncident(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    setSubmitting(true);
    setServerError('');
    try {
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

  const [pBg, pFg] = PRIORITY[priority];
  const checkSx = { color: 'rgba(42,29,20,.35)', '&.Mui-checked': { color: admin.red }, p: 0, mr: 1.25 };

  return (
    <Box component="main" sx={{ maxWidth: 1080, mx: 'auto', px: { xs: 2, sm: 3.5 }, pt: 4, pb: 8, display: 'grid', gap: 3 }}>
      <div>
        <Typography sx={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: admin.brown, mb: 0.5 }}>New incident</Typography>
        <Typography variant="h1">Report an incident</Typography>
        <Typography sx={{ mt: 0.5, fontSize: 14, color: admin.muted }}>Tell us where and what. Follow progress from your dashboard until it’s resolved.</Typography>
      </div>

      {ticket ? (
        <SubmittedCard ticket={ticket} location={location} onReportAnother={reset} />
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1fr) 320px', gap: 3, alignItems: 'start' }}>
          <Box component="form" noValidate onSubmit={submit} sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
            {tried && errorCount > 0 && (
              <Alert severity="error" sx={{ borderRadius: '10px', border: '1px solid oklch(0.8 0.08 25)', bgcolor: 'oklch(0.96 0.02 25)', color: admin.dangerFg }}>
                <b style={{ fontWeight: 500 }}>{errorCount === 1 ? '1 field needs attention' : `${errorCount} fields need attention`}.</b> Fix the fields marked below.
              </Alert>
            )}
            {serverError && <Alert severity="error" sx={{ borderRadius: '10px' }}>{serverError}</Alert>}

            <FormSection number="01" title="Location">
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: 1.75 }}>
                <Field id="building" label="Building" error={errors.buildingId}>
                  <Select id="building" value={form.buildingId} onChange={(e) => set('buildingId', e.target.value)} displayEmpty sx={inputSx}>
                    <MenuItem value="" disabled>Select building</MenuItem>
                    {buildings.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                  </Select>
                </Field>
                <Field id="floor" label="Floor" error={errors.floorId}>
                  <Select id="floor" value={form.floorId} onChange={(e) => set('floorId', e.target.value)} displayEmpty disabled={!building} sx={inputSx}>
                    <MenuItem value="" disabled>Select floor</MenuItem>
                    {(building?.floors ?? []).map((f) => <MenuItem key={f.id} value={f.id}>{floorLabel(f)}</MenuItem>)}
                  </Select>
                </Field>
                <Field id="seat" label="Seat" optional>
                  <Select id="seat" value={form.seatId} onChange={(e) => set('seatId', e.target.value)} displayEmpty disabled={!floor?.seats.length} sx={inputSx}>
                    <MenuItem value="">{floor?.seats.length ? 'Not at a seat' : 'No seats listed'}</MenuItem>
                    {(floor?.seats ?? []).map((x) => <MenuItem key={x.id} value={x.id}>{x.code}</MenuItem>)}
                  </Select>
                </Field>
              </Box>
              <SimilarTickets tickets={similar} mine={mine} />
            </FormSection>

            <FormSection number="02" title="Issue">
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
              <Box sx={{ mt: -1, fontSize: 12.5, color: admin.muted, textAlign: 'right' }}>{form.description.trim().length} / 20 min</Box>
            </FormSection>

            <FormSection number="03" title="Impact">
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 2 }}>
                <SegmentedChoice id="scope" label="Who is affected?" options={SCOPE} value={form.scope} onChange={(v) => set('scope', v)} />
                <SegmentedChoice id="working" label="Can you keep working?" options={WORKING} value={form.working} onChange={(v) => set('working', v)} />
              </Box>
              <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: admin.muted }}>
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
