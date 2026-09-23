import { admin } from '../../theme/adminTheme';

export const STATUSES = ['Open', 'In Progress', 'Blocked', 'Resolved', 'Closed'];

export const STATUS_DOT = { Open: admin.tan, 'In Progress': admin.brown, Blocked: admin.danger, Resolved: '#9c8a6c', Closed: '#dccfb6' };

export const isActive = (t) => t.status !== 'Closed';
export const isDone = (t) => t.status === 'Resolved' || t.status === 'Closed';
export const needsAttention = (t) => t.status === 'Resolved' || (t.unreadCount > 0 && isActive(t));

export function flowBars(status) {
  const at = STATUSES.indexOf(status);
  return STATUSES.map((name, i) => ({
    name,
    current: i === at,
    color: i === at ? (status === 'Blocked' ? admin.danger : admin.red) : i < at ? admin.tanLight : admin.track,
  }));
}

export function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function greeting(firstName, now = new Date()) {
  const h = now.getHours();
  return `${h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}, ${firstName}`;
}

// Link that opens a ticket's drawer on the dashboard.
export const dashboardHref = (ref) => `/dashboard?open=${encodeURIComponent(ref)}`;
