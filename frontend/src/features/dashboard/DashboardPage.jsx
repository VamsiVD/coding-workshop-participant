// Employee dashboard (/dashboard): the signed-in user's own tickets, items
// awaiting their reply or confirmation, open issues nearby, and a drawer for
// one ticket. This page owns the data; the child components only display it.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, CircularProgress, Snackbar, Stack, Typography } from '@mui/material';
import { admin } from '../../theme/adminTheme';
import { dashboardApi } from '../../services/dashboardApi';
import { greeting, isActive, isDone, needsAttention } from './ticketModel';
import StatCard from './components/StatCard';
import AttentionPanel from './components/AttentionPanel';
import TicketList from './components/TicketList';
import NearbyIncidents from './components/NearbyIncidents';
import TicketDrawer from './components/TicketDrawer';

// Ticket list filter key -> predicate; the keys match TicketList's toggle buttons.
const FILTERS = { active: isActive, resolved: isDone, all: () => true };

// [CONCEPT: Props] `user` comes from App.jsx, which passes only { firstName } for the greeting.
export default function DashboardPage({ user }) {
  // [CONCEPT: useState] null until the first load; then { stats, location, tickets, nearby } from dashboardApi.getDashboard.
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('active');
  const [query, setQuery] = useState('');
  // Only the ref is kept, so the drawer always reads the latest copy of the ticket from `data`.
  const [openRef, setOpenRef] = useState(null);
  // True while a drawer action is in flight; the drawer disables its buttons meanwhile.
  const [busy, setBusy] = useState(false);
  // Snackbar text for both success messages and action errors.
  const [toast, setToast] = useState('');

  // [CONCEPT: Service layer] dashboardApi hides the HTTP calls (or mocks) and maps backend rows to the UI's ticket shape.
  // [CONCEPT: useCallback] Stable identity, so the effect below runs once on mount rather than every render.
  const load = useCallback(() => {
    dashboardApi.getDashboard().then(setData).catch((e) => setLoadError(e.message));
  }, []);
  // [CONCEPT: useEffect] Kick off the initial fetch after the first render.
  // [CONCEPT: Async data fetching] The promise settles into setData or setLoadError. Unlike useAdminIncidents,
  // there is no unmount guard; the page stays mounted for the whole visit.
  useEffect(load, [load]);

  // [CONCEPT: Immutable update] Swap one ticket (merged with the server copy) into a new tickets array.
  const replaceTicket = (t) => setData((d) => ({ ...d, tickets: d.tickets.map((x) => (x.ref === t.ref ? { ...x, ...t } : x)) }));

  // Shared wrapper for drawer actions: set busy, run the API call, merge the
  // updated ticket it returns, then toast the success message or the error.
  // Not optimistic: the UI changes only after the server answers.
  const act = async (fn, message) => {
    setBusy(true);
    try {
      const updated = await fn();
      if (updated?.ref) replaceTicket(updated);
      if (message) setToast(message);
    } catch (e) {
      setToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Opening a ticket clears its unread badge locally right away; markRead is a
  // placeholder on the real backend, so its failure is ignored.
  const openTicket = (ref) => {
    setOpenRef(ref);
    setData((d) => ({ ...d, tickets: d.tickets.map((t) => (t.ref === ref ? { ...t, unreadCount: 0 } : t)) }));
    dashboardApi.markRead(ref).catch(() => {});
    // The list row has no notes or blocked reason; load the full ticket.
    dashboardApi.getTicket(ref).then(replaceTicket).catch((e) => setToast(e.message));
  };

  // Links from elsewhere (report page, similar tickets) open a ticket via
  // ?open=INC-0042 once the dashboard has loaded.
  // [CONCEPT: Client-side routing] Reads a query param from the URL; `loaded` flips once, so this runs a single time after data arrives.
  const loaded = Boolean(data);
  useEffect(() => {
    if (!loaded) return;
    const ref = new URLSearchParams(window.location.search).get('open');
    if (ref) openTicket(ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // [CONCEPT: Lifting state up] Every action that changes a ticket lives here, and children get these as on* props.
  const handlers = {
    confirm: (ref) => act(() => dashboardApi.confirmFix(ref), `${ref} closed. Thanks for confirming.`),
    reopen: (ref) => act(() => dashboardApi.reopen(ref), `${ref} reopened. The engineer has been told.`),
    dismiss: (ref) => {
      setData((d) => ({ ...d, tickets: d.tickets.map((t) => (t.ref === ref ? { ...t, unreadCount: 0 } : t)) }));
      dashboardApi.markRead(ref).catch(() => {});
    },
    addNote: (ref, text) => act(() => dashboardApi.addNote(ref, text)),
    escalate: (ref, reason) => act(() => dashboardApi.requestEscalation(ref, reason), 'Escalation requested. An admin will review it.'),
    // Updates `nearby`, not `tickets`: these are other people's incidents. On the
    // real backend setAffected only echoes the value back (nothing is saved yet).
    toggleAffected: async (ref, affected) => {
      try {
        const res = await dashboardApi.setAffected(ref, affected);
        setData((d) => ({ ...d, nearby: d.nearby.map((n) => (n.ref === ref ? { ...n, ...res } : n)) }));
      } catch (e) {
        setToast(e.message);
      }
    },
  };

  // [CONCEPT: Derived state] Lists and counts are computed from `data` rather than kept in their own state.
  const tickets = data?.tickets ?? [];
  // [CONCEPT: useMemo] Cached filters. `tickets` keeps its identity until setData runs, so these recompute only after
  // an update (while data is null, the `[]` fallback is new each render, which is harmless for an empty list).
  const attention = useMemo(() => tickets.filter(needsAttention), [tickets]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets
      .filter(FILTERS[filter])
      .filter((t) => !q || `${t.ref} ${t.title} ${t.category}`.toLowerCase().includes(q));
  }, [tickets, filter, query]);

  // Counted over all tickets, not the filtered `visible` list, so the stat cards do not change with search.
  const counts = useMemo(() => ({
    open: tickets.filter((t) => t.status === 'Open' || t.status === 'In Progress').length,
    blocked: tickets.filter((t) => t.status === 'Blocked').length,
    done: tickets.filter(isDone).length,
  }), [tickets]);

  const selected = tickets.find((t) => t.ref === openRef);

  return (
    <Box component="main" sx={{ maxWidth: 1080, mx: 'auto', px: 3.5, pt: 4, pb: 8, display: 'grid', gap: 3 }}>
      <Stack spacing={0.5}>
        <Typography sx={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: admin.brown }}>{greeting(user.firstName)}</Typography>
        <Typography variant="h1">My dashboard</Typography>
        {data?.location && <Typography sx={{ fontSize: 14, color: admin.muted }}>{data.location}</Typography>}
      </Stack>

      {/* [CONCEPT: Loading and error state] Error, spinner or content: exactly one shows, based on data and loadError. */}
      {loadError && <Alert severity="error">{loadError}</Alert>}
      {!data && !loadError && <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress color="secondary" /></Box>}

      {/* [CONCEPT: Conditional rendering] The content block only mounts once data exists. */}
      {data && (
        // [CONCEPT: Fragment] <>...</> groups several siblings under one condition without adding a DOM element.
        <>
          {/* [CONCEPT: Component composition] The page is assembled from small components, each given only the props it needs.
              Cards without onClick (Awaiting you, Avg. time to fix) render as plain, non-clickable tiles. */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 2 }}>
            <StatCard label="Active" value={counts.open + counts.blocked} hint={`${counts.open} open · ${counts.blocked} blocked`} dot={admin.brown} active={filter === 'active'} onClick={() => setFilter('active')} />
            <StatCard label="Awaiting you" value={attention.length} hint="Replies and fixes to confirm" dot={attention.length ? admin.red : '#dccfb6'} />
            <StatCard label="Resolved" value={counts.done} hint="Resolved or closed" dot="#9c8a6c" active={filter === 'resolved'} onClick={() => setFilter('resolved')} />
            <StatCard label="Avg. time to fix" value={data.stats.avgFixDays == null ? '—' : `${data.stats.avgFixDays}d`} hint="Your tickets, all time" dot={admin.tan} />
          </Box>

          <AttentionPanel tickets={attention} onConfirm={handlers.confirm} onReopen={handlers.reopen} onReply={openTicket} onDismiss={handlers.dismiss} />

          {/* [CONCEPT: Controlled input] TicketList's filter and search are controlled from here via value + onChange props. */}
          <TicketList tickets={visible} filter={filter} onFilterChange={setFilter} query={query} onQueryChange={setQuery} onOpen={openTicket} />

          <NearbyIncidents items={data.nearby} locationLabel={data.location?.split(' · Seat')[0] ?? 'your floor'} onToggle={handlers.toggleAffected} />
        </>
      )}

      {/* Rendered outside the `data &&` block; it returns null itself while no ticket is selected.
          location falls back to the user's own floor when the ticket has no `place` (the mock tickets do not). */}
      <TicketDrawer
        ticket={selected}
        location={selected?.place ?? data?.location?.split(' · Seat')[0]}
        open={Boolean(selected)}
        onClose={() => setOpenRef(null)}
        onConfirm={handlers.confirm}
        onReopen={handlers.reopen}
        onEscalate={handlers.escalate}
        onAddNote={handlers.addNote}
        busy={busy}
      />

      {/* [CONCEPT: MUI component] Snackbar shows while `toast` is non-empty and calls onClose after 4s, which clears it. */}
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
