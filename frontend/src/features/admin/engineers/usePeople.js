// Data hook for the "All people" tab: loads accounts for the current search
// and filters from the server, and changes one account (rename, role,
// active status) before reloading so rows that no longer match drop out.
import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi } from '../../../services/adminApi';

// Typing pause before a search goes to the server.
const DEBOUNCE_MS = 300;

// [CONCEPT: Custom hook] filters: { q, role, includeInactive }. The tab gets data plus actions.
export default function usePeople({ q, role, includeInactive }) {
  // null until the first load; then Person[].
  const [people, setPeople] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  // [CONCEPT: useRef] Number of the newest request, so a slow older answer cannot overwrite a newer one.
  const latest = useRef(0);

  // [CONCEPT: Async data fetching] The server searches (GET /users?q=&role=); a q under 2 characters lists everyone.
  const reload = useCallback(async () => {
    const n = ++latest.current;
    setLoading(true);
    setLoadError('');
    try {
      const list = await adminApi.listUsers({ q, role, includeInactive });
      if (n === latest.current) setPeople(list);
    } catch (e) {
      if (n === latest.current) setLoadError(e.message);
    }
    if (n === latest.current) setLoading(false);
  }, [q, role, includeInactive]);

  // [CONCEPT: useEffect] Re-fetch when the filters change, after a short pause so each keystroke is not a request.
  // The cleanup cancels the pending timer when the filters change again first.
  useEffect(() => {
    const t = setTimeout(reload, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [reload]);

  // [CONCEPT: Immutable update] Swap in the server copy at once, then reload so the filters apply
  // (e.g. a demoted engineer leaves the Engineers filter). Rejects with ApiError for the dialog.
  const update = useCallback(async (id, changes) => {
    const next = await adminApi.updateUser(id, changes);
    setPeople((list) => list?.map((p) => (p.id === id ? next : p)) ?? list);
    reload();
    return next;
  }, [reload]);

  return { people, loading, loadError, reload, update };
}
