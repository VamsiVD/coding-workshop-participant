// Data hook for the admin console: loads the overview (incidents, engineers,
// buildings, KPIs, engineers' pending job requests) once, and exposes actions
// that update an incident optimistically, then reconcile with what the server returns.
import { useCallback, useEffect, useRef, useState } from 'react';
// [CONCEPT: Service layer] All HTTP calls and backend-to-UI shape mapping live in services/adminApi.js, not here.
import { adminApi } from '../../services/adminApi';

// [CONCEPT: Custom hook] A function starting with `use` that calls other hooks, so the page can share this logic without holding it.
export default function useAdminIncidents() {
  // null until the first load finishes; then { incidents, engineers, buildings, kpis, requests }.
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  // Success message for the job-request actions, shown as a toast by the page.
  const [notice, setNotice] = useState('');
  // Categories for the drawer's edit form: null until first asked for, then [{ id, label, type }].
  const [categories, setCategories] = useState(null);
  // Latest state for the optimistic rollback, without relying on the updater
  // running synchronously.
  // [CONCEPT: useRef] A mutable box that survives re-renders without causing one; refreshed on every render to mirror `data`.
  const latest = useRef(data);
  latest.current = data;

  // [CONCEPT: useEffect] Runs once after the first render (empty dependency array) to fetch the overview.
  // [CONCEPT: Async data fetching] `live` guards against setting state after unmount (or the StrictMode double-run in dev).
  useEffect(() => {
    let live = true;
    adminApi.getAdminOverview().then((d) => live && setData(d)).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, []);

  // Merges a server copy of one incident into the list, matched by ref.
  // [CONCEPT: Immutable update] Builds new objects and arrays with spread and map instead of mutating, so React sees the change.
  // [CONCEPT: useCallback] Empty deps: it only uses the functional setData form, so it never needs to change.
  const replace = useCallback((next) => {
    setData((d) => ({ ...d, incidents: d.incidents.map((i) => (i.ref === next.ref ? { ...i, ...next } : i)) }));
  }, []);

  // Optimistic update, rolled back on failure. `call` returns the server's
  // version of the incident, which then replaces the optimistic one.
  // Resolves true on success, false after a rollback.
  // [CONCEPT: Optimistic update] The UI changes before the server answers; on error the whole snapshot `prev` is restored.
  const run = useCallback(async (ref, optimistic, call) => {
    const prev = latest.current;
    setData((d) => ({ ...d, incidents: d.incidents.map((i) => (i.ref === ref ? { ...i, ...optimistic } : i)) }));
    try {
      replace(await call());
      return true;
    } catch (e) {
      setData(prev);
      setError(e.message);
      return false;
    }
  }, [replace]);

  // Pending requests change behind our back (engineers request and withdraw,
  // assigning clears them), so they are re-read after each request action and
  // whenever an incident is opened.
  const refreshRequests = useCallback(
    () => adminApi.listRequests().then((requests) => setData((d) => ({ ...d, requests }))).catch((e) => setError(e.message)),
    [],
  );

  // The list row carries no notes; the drawer loads the full incident.
  const load = useCallback((ref) => {
    refreshRequests();
    return adminApi.getIncident(ref).then(replace).catch((e) => setError(e.message));
  }, [replace, refreshRequests]);

  // Reads through the ref so actions always see the newest data, even when
  // called from a closure created on an earlier render.
  const find = (ref) => latest.current?.incidents.find((i) => i.ref === ref);

  // The page gets the state plus one function per admin action. Each action
  // returns the promise from `run`, and never rejects: failures land in `error`.
  return {
    data,
    error,
    clearError: () => setError(''),
    notice,
    clearNotice: () => setNotice(''),
    load,
    assign: (ref, engineerId, currentStatus) => {
      // Assigning an open ticket also starts work on it, as the queue implies.
      const startWork = currentStatus === 'Open';
      const engineer = latest.current?.engineers.find((e) => e.id === engineerId);
      const optimistic = { assigneeId: engineerId, assigneeName: engineer?.name ?? null, ...(startWork ? { status: 'In Progress' } : {}) };
      return run(ref, optimistic, () => adminApi.assign(ref, engineerId, { startWork }));
    },
    // `reason` is only sent (and shown optimistically) for a move to Blocked.
    setStatus: (ref, status, reason) => run(
      ref,
      { status, ...(status === 'Blocked' ? { blockedReason: reason } : {}) },
      () => adminApi.setStatus(ref, status, reason),
    ),
    // No optimistic change for these two: the result (new priority, new note)
    // is only known once the server replies. The current priority is passed so
    // an approval can raise it by one level.
    decide: (ref, decision) => run(ref, {}, () => adminApi.decideEscalation(ref, decision, find(ref)?.priority)),
    addNote: (ref, text) => run(ref, {}, () => adminApi.addNote(ref, text)),
    // [CONCEPT: Optimistic update] The edited text shows (or the note disappears) at once; a failure restores it.
    editNote: (ref, noteId, text) => run(
      ref,
      { notes: (find(ref)?.notes ?? []).map((n) => (n.id === noteId ? { ...n, text } : n)) },
      () => adminApi.editNote(ref, noteId, text),
    ),
    deleteNote: (ref, noteId) => run(
      ref,
      { notes: (find(ref)?.notes ?? []).filter((n) => n.id !== noteId) },
      () => adminApi.deleteNote(ref, noteId),
    ),
    // Loads the category list once, the first time the edit form opens.
    categories,
    loadCategories: () => {
      if (categories) return;
      adminApi.listCategories().then(setCategories).catch((e) => setError(e.message));
    },
    // changes: any of { title, description, categoryId }. The new title and text show straight away;
    // the category label follows from the server's copy.
    updateIncident: async (ref, changes) => {
      const optimistic = {};
      if (changes.title !== undefined) optimistic.title = changes.title;
      if (changes.description !== undefined) optimistic.description = changes.description;
      const ok = await run(ref, optimistic, () => adminApi.updateIncident(ref, changes));
      if (ok) setNotice(`${ref} updated`);
      return ok;
    },
    // Not optimistic: deleting is permanent, so the row goes only once the server confirms.
    // Resolves true when the incident (and its pending job requests) left the list.
    deleteIncident: async (ref) => {
      try {
        await adminApi.deleteIncident(ref);
        // [CONCEPT: Immutable update] New arrays without the deleted incident and its requests.
        setData((d) => ({ ...d, incidents: d.incidents.filter((i) => i.ref !== ref), requests: d.requests.filter((r) => r.ref !== ref) }));
        setNotice(`${ref} deleted`);
        return true;
      } catch (e) {
        setError(e.message);
        return false;
      }
    },
    // Confirming a job request is an ordinary assignment to the requester; the
    // incident's requests are hidden straight away, since the server drops them all.
    approveRequest: async (req) => {
      const current = find(req.ref);
      const startWork = current?.status === 'Open';
      setData((d) => ({ ...d, requests: d.requests.filter((r) => r.ref !== req.ref) }));
      const optimistic = { assigneeId: req.engineerId, assigneeName: req.engineerName, ...(startWork ? { status: 'In Progress' } : {}) };
      const ok = await run(req.ref, optimistic, () => adminApi.assign(req.ref, req.engineerId, { startWork }));
      if (ok) setNotice(`${req.ref} assigned to ${req.engineerName}`);
      await refreshRequests();
    },
    declineRequest: async (req) => {
      setData((d) => ({ ...d, requests: d.requests.filter((r) => r.id !== req.id) }));
      try {
        await adminApi.declineRequest(req.id);
        setNotice(`Declined ${req.engineerName}’s request`);
      } catch (e) {
        setError(e.message);
      }
      // Either way, show what the server now holds (this also restores the row after a failure).
      await refreshRequests();
    },
  };
}
