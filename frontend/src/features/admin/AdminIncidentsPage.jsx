// Admin console page (/admin/incidents): the incident queue and insights tabs,
// a building filter, and the drawer where an admin assigns and moves incidents
// and answers engineers' job requests.
// App.jsx only renders it for users whose role is 'admin'.
import { useCallback, useMemo, useState } from 'react';
import { Alert, Box, CircularProgress, MenuItem, Snackbar, Tab, Tabs, TextField, Typography } from '@mui/material';
import { admin } from '../../theme/adminTheme';
import { DEFAULT_RANGE, isActive, needsAction } from './adminModel';
import useAdminIncidents from './useAdminIncidents';
import useInsights from './useInsights';
import QueueTab from './components/QueueTab';
import InsightsTab from './components/InsightsTab';
import IncidentDrawer from './components/IncidentDrawer';

// Sentinel value for the building picker meaning "no building filter".
const ALL = 'All buildings';

// [CONCEPT: Component] The page component; the data work lives in a hook, the markup in child tabs.
export default function AdminIncidentsPage() {
  // [CONCEPT: Custom hook] useAdminIncidents owns the fetched data and every server action; the page just wires them up.
  const {
    data, error, clearError, notice, clearNotice, load, assign, setStatus, decide, addNote, editNote, deleteNote,
    categories, loadCategories, updateIncident, deleteIncident, approveRequest, declineRequest,
  } = useAdminIncidents();
  // [CONCEPT: useState] Purely UI state: which tab, which building filter, which incident's drawer is open.
  const [tab, setTab] = useState('queue');
  const [building, setBuilding] = useState(ALL);
  // Insights date range; kept here rather than in the tab so it survives switching tabs.
  const [range, setRange] = useState(DEFAULT_RANGE);
  const ranged = useInsights(range, tab === 'insights');
  // Only the ref is stored, not the incident object, so the drawer always shows
  // the latest copy from `data` after an update.
  const [openRef, setOpenRef] = useState(null);

  // [CONCEPT: useMemo] Building-filtered list, recomputed only when the data or the filter changes.
  // Both tabs receive this list, so the building filter applies to queue and insights alike.
  const incidents = useMemo(
    () => (data ? data.incidents.filter((i) => building === ALL || i.building === building) : []),
    [data, building],
  );
  // The Insights list for the chosen date range: the server's answer, building-filtered
  // the same way. null while a range's first answer is loading; "All time" reuses `incidents`.
  const rangedIncidents = useMemo(() => {
    if (!ranged.bounds) return incidents;
    return ranged.data ? ranged.data.incidents.filter((i) => building === ALL || i.building === building) : null;
  }, [ranged.bounds, ranged.data, incidents, building]);
  // Pending job requests grouped by incident ref, for the queue badges and the drawer.
  const requestsByRef = useMemo(() => {
    const m = {};
    (data?.requests ?? []).forEach((r) => { (m[r.ref] ||= []).push(r); });
    return m;
  }, [data]);
  // The row carries the assignee's name; the engineer list fills in when it
  // does not (an engineer since deactivated, for example).
  // [CONCEPT: useCallback] A stable function identity, so QueueTab's useMemo (which lists it as a dependency) does not recompute every render.
  const engineerName = useCallback(
    (i) => i.assigneeName ?? data?.engineers.find((e) => e.id === i.assigneeId)?.name,
    [data],
  );

  // Opens the drawer straight away with the list row, then fetches the full
  // incident (with notes) in the background and swaps it in.
  const openIncident = (ref) => {
    setOpenRef(ref);
    load(ref);
  };

  // After a confirmed delete the incident is gone from `data`; close the drawer too.
  const removeIncident = async (ref) => {
    const ok = await deleteIncident(ref);
    if (ok) setOpenRef(null);
    return ok;
  };

  // [CONCEPT: Loading and error state] Until the overview arrives, show a spinner, or the error if the first load failed.
  if (!data) {
    return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>{error ? <Alert severity="error">{error}</Alert> : <CircularProgress color="secondary" />}</Box>;
  }

  // [CONCEPT: Derived state] Header counts are computed from the list on each render, never stored in state.
  const open = incidents.filter(isActive).length;
  const needs = incidents.filter(needsAction).length;

  return (
    // [CONCEPT: sx prop] MUI's sx takes theme-aware style values; spacing numbers like px: 3.5 are multiples of the theme spacing unit.
    <Box component="main" sx={{ maxWidth: 1200, mx: 'auto', px: 3.5, pt: 4, pb: 8, display: 'grid', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: admin.brown, mb: 0.5 }}>Operations</Typography>
          <Typography variant="h1">Incidents</Typography>
          <Typography sx={{ mt: 0.5, fontSize: 14, color: admin.muted }}>{open} open incidents · {needs} need your attention</Typography>
        </Box>
        {/* [CONCEPT: Controlled input] The select's value comes from state and every change goes back through setBuilding. */}
        <TextField select size="small" label="Building" value={building} onChange={(e) => setBuilding(e.target.value)} sx={{ minWidth: 220 }}>
          {/* [CONCEPT: List rendering and keys] Building names are unique, so each name doubles as its key. */}
          {[ALL, ...data.buildings].map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
        </TextField>
      </Box>

      {/* [CONCEPT: MUI component] MUI Tabs: onChange passes (event, value), and value is the `value` prop of the clicked Tab. */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ borderBottom: `1px solid ${admin.line}`, minHeight: 42, '& .MuiTab-root': { minHeight: 42, fontWeight: 600, fontSize: 16, textTransform: 'none', color: admin.muted }, '& .Mui-selected': { color: `${admin.ink} !important` }, '& .MuiTabs-indicator': { bgcolor: admin.red } }}
      >
        <Tab value="queue" label="Queue" />
        <Tab value="insights" label="Insights" />
      </Tabs>

      {/* [CONCEPT: Conditional rendering] A ternary picks which tab to mount; the other one is not rendered at all. */}
      {/* [CONCEPT: Props] Children get data plus callbacks (onOpen) to report back up to this page. */}
      {tab === 'queue'
        ? <QueueTab incidents={incidents} engineerName={engineerName} requestsByRef={requestsByRef} onOpen={openIncident} />
        : (
          <InsightsTab
            incidents={rangedIncidents}
            current={incidents}
            engineers={data.engineers}
            kpis={ranged.bounds ? ranged.data?.kpis : data.kpis}
            range={range}
            onRangeChange={setRange}
            rangeInvalid={Boolean(ranged.bounds?.invalid)}
            loading={ranged.loading}
            error={ranged.error}
          />
        )}

      {/* [CONCEPT: Lifting state up] The drawer owns no incident data; it reads it from this page and calls the hook's actions.
          The drawer is always mounted; it is open when `incident` is found (openRef is set). */}
      <IncidentDrawer
        incident={data.incidents.find((i) => i.ref === openRef)}
        engineers={data.engineers}
        requests={requestsByRef[openRef] ?? []}
        onClose={() => setOpenRef(null)}
        onAssign={assign}
        onStatus={setStatus}
        onDecide={decide}
        onNote={addNote}
        onEditNote={editNote}
        onDeleteNote={deleteNote}
        categories={categories}
        onNeedCategories={loadCategories}
        onUpdate={updateIncident}
        onDelete={removeIncident}
        onApproveRequest={approveRequest}
        onDeclineRequest={declineRequest}
      />

      {/* Errors from actions after the first load (e.g. a rejected status change) surface here as a toast. */}
      <Snackbar open={!!error} autoHideDuration={5000} onClose={clearError}>
        <Alert severity="error" onClose={clearError}>{error}</Alert>
      </Snackbar>
      {/* Confirms a job request was assigned or declined, or an incident edited or deleted; placed top so it never covers the error toast. */}
      <Snackbar open={!!notice} autoHideDuration={4000} onClose={clearNotice} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="success" onClose={clearNotice}>{notice}</Alert>
      </Snackbar>
    </Box>
  );
}
