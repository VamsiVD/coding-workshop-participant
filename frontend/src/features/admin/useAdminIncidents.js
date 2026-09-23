import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi } from '../../services/adminApi';

export default function useAdminIncidents() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  // Latest state for the optimistic rollback, without relying on the updater
  // running synchronously.
  const latest = useRef(data);
  latest.current = data;

  useEffect(() => {
    let live = true;
    adminApi.getAdminOverview().then((d) => live && setData(d)).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, []);

  const replace = useCallback((next) => {
    setData((d) => ({ ...d, incidents: d.incidents.map((i) => (i.ref === next.ref ? { ...i, ...next } : i)) }));
  }, []);

  // Optimistic update, rolled back on failure. `call` returns the server's
  // version of the incident, which then replaces the optimistic one.
  const run = useCallback(async (ref, optimistic, call) => {
    const prev = latest.current;
    setData((d) => ({ ...d, incidents: d.incidents.map((i) => (i.ref === ref ? { ...i, ...optimistic } : i)) }));
    try {
      replace(await call());
    } catch (e) {
      setData(prev);
      setError(e.message);
    }
  }, [replace]);

  // The list row carries no notes; the drawer loads the full incident.
  const load = useCallback((ref) => adminApi.getIncident(ref).then(replace).catch((e) => setError(e.message)), [replace]);

  const find = (ref) => latest.current?.incidents.find((i) => i.ref === ref);

  return {
    data,
    error,
    clearError: () => setError(''),
    load,
    assign: (ref, engineerId, currentStatus) => {
      // Assigning an open ticket also starts work on it, as the queue implies.
      const startWork = currentStatus === 'Open';
      const engineer = latest.current?.engineers.find((e) => e.id === engineerId);
      const optimistic = { assigneeId: engineerId, assigneeName: engineer?.name ?? null, ...(startWork ? { status: 'In Progress' } : {}) };
      return run(ref, optimistic, () => adminApi.assign(ref, engineerId, { startWork }));
    },
    setStatus: (ref, status, reason) => run(
      ref,
      { status, ...(status === 'Blocked' ? { blockedReason: reason } : {}) },
      () => adminApi.setStatus(ref, status, reason),
    ),
    decide: (ref, decision) => run(ref, {}, () => adminApi.decideEscalation(ref, decision, find(ref)?.priority)),
    addNote: (ref, text) => run(ref, {}, () => adminApi.addNote(ref, text)),
  };
}
