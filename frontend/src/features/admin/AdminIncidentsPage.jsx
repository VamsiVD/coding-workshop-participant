import { useCallback, useMemo, useState } from 'react';
import { Alert, Box, CircularProgress, MenuItem, Snackbar, Tab, Tabs, TextField, Typography } from '@mui/material';
import { admin } from '../../theme/adminTheme';
import { isActive, needsAction } from './adminModel';
import useAdminIncidents from './useAdminIncidents';
import QueueTab from './components/QueueTab';
import InsightsTab from './components/InsightsTab';
import IncidentDrawer from './components/IncidentDrawer';

const ALL = 'All buildings';

export default function AdminIncidentsPage() {
  const { data, error, clearError, load, assign, setStatus, decide, addNote } = useAdminIncidents();
  const [tab, setTab] = useState('queue');
  const [building, setBuilding] = useState(ALL);
  const [openRef, setOpenRef] = useState(null);

  const incidents = useMemo(
    () => (data ? data.incidents.filter((i) => building === ALL || i.building === building) : []),
    [data, building],
  );
  // The row carries the assignee's name; the engineer list fills in when it
  // does not (an engineer since deactivated, for example).
  const engineerName = useCallback(
    (i) => i.assigneeName ?? data?.engineers.find((e) => e.id === i.assigneeId)?.name,
    [data],
  );

  const openIncident = (ref) => {
    setOpenRef(ref);
    load(ref);
  };

  if (!data) {
    return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>{error ? <Alert severity="error">{error}</Alert> : <CircularProgress color="secondary" />}</Box>;
  }

  const open = incidents.filter(isActive).length;
  const needs = incidents.filter(needsAction).length;

  return (
    <Box component="main" sx={{ maxWidth: 1200, mx: 'auto', px: 3.5, pt: 4, pb: 8, display: 'grid', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: admin.brown, mb: 0.5 }}>Operations</Typography>
          <Typography variant="h1">Incidents</Typography>
          <Typography sx={{ mt: 0.5, fontSize: 14, color: admin.muted }}>{open} open incidents · {needs} need your attention</Typography>
        </Box>
        <TextField select size="small" label="Building" value={building} onChange={(e) => setBuilding(e.target.value)} sx={{ minWidth: 220 }}>
          {[ALL, ...data.buildings].map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
        </TextField>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ borderBottom: `1px solid ${admin.line}`, minHeight: 42, '& .MuiTab-root': { minHeight: 42, fontWeight: 600, fontSize: 16, textTransform: 'none', color: admin.muted }, '& .Mui-selected': { color: `${admin.ink} !important` }, '& .MuiTabs-indicator': { bgcolor: admin.red } }}
      >
        <Tab value="queue" label="Queue" />
        <Tab value="insights" label="Insights" />
      </Tabs>

      {tab === 'queue'
        ? <QueueTab incidents={incidents} engineerName={engineerName} onOpen={openIncident} />
        : <InsightsTab incidents={incidents} engineers={data.engineers} kpis={data.kpis} />}

      <IncidentDrawer
        incident={data.incidents.find((i) => i.ref === openRef)}
        engineers={data.engineers}
        onClose={() => setOpenRef(null)}
        onAssign={assign}
        onStatus={setStatus}
        onDecide={decide}
        onNote={addNote}
      />

      <Snackbar open={!!error} autoHideDuration={5000} onClose={clearError}>
        <Alert severity="error" onClose={clearError}>{error}</Alert>
      </Snackbar>
    </Box>
  );
}
