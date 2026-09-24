// Data hook for the engineer workbench: loads the engineer's profile, their
// assigned tickets and the open-job pool, and exposes the actions the page needs.
import { useCallback, useEffect, useState } from 'react';
import { engineerApi } from '../../services/engineerApi';

// [CONCEPT: Custom hook] Keeps loading, errors and server calls out of the page component.
export default function useEngineerWork() {
  const [profile, setProfile] = useState(null);
  const [assigned, setAssigned] = useState([]);
  const [pool, setPool] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // [CONCEPT: useCallback] A stable `load` lets the effect below run once, and doubles as "reload".
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a, o] = await Promise.all([engineerApi.getProfile(), engineerApi.listAssigned(), engineerApi.listPool()]);
      setProfile(p); setAssigned(a); setPool(o); setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // [CONCEPT: useEffect] Fetch once on mount.
  useEffect(() => { load(); }, [load]);

  // Merge what the server returned (a whole incident or just changed fields)
  // into whichever list holds that ref.
  // [CONCEPT: Immutable update] New arrays and objects, so React sees the change.
  const merge = (inc) => {
    const apply = (xs) => xs.map((x) => (x.ref === inc.ref ? { ...x, ...inc } : x));
    setAssigned(apply);
    setPool(apply);
  };

  const run = async (fn) => {
    setBusy(true);
    try { const r = await fn(); if (r?.ref) merge(r); setError(''); return r; }
    catch (e) { setError(e.message); throw e; }
    finally { setBusy(false); }
  };

  const myId = profile?.id;
  const find = (ref) => [...assigned, ...pool].find((i) => i.ref === ref);

  return {
    profile, assigned, pool, loading, busy, error, reload: load,
    // [CONCEPT: Optimistic update] The switch flips at once; a failed save shows the error and reloads.
    setAvailable: async (v) => {
      setProfile((p) => ({ ...p, available: v }));
      try { await run(() => engineerApi.setAvailability(v)); } catch { load(); }
    },
    // Assigned tickets arrive without notes; fetch the detail the first time one is opened.
    openIncident: async (ref) => {
      const inc = find(ref);
      if (!inc || inc.detailLoaded || inc.assigneeId !== myId) return;
      try { merge(await engineerApi.getIncident(ref, myId)); } catch (e) { setError(e.message); }
    },
    requestJob: (ref, note) => run(() => engineerApi.requestJob(ref, note)),
    withdrawRequest: (ref) => run(() => engineerApi.withdrawRequest(ref)),
    updateStatus: (ref, status, reason) => run(() => engineerApi.updateStatus(ref, find(ref)?.status, status, reason, myId)),
    addNote: (ref, text) => run(() => engineerApi.addNote(ref, text, myId)),
  };
}
