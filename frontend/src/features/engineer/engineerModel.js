// Constants and pure helpers for the engineer workbench: sort order, priority
// colours, row labels and search. Shares the status helpers with the dashboard.
import { admin } from '../../theme/adminTheme';

export { STATUSES, STATUS_DOT, flowBars, timeAgo } from '../dashboard/ticketModel';

// Used when a profile has no ticket limit yet (mock data, older profiles).
export const DEFAULT_CAPACITY = 5;
export const RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 };
export const STATUS_ORDER = ['Open', 'In Progress', 'Blocked', 'Resolved', 'Closed'];

// [background, text] per priority chip.
export const PRIORITY_TAG = {
  Low: ['#ede3cf', '#4a3b2c'],
  Medium: ['#f3e6c8', admin.brown],
  High: [admin.brown, admin.surface],
  Critical: [admin.red, '#fff'],
};

// Counts towards capacity: work not yet resolved.
export const isActiveWork = (i) => ['Open', 'In Progress', 'Blocked'].includes(i.status);

// [CONCEPT: Pure helper function] Row button label for a ticket in the queue.
export function rowAction(i, myId) {
  if (i.assigneeId !== myId) return i.requestedByMe ? 'Requested' : 'Request';
  return { Open: 'Start', Blocked: 'Unblock', Resolved: 'View' }[i.status] ?? 'Update';
}

// "Tower B, floor 7, 7.22"; floor and seat are optional on an incident.
export const locationLine = (i) =>
  [i.buildingName, i.floor && `floor ${i.floor}`, i.seat].filter(Boolean).join(', ');

export function matchesQuery(i, q) {
  if (!q) return true;
  return `${i.ref} ${i.title} ${i.category} ${i.reporter}`.toLowerCase().includes(q.toLowerCase());
}
