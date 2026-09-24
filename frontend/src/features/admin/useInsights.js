// Data hook for the Insights tab's date range: fetches the incidents and
// response-time KPIs reported within the range from the server. For "All
// time" it fetches nothing and the page uses the overview it already holds.
import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../services/adminApi';
import { rangeBounds } from './adminModel';

// `enabled` is false while another tab is showing, so nothing is fetched for a
// hidden tab; turning it back on refetches, picking up changes made meanwhile.
export default function useInsights(range, enabled) {
  // [CONCEPT: useMemo] "Last 7 days" is measured from now, so bounds are only recomputed when the range changes.
  const bounds = useMemo(() => rangeBounds(range), [range]);
  // { incidents, kpis } for `bounds`, or null before the first answer.
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled || !bounds || bounds.invalid) return undefined;
    let live = true;
    setLoading(true);
    setError('');
    // The previous range's figures stay on screen until the new ones arrive.
    adminApi.getInsights(bounds)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [bounds, enabled]);

  return { bounds, data, loading, error };
}
