import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, CircularProgress, Snackbar, Stack, Typography } from '@mui/material';
import { crate } from '../../theme/crateTheme';
import { dashboardApi } from '../../services/dashboardApi';
import { greeting, isActive, isDone, needsAttention } from './ticketModel';
import StatCard from './components/StatCard';
import AttentionPanel from './components/AttentionPanel';
import TicketList from './components/TicketList';
import NearbyIncidents from './components/NearbyIncidents';
import TicketDrawer from './components/TicketDrawer';

const FILTERS = { active: isActive, resolved: isDone, all: () => true };

export default function DashboardPage({ user }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('active');
  const [query, setQuery] = useState('');
  const [openRef, setOpenRef] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(() => {
    dashboardApi.getDashboard().then(setData).catch((e) => setLoadError(e.message));
  }, []);
  useEffect(load, [load]);

  const replaceTicket = (t) => setData((d) => ({ ...d, tickets: d.tickets.map((x) => (x.ref === t.ref ? { ...x, ...t } : x)) }));

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

  const openTicket = (ref) => {
    setOpenRef(ref);
    setData((d) => ({ ...d, tickets: d.tickets.map((t) => (t.ref === ref ? { ...t, unreadCount: 0 } : t)) }));
    dashboardApi.markRead(ref).catch(() => {});
    // The list row has no notes or blocked reason; load the full ticket.
    dashboardApi.getTicket(ref).then(replaceTicket).catch((e) => setToast(e.message));
  };

  // Links from elsewhere (report page, similar tickets) open a ticket via
  // ?open=INC-0042 once the dashboard has loaded.
  const loaded = Boolean(data);
  useEffect(() => {
    if (!loaded) return;
    const ref = new URLSearchParams(window.location.search).get('open');
    if (ref) openTicket(ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const handlers = {
    confirm: (ref) => act(() => dashboardApi.confirmFix(ref), `${ref} closed. Thanks for confirming.`),
    reopen: (ref) => act(() => dashboardApi.reopen(ref), `${ref} reopened. The engineer has been told.`),
    dismiss: (ref) => {
      setData((d) => ({ ...d, tickets: d.tickets.map((t) => (t.ref === ref ? { ...t, unreadCount: 0 } : t)) }));
      dashboardApi.markRead(ref).catch(() => {});
    },
    addNote: (ref, text) => act(() => dashboardApi.addNote(ref, text)),
    escalate: (ref, reason) => act(() => dashboardApi.requestEscalation(ref, reason), 'Escalation requested. An admin will review it.'),
    toggleAffected: async (ref, affected) => {
      try {
        const res = await dashboardApi.setAffected(ref, affected);
        setData((d) => ({ ...d, nearby: d.nearby.map((n) => (n.ref === ref ? { ...n, ...res } : n)) }));
      } catch (e) {
        setToast(e.message);
      }
    },
  };

  const tickets = data?.tickets ?? [];
  const attention = useMemo(() => tickets.filter(needsAttention), [tickets]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets
      .filter(FILTERS[filter])
      .filter((t) => !q || `${t.ref} ${t.title} ${t.category}`.toLowerCase().includes(q));
  }, [tickets, filter, query]);

  const counts = useMemo(() => ({
    open: tickets.filter((t) => t.status === 'Open' || t.status === 'In Progress').length,
    blocked: tickets.filter((t) => t.status === 'Blocked').length,
    done: tickets.filter(isDone).length,
  }), [tickets]);

  const selected = tickets.find((t) => t.ref === openRef);

  return (
    <Box component="main" sx={{ maxWidth: 1080, mx: 'auto', px: 2.5, pt: 3.5, pb: 7, display: 'grid', gap: 2.5 }}>
      <Stack spacing={0.5}>
        <Typography variant="overline" sx={{ color: crate.redDeep }}>{greeting(user.firstName)}</Typography>
        <Typography variant="h1">My dashboard</Typography>
        {data?.location && <Typography variant="body1">{data.location}</Typography>}
      </Stack>

      {loadError && <Alert severity="error">{loadError}</Alert>}
      {!data && !loadError && <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress color="secondary" /></Box>}

      {data && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: 1.75 }}>
            <StatCard label="Active" value={counts.open + counts.blocked} hint={`${counts.open} open · ${counts.blocked} blocked`} active={filter === 'active'} onClick={() => setFilter('active')} />
            <StatCard label="Awaiting you" value={attention.length} hint="Replies and fixes to confirm" tone={attention.length ? 'alert' : 'default'} />
            <StatCard label="Resolved" value={counts.done} hint="Resolved or closed" active={filter === 'resolved'} onClick={() => setFilter('resolved')} />
            <StatCard label="Avg. time to fix" value={data.stats.avgFixDays == null ? '—' : `${data.stats.avgFixDays}d`} hint="Your tickets, all time" />
          </Box>

          <AttentionPanel tickets={attention} onConfirm={handlers.confirm} onReopen={handlers.reopen} onReply={openTicket} onDismiss={handlers.dismiss} />

          <TicketList tickets={visible} filter={filter} onFilterChange={setFilter} query={query} onQueryChange={setQuery} onOpen={openTicket} />

          <NearbyIncidents items={data.nearby} locationLabel={data.location?.split(' · Seat')[0] ?? 'your floor'} onToggle={handlers.toggleAffected} />
        </>
      )}

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

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast('')}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        ContentProps={{ sx: { bgcolor: crate.ink, color: crate.paper, borderRadius: 0, boxShadow: `3px 3px 0 ${crate.red}`, fontFamily: 'inherit' } }}
      />
    </Box>
  );
}
