import { admin } from '../../theme/adminTheme';

export const STATUSES = ['Open', 'In Progress', 'Blocked', 'Resolved', 'Closed'];

// Mirrors ALLOWED_TRANSITIONS in backend/app/schemas/incidents.py, so the
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

export const isUnassigned = (i) => i.status === 'Open' && !i.assigneeId;
export const isEscalation = (i) => i.escalation === 'requested';
export const isBlocked = (i) => i.status === 'Blocked';
export const isActive = (i) => i.status !== 'Resolved' && i.status !== 'Closed';
export const needsAction = (i) => isUnassigned(i) || isEscalation(i) || isBlocked(i);

export const FILTERS = {
  action: needsAction,
  unassigned: isUnassigned,
  escalation: isEscalation,
  blocked: isBlocked,
  active: isActive,
  all: () => true,
};

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

export const shortBuilding = (b) => b.split(' · ')[0];
// Floor and seat are optional on an incident, so join what is there.
export const placeLine = (i) => [shortBuilding(i.building), i.floor, i.seat].filter(Boolean).join(', ');

export function age(iso) {
  const h = Math.max(0, (Date.now() - new Date(iso).getTime()) / 3600e3);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

export function rowAction(i) {
  if (isEscalation(i)) return { label: 'Review', variant: 'contained' };
  if (isUnassigned(i)) return { label: 'Assign', variant: 'contained' };
  if (isBlocked(i)) return { label: 'Follow up', variant: 'outlined' };
  return { label: 'View', variant: 'text' };
}

export function rowFlag(i) {
  if (isEscalation(i)) return { text: `Escalation requested${i.escalationReason ? ` — ${i.escalationReason}` : ''}`, color: admin.brown };
  if (isBlocked(i) && i.blockedReason) return { text: `Blocked — ${i.blockedReason}`, color: admin.dangerFg };
  return null;
}

const tally = (list, key) => {
  const m = {};
  list.forEach((i) => { const k = key(i); if (k) m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
};

const DAY = 24 * 3600e3;

export function insights(incidents, engineers) {
  const hotspots = tally(incidents, (i) => [shortBuilding(i.building), i.floor].filter(Boolean).join(', ')).slice(0, 4);
  const repeatSeats = tally(incidents, (i) => (i.seat ? `${shortBuilding(i.building)} seat ${i.seat}` : null)).filter((e) => e[1] > 1);
  const categories = tally(incidents, (i) => i.category).slice(0, 5);
  const byStatus = STATUSES.map((s) => ({ status: s, count: incidents.filter((i) => i.status === s).length }));
  const workload = engineers.map((e) => ({
    ...e,
    load: incidents.filter((i) => i.assigneeId === e.id && (i.status === 'In Progress' || i.status === 'Blocked')).length,
  }));
  // Share of open work touched in the last day: the "kept informed" signal.
  const active = incidents.filter(isActive);
  const fresh = active.filter((i) => Date.now() - new Date(i.updatedAt).getTime() < DAY).length;
  const updatedWithin24hPct = active.length ? Math.round((fresh / active.length) * 100) : null;
  return { hotspots, repeatSeats, categories, byStatus, workload, updatedWithin24hPct };
}
