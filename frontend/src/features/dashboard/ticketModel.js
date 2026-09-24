// Employee dashboard model: ticket status rules, the status progress bar and
// date/greeting formatting. Plain functions with no React, shared by the
// dashboard page and its components (and dashboardHref by other pages).
import { admin } from '../../theme/adminTheme';

// Lifecycle order used by the progress bar.
export const STATUSES = ['Open', 'In Progress', 'Blocked', 'Resolved', 'Closed'];

export const STATUS_DOT = { Open: admin.tan, 'In Progress': admin.brown, Blocked: admin.danger, Resolved: '#9c8a6c', Closed: '#dccfb6' };

// [CONCEPT: Pure helper function] Predicates used with Array.filter.
// Unlike the admin model, "active" here includes Resolved: the reporter still has to confirm the fix.
export const isActive = (t) => t.status !== 'Closed';
export const isDone = (t) => t.status === 'Resolved' || t.status === 'Closed';
// Resolved tickets wait for the reporter to confirm; open ones with unread updates wait for a reply.
export const needsAttention = (t) => t.status === 'Resolved' || (t.unreadCount > 0 && isActive(t));

// One segment per status: earlier steps light tan, the current one red (danger
// red when Blocked), later steps grey.
export function flowBars(status) {
  const at = STATUSES.indexOf(status);
  return STATUSES.map((name, i) => ({
    name,
    current: i === at,
    color: i === at ? (status === 'Blocked' ? admin.danger : admin.red) : i < at ? admin.tanLight : admin.track,
  }));
}

// Relative time such as '5m ago'; clamped at 0 so clock skew never shows a negative value.
export function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// `now` is a parameter (defaulting to the current time) so the function stays easy to test.
export function greeting(firstName, now = new Date()) {
  const h = now.getHours();
  return `${h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}, ${firstName}`;
}

// Link that opens a ticket's drawer on the dashboard.
export const dashboardHref = (ref) => `/dashboard?open=${encodeURIComponent(ref)}`;
