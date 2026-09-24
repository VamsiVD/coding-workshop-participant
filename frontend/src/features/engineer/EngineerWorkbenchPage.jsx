// Engineer workbench (/engineer): the signed-in engineer's assigned tickets,
// the pool of open jobs they can request, and a drawer to update status and
// write to the reporter. Built from the Engineer Workbench design.
import { useMemo, useState } from 'react';
import { Alert, Box, Snackbar, Typography } from '@mui/material';
import { admin } from '../../theme/adminTheme';
import StatCard from '../dashboard/components/StatCard';
import CapacityCard from './components/CapacityCard';
import WorkQueue from './components/WorkQueue';
import EngineerDrawer from './components/EngineerDrawer';
import useEngineerWork from './useEngineerWork';
import { DEFAULT_CAPACITY, RANK, STATUS_ORDER, isActiveWork, matchesQuery } from './engineerModel';

// Building filter value meaning "no filter".
const ALL = 'All buildings';

// [CONCEPT: Component composition] The page owns the state; stat cards, queue and drawer just display it.
export default function EngineerWorkbenchPage() {
  const w = useEngineerWork();
  const [tab, setTab] = useState('assigned');
  const [query, setQuery] = useState('');
  const [matchOnly, setMatchOnly] = useState(true);
  const [building, setBuilding] = useState(ALL);
  const [openRef, setOpenRef] = useState(null);
  const [toast, setToast] = useState('');

  const myId = w.profile?.id;
  const skills = w.profile?.skills ?? [];

  // [CONCEPT: useMemo] Sorted once per data change: by workflow stage, then priority.
  const mine = useMemo(
    () => [...w.assigned].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || RANK[a.priority] - RANK[b.priority]),
    [w.assigned],
  );
  const pool = useMemo(
    () => w.pool
      .filter((i) => (!matchOnly || skills.includes(i.category)) && (building === ALL || i.buildingName === building))
      .sort((a, b) => RANK[a.priority] - RANK[b.priority]),
    [w.pool, matchOnly, building, skills],
  );
  // [CONCEPT: Derived state] Counts and visible rows are computed from the lists, never stored separately.
  const rows = (tab === 'pool' ? pool : mine).filter((i) => matchesQuery(i, query.trim()));

  const active = mine.filter(isActiveWork).length;
  const blocked = mine.filter((i) => i.status === 'Blocked').length;
  const resolved = mine.filter((i) => i.status === 'Resolved').length;
  const matchN = w.pool.filter((i) => skills.includes(i.category)).length;
  const requested = w.pool.filter((i) => i.requestedByMe).length;
  const buildings = [ALL, ...new Set(w.pool.map((i) => i.buildingName))];
  const selected = [...w.assigned, ...w.pool].find((i) => i.ref === openRef);

  const onStatus = async (ref, status, reason) => {
    const inc = await w.updateStatus(ref, status, reason);
    if (status !== 'In Progress') setToast(`${ref} marked ${status.toLowerCase()}. ${inc.reporter} can see your note on their ticket.`);
  };

  // Opening a ticket also loads its notes the first time.
  const open = (ref) => { setOpenRef(ref); if (ref) w.openIncident(ref); };

  return (
    <Box component="main" sx={{ maxWidth: 1080, mx: 'auto', px: 3.5, pt: 4, pb: 8, display: 'grid', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: admin.brown, mb: 0.5 }}>Engineer workbench</Typography>
          <Typography variant="h1">My work</Typography>
          {w.profile && <Typography sx={{ mt: 0.5, fontSize: 14, color: admin.muted }}>{[...skills, ...w.profile.buildings].join(' · ')}</Typography>}
        </Box>
        {w.profile && <CapacityCard active={active} capacity={w.profile.capacity ?? DEFAULT_CAPACITY} available={w.profile.available} onToggle={w.setAvailable} />}
      </Box>

      {/* [CONCEPT: Loading and error state] Any failed call shows here; the lists keep their last good data. */}
      {w.error && <Alert severity="error" sx={{ borderRadius: '10px' }}>{w.error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: 2 }}>
        <StatCard label="Assigned" value={mine.length} hint={`${active} active`} dot={admin.brown} active={tab === 'assigned'} onClick={() => setTab('assigned')} />
        <StatCard label="Blocked" value={blocked} hint={blocked ? 'Reporter sees the reason' : 'Nothing stuck'} dot={blocked ? admin.danger : '#dccfb6'} />
        <StatCard label="Awaiting confirm" value={resolved} hint="Resolved, reporter to confirm" dot="#9c8a6c" />
        <StatCard label="Open jobs" value={matchN} hint="Match your skills" dot={admin.tan} active={tab === 'pool'} onClick={() => setTab('pool')} />
      </Box>

      <WorkQueue
        tab={tab}
        onTab={setTab}
        tabs={[
          { value: 'assigned', label: `Assigned to me · ${mine.length}` },
          { value: 'pool', label: `Open jobs · ${w.pool.length}${requested ? ` · ${requested} requested` : ''}` },
        ]}
        rows={rows}
        myId={myId}
        skills={skills}
        query={query}
        onQuery={setQuery}
        matchOnly={matchOnly}
        onMatchOnly={setMatchOnly}
        building={building}
        buildings={buildings}
        onBuilding={setBuilding}
        onOpen={open}
        emptyText={w.loading ? 'Loading…' : tab === 'pool' ? 'No open jobs match these filters.' : 'Nothing assigned. Check the open jobs.'}
      />

      <EngineerDrawer
        incident={selected}
        myId={myId}
        open={Boolean(selected)}
        onClose={() => setOpenRef(null)}
        busy={w.busy}
        onRequest={async (ref, note) => { await w.requestJob(ref, note); setToast(`Requested ${ref}. An admin will confirm.`); }}
        onWithdraw={async (ref) => { await w.withdrawRequest(ref); setToast(`Request for ${ref} withdrawn.`); }}
        onStatus={onStatus}
        onAddNote={w.addNote}
      />

      <Snackbar slotProps={{ content: { sx: { bgcolor: admin.ink, color: admin.surface, borderRadius: '10px' } } }}
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast('')}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
       
      />
    </Box>
  );
}
