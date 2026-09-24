// Admin console model: status rules, queue filters, colour maps and the
// insight calculations. No React here, just plain functions and constants the
// admin components share, so the rules live in one place and are easy to test.
import { admin } from '../../theme/adminTheme';

// Lifecycle order; the drawer's progress bar is drawn in this order.
export const STATUSES = ['Open', 'In Progress', 'Blocked', 'Resolved', 'Closed'];

// Mirrors ALLOWED_TRANSITIONS in backend/api/app/schemas/incidents.py, so the
// status picker only offers a move the server would accept.
export const NEXT_STATUSES = {
  Open: ['In Progress', 'Closed'],
  'In Progress': ['Blocked', 'Resolved', 'Open'],
  Blocked: ['In Progress', 'Closed'],
  Resolved: ['In Progress', 'Closed'],
  Closed: [],
};

// Fallback when an engineer has no capacity on record.
export const CAPACITY = 6;

// [CONCEPT: Pure helper function] Each predicate takes an incident and returns a boolean, so it can be passed straight to Array.filter.
export const isUnassigned = (i) => i.status === 'Open' && !i.assigneeId;
export const isEscalation = (i) => i.escalation === 'requested';
export const isBlocked = (i) => i.status === 'Blocked';
export const isActive = (i) => i.status !== 'Resolved' && i.status !== 'Closed';
export const needsAction = (i) => isUnassigned(i) || isEscalation(i) || isBlocked(i);

// Queue filter key -> predicate. The keys match the stat cards and scope
// toggles in QueueTab, which does incidents.filter(FILTERS[filter]).
export const FILTERS = {
  action: needsAction,
  unassigned: isUnassigned,
  escalation: isEscalation,
  blocked: isBlocked,
  active: isActive,
  all: () => true,
};

// Colour lookups. STATUS_BAR and PRIORITY_STYLE hold [background, text] pairs.
export const STATUS_DOT = { Open: admin.tan, 'In Progress': admin.brown, Blocked: admin.danger, Resolved: '#9c8a6c', Closed: '#dccfb6' };
export const STATUS_BAR = {
  Open: [admin.tanLight, admin.ink],
  'In Progress': [admin.brown, admin.surface],
  Blocked: [admin.danger, '#fff'],
  Resolved: ['#bfae90', admin.ink],
  Closed: [admin.track, '#4a3b2c'],
};
export const PRIORITY_STYLE = {
  Low: [admin.track, '#4a3b2c'],
  Medium: [admin.sand, admin.ink],
  High: [admin.ink, admin.surface],
  Critical: [admin.dangerBg, admin.dangerFg],
};

// Building names look like 'HQ North · Munich'; keep the part before the city.
export const shortBuilding = (b) => b.split(' · ')[0];
// Floor and seat are optional on an incident, so join what is there.
export const placeLine = (i) => [shortBuilding(i.building), i.floor, i.seat].filter(Boolean).join(', ');

// Compact age for table cells: '5m', '3h', '2d' (never below '1m'). Clamped
// at 0 so clock skew between server and browser never gives a negative age.
export function age(iso) {
  const h = Math.max(0, (Date.now() - new Date(iso).getTime()) / 3600e3);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

// The button shown at the end of a queue row. Checks run in priority order:
// an escalation outranks being unassigned, which outranks being blocked.
export function rowAction(i) {
  if (isEscalation(i)) return { label: 'Review', variant: 'contained' };
  if (isUnassigned(i)) return { label: 'Assign', variant: 'contained' };
  if (isBlocked(i)) return { label: 'Follow up', variant: 'outlined' };
  return { label: 'View', variant: 'text' };
}

// Optional warning line under a queue row's title; null means no line.
export function rowFlag(i) {
  if (isEscalation(i)) return { text: `Escalation requested${i.escalationReason ? ` — ${i.escalationReason}` : ''}`, color: admin.brown };
  if (isBlocked(i) && i.blockedReason) return { text: `Blocked — ${i.blockedReason}`, color: admin.dangerFg };
  return null;
}

// Counts items by key(item), skipping empty keys, and returns [key, count]
// pairs sorted most frequent first.
const tally = (list, key) => {
  const m = {};
  list.forEach((i) => { const k = key(i); if (k) m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
};

const DAY = 24 * 3600e3;

// Everything the Insights tab charts, derived from the (building- and
// date-filtered) incident list. `load` counts only In Progress and Blocked work
// per engineer, taken from `current` (every incident, whenever reported), since
// workload is about today rather than the chosen date range.
export function insights(incidents, engineers, current = incidents) {
  const hotspots = tally(incidents, (i) => [shortBuilding(i.building), i.floor].filter(Boolean).join(', ')).slice(0, 4);
  const repeatSeats = tally(incidents, (i) => (i.seat ? `${shortBuilding(i.building)} seat ${i.seat}` : null)).filter((e) => e[1] > 1);
  const categories = tally(incidents, (i) => i.category).slice(0, 5);
  const byStatus = STATUSES.map((s) => ({ status: s, count: incidents.filter((i) => i.status === s).length }));
  const workload = engineers.map((e) => ({
    ...e,
    load: current.filter((i) => i.assigneeId === e.id && (i.status === 'In Progress' || i.status === 'Blocked')).length,
  }));
  // Share of open work touched in the last day: the "kept informed" signal.
  const active = incidents.filter(isActive);
  const fresh = active.filter((i) => Date.now() - new Date(i.updatedAt).getTime() < DAY).length;
  const updatedWithin24hPct = active.length ? Math.round((fresh / active.length) * 100) : null;
  return { hotspots, repeatSeats, categories, byStatus, workload, updatedWithin24hPct };
}

// Date-range choices for the Insights tab. `days` counts today, so "Last 7
// days" is today and the six before it.
export const RANGES = [
  { key: 'all', label: 'All time' },
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: 'custom', label: 'Custom range' },
];
export const DEFAULT_RANGE = { key: 'all', from: '', to: '' };

// Turns the picker state ({ key, from: 'YYYY-MM-DD', to }) into Dates in the
// admin's own timezone, whole days inclusive. Returns null for "All time" (no
// filter) and { invalid: true } for a custom range that ends before it starts.
export function rangeBounds({ key, from, to }) {
  if (key === 'all') return null;
  const preset = RANGES.find((r) => r.key === key);
  if (preset?.days) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (preset.days - 1));
    return { from: start, to: null };
  }
  // Appending a time without a zone makes Date parse it as local time.
  const start = from ? new Date(`${from}T00:00:00`) : null;
  const end = to ? new Date(`${to}T23:59:59.999`) : null;
  if (start && end && start > end) return { invalid: true };
  return start || end ? { from: start, to: end } : null;
}
