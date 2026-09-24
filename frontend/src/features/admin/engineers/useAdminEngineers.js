// Data hook for the engineers page: loads engineer profiles and the
// specialisation categories, and exposes create, edit, availability,
// deactivate and promote-an-employee actions that keep the local list in
// step with the server.
import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi } from '../../../services/adminApi';

// [CONCEPT: Custom hook] The page gets data plus actions; it never calls adminApi itself.
export default function useAdminEngineers() {
  // null until the first load; then EngineerProfile[].
  const [engineers, setEngineers] = useState(null);
  const [categories, setCategories] = useState([]);
  // Only a failed first load is kept here; action errors are returned to the caller or toasted.
  const [loadError, setLoadError] = useState('');
  // [CONCEPT: useRef] Newest list for rollbacks, readable from any closure without re-subscribing.
  const latest = useRef(engineers);
  latest.current = engineers;

  // [CONCEPT: Async data fetching] Both lists in parallel. Categories only feed the picker,
  // so if they fail the page still works with an empty picker.
  const reload = useCallback(async () => {
    setLoadError('');
    try {
      const [list, cats] = await Promise.all([
        adminApi.listEngineers(),
        adminApi.listCategories().catch(() => []),
      ]);
      setEngineers(list);
      setCategories(cats);
    } catch (e) {
      setLoadError(e.message);
    }
  }, []);

  // [CONCEPT: useEffect] Fetch once on mount. reload is stable, so this does not re-run.
  useEffect(() => { reload(); }, [reload]);

  // [CONCEPT: Immutable update] Swap in the server copy. PATCH does not report the ticket
  // count (activeTickets null), so the count already on screen is kept.
  const merge = useCallback((next) => {
    setEngineers((list) => list.map((e) => (e.id === next.id ? { ...e, ...next, activeTickets: next.activeTickets ?? e.activeTickets } : e)));
  }, []);

  // New engineers go to the end; the page sorts by name anyway.
  // Rejects with ApiError (fields keyed by form field) so the dialog can show it.
  const create = useCallback(async (form) => {
    const created = await adminApi.createEngineer(form);
    setEngineers((list) => [...list, created]);
    return created;
  }, []);

  const update = useCallback(async (id, changes) => {
    const next = await adminApi.updateEngineer(id, changes);
    merge(next);
    return next;
  }, [merge]);

  // [CONCEPT: Optimistic update] The switch flips at once; on failure the old list comes back
  // and the error is thrown for the page to toast.
  const setAvailable = useCallback(async (id, isAvailable) => {
    const prev = latest.current;
    setEngineers((list) => list.map((e) => (e.id === id ? { ...e, isAvailable } : e)));
    try {
      merge(await adminApi.updateEngineer(id, { isAvailable }));
    } catch (e) {
      setEngineers(prev);
      throw e;
    }
  }, [merge]);

  // Rejects (409) while the engineer still holds tickets; the dialog shows that message.
  const deactivate = useCallback(async (id) => {
    const next = await adminApi.deactivateEngineer(id);
    merge(next);
    return next;
  }, [merge]);

  // Reactivation is an account change (PATCH /users/:id); the list is reloaded
  // so the engineer comes back with their current workload.
  const reactivate = useCallback(async (id) => {
    await adminApi.updateUser(id, { isActive: true });
    await reload();
  }, [reload]);

  // Active employees for the "Promote existing user" search (q under 2 characters lists them all).
  const findEmployees = useCallback((q) => adminApi.listUsers({ q, role: 'employee', includeInactive: false }), []);

  // An existing employee becomes an engineer with the given profile settings. The new profile
  // (and its workload) only exists server-side, so the whole list is reloaded.
  const promote = useCallback(async (person, profile) => {
    const next = await adminApi.updateUser(person.id, { role: 'engineer', engineer: profile });
    await reload();
    return next;
  }, [reload]);

  return { engineers, categories, loadError, reload, create, update, setAvailable, deactivate, reactivate, findEmployees, promote };
}
