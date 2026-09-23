import { request } from './http';
import { STATUS_LABEL, toRef } from './dashboardApi';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

// Service targets shown beside the actuals on the Insights tab. The backend
// reports what happened; the targets are a policy, kept here until an admin
// can set them.
export const TARGETS = { ackMinutes: 60, resolveDays: 3 };

// ---------------------------------------------------------------------------
// Backend -> design shapes. `AdminIncident` is keyed by a display ref
// (INC-0042) that carries the numeric id, so it round-trips.
// ---------------------------------------------------------------------------

const STATUS_KEY = Object.fromEntries(Object.entries(STATUS_LABEL).map(([k, v]) => [v, k]));
const ESCALATION = { not_requested: null, requested: 'requested', approved: 'approved', rejected: 'declined' };
// Approving an escalation raises the priority one level.
const RAISE = { Low: 'medium', Medium: 'high', High: 'critical', Critical: null };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const toId = (ref) => Number(String(ref).replace(/^INC-/, ''));

function fromSummary(row) {
  return {
    ref: toRef(row.id),
    id: row.id,
    title: row.title,
    building: row.building_name,
    floor: row.floor_label ?? null,
    seat: row.seat_code ?? null,
    category: row.category.label,
    status: STATUS_LABEL[row.status],
    priority: cap(row.priority),
    assigneeId: row.assignee_id ?? null,
    assigneeName: row.assignee_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reporter: row.reporter_name,
    escalation: ESCALATION[row.escalation_status],
    escalationReason: row.escalation_reason ?? null,
    blockedReason: row.blocked_reason ?? null,
    notes: [],
    detailLoaded: false,
  };
}

function fromDetail(d, notes) {
  return {
    ref: toRef(d.id),
    id: d.id,
    title: d.title,
    building: d.location.building_name,
    floor: d.location.floor_label ?? null,
    seat: d.location.seat_code ?? null,
    category: d.category.label,
    status: STATUS_LABEL[d.status],
    priority: cap(d.priority),
    assigneeId: d.assignee?.id ?? null,
    assigneeName: d.assignee?.full_name ?? null,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    reporter: d.reporter.full_name,
    escalation: ESCALATION[d.escalation_status],
    escalationReason: d.escalation_reason ?? null,
    blockedReason: d.blocked_reason ?? null,
    notes: notes.map((n) => ({ id: n.id, author: n.author.full_name, createdAt: n.created_at, text: n.body })),
    detailLoaded: true,
  };
}

function fromWorkload(r) {
  let availability = 'Available';
  if (!r.is_available) availability = 'On leave';
  else if (r.active_tickets >= r.max_active_tickets) availability = 'Busy';
  return { id: r.user_id, name: r.full_name, skill: r.specialization ?? 'General facilities', availability, capacity: r.max_active_tickets };
}

function kpisFrom(times) {
  const t = times.overall;
  return {
    ackMinutes: t.avg_hours_to_acknowledge == null ? null : Math.round(t.avg_hours_to_acknowledge * 60),
    ackTargetMinutes: TARGETS.ackMinutes,
    resolveDays: t.avg_hours_to_resolve == null ? null : Math.round((t.avg_hours_to_resolve / 24) * 10) / 10,
    resolveTargetDays: TARGETS.resolveDays,
    // Placeholder: the backend has no reopen rate yet.
    reopenedPct: null,
  };
}

// An administrator's list is everything; page through it (capped, so a
// runaway table cannot hang the screen).
async function listAll() {
  const items = [];
  for (let page = 1; page <= 5; page += 1) {
    const res = await request(`/incidents?sort=-created_at&limit=100&page=${page}`);
    items.push(...res.items);
    if (items.length >= res.total || res.items.length === 0) break;
  }
  return items;
}

async function getIncident(ref) {
  const id = toId(ref);
  const [detail, notes] = await Promise.all([
    request(`/incidents/${id}`),
    request(`/incidents/${id}/notes?order=desc&limit=100`),
  ]);
  return fromDetail(detail, notes.items);
}

const api = {
  // -> { incidents: AdminIncident[], engineers: Engineer[], buildings: string[], kpis: Kpis }
  getAdminOverview: async () => {
    const [rows, workload, buildings, times] = await Promise.all([
      listAll(),
      request('/reports/engineer-workload'),
      request('/buildings'),
      request('/reports/response-times'),
    ]);
    return {
      incidents: rows.map(fromSummary),
      engineers: workload.rows.map(fromWorkload),
      buildings: buildings.map((b) => b.name),
      kpis: kpisFrom(times),
    };
  },
  // -> AdminIncident with notes
  getIncident,
  // Every transition returns the server's version of the incident.
  assign: async (ref, engineerId, { startWork = false } = {}) => {
    const id = toId(ref);
    await request(`/incidents/${id}/assign`, { method: 'POST', body: { engineer_id: engineerId } });
    if (startWork) await request(`/incidents/${id}/status`, { method: 'POST', body: { status: 'in_progress' } });
    return getIncident(ref);
  },
  setStatus: async (ref, status, reason) => {
    await request(`/incidents/${toId(ref)}/status`, { method: 'POST', body: { status: STATUS_KEY[status], reason: reason || null } });
    return getIncident(ref);
  },
  // decision: 'approve' | 'decline'. Approving also raises the priority, as
  // the design promises; the backend records the two as separate events.
  decideEscalation: async (ref, decision, priority) => {
    const id = toId(ref);
    await request(`/incidents/${id}/escalation/decision`, { method: 'POST', body: { approve: decision === 'approve' } });
    const next = decision === 'approve' ? RAISE[priority] : null;
    if (next) await request(`/incidents/${id}/priority`, { method: 'POST', body: { priority: next, reason: 'Escalation approved' } });
    return getIncident(ref);
  },
  addNote: async (ref, text) => {
    await request(`/incidents/${toId(ref)}/notes`, { method: 'POST', body: { body: text } });
    return getIncident(ref);
  },
};

// ---------------------------------------------------------------------------
// Mocks (VITE_USE_MOCKS=true), from the design.
// ---------------------------------------------------------------------------

const ENGINEERS = [
  { id: 1, name: 'A. Klein', skill: 'HVAC & plumbing', availability: 'Available', capacity: 6 },
  { id: 2, name: 'S. Raman', skill: 'Network & Wi-Fi', availability: 'Busy', capacity: 6 },
  { id: 3, name: 'L. Duarte', skill: 'AV & displays', availability: 'Available', capacity: 6 },
  { id: 4, name: 'T. Novak', skill: 'General facilities', availability: 'Available', capacity: 6 },
  { id: 5, name: 'J. Mbeki', skill: 'Electrical', availability: 'On leave', capacity: 6 },
];

const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const row = (ref, title, building, floor, seat, category, status, priority, assigneeId, ageHours, reporter, escalation, reason) => ({
  ref, id: toId(ref), title, building, floor, seat: seat || null, category, status, priority,
  assigneeId: assigneeId || null, assigneeName: ENGINEERS.find((e) => e.id === assigneeId)?.name ?? null,
  createdAt: ago(ageHours), updatedAt: ago(Math.min(ageHours, 30)), reporter,
  escalation, escalationReason: escalation === 'requested' ? reason : null, blockedReason: status === 'Blocked' ? reason : null,
  notes: [{ id: ref, author: reporter, createdAt: ago(ageHours), text: `Reported: ${title}.` }], detailLoaded: true,
});

let db = {
  buildings: ['HQ North · Munich', 'Tower B · Austin', 'Docklands · Dublin'],
  engineers: ENGINEERS,
  kpis: { ackMinutes: 38, ackTargetMinutes: 60, resolveDays: 3.4, resolveTargetDays: 3, reopenedPct: 6 },
  incidents: [
    row('INC-0419', 'Monitor won’t turn on', 'HQ North · Munich', 'Level 3', '3.14', 'Monitor', 'Open', 'Medium', null, 1, 'M. Okafor', null),
    row('INC-0418', 'Meeting room projector shows no signal', 'Tower B · Austin', 'Level 7', 'Condor', 'Meeting room AV', 'Open', 'High', null, 3, 'D. Price', 'requested', 'Board review in this room at 14:00 today.'),
    row('INC-0417', 'Toilets out of order, 2nd floor', 'Docklands · Dublin', 'Level 2', null, 'Plumbing', 'Open', 'High', 1, 5, 'C. Byrne', 'requested', 'Only facilities on the floor for 40 people.'),
    row('INC-0412', 'Air conditioning not cooling, east wing', 'HQ North · Munich', 'Level 3', null, 'Temperature / HVAC', 'In Progress', 'High', 1, 48, 'M. Okafor', 'approved'),
    row('INC-0411', 'Dock not detecting laptop', 'HQ North · Munich', 'Level 3', '3.08', 'Dock / peripherals', 'In Progress', 'Low', 3, 48, 'P. Weber', null),
    row('INC-0409', 'Flickering light above desk 3.20', 'HQ North · Munich', 'Level 3', '3.20', 'Lighting', 'In Progress', 'Medium', 1, 72, 'A. Schulz', null),
    row('INC-0406', 'Badge reader rejects cards at north door', 'Tower B · Austin', 'Ground Floor', null, 'Access / doors', 'Blocked', 'Critical', 4, 72, 'K. Ortiz', null, 'Waiting on a replacement reader from the vendor, due 25 Sep.'),
    row('INC-0398', 'Wi-Fi drops in the open-plan area', 'Tower B · Austin', 'Level 7', null, 'Wi-Fi / network', 'Blocked', 'High', 2, 144, 'D. Price', null, 'Needs after-hours access to the ceiling access point.'),
    row('INC-0395', 'Chair hydraulics broken', 'HQ North · Munich', 'Level 3', '3.14', 'Desk or chair', 'Blocked', 'Low', 4, 192, 'M. Okafor', null, 'Replacement chair on order.'),
    row('INC-0392', 'Printer jams on every job', 'Docklands · Dublin', 'Ground Floor', null, 'Printer', 'In Progress', 'Low', 3, 96, 'S. Walsh', null),
    row('INC-0390', 'Wi-Fi slow in meeting rooms', 'Tower B · Austin', 'Level 7', null, 'Wi-Fi / network', 'In Progress', 'Medium', 2, 120, 'L. Chen', null),
    row('INC-0388', 'Heating too high, west side', 'HQ North · Munich', 'Level 3', null, 'Temperature / HVAC', 'Resolved', 'Medium', 1, 168, 'A. Schulz', null),
    row('INC-0384', 'Dead pixels on second screen', 'HQ North · Munich', 'Level 3', '3.14', 'Monitor', 'Resolved', 'Low', 3, 216, 'M. Okafor', null),
    row('INC-0380', 'Leaking tap in kitchen', 'Docklands · Dublin', 'Level 2', null, 'Plumbing', 'Closed', 'Medium', 1, 288, 'C. Byrne', null),
    row('INC-0377', 'Wi-Fi drops near stairwell', 'Tower B · Austin', 'Level 7', null, 'Wi-Fi / network', 'Closed', 'High', 2, 336, 'L. Chen', null),
    row('INC-0371', 'Rattling noise from AC vent', 'HQ North · Munich', 'Level 3', null, 'Temperature / HVAC', 'Closed', 'Low', 1, 432, 'P. Weber', null),
  ],
};

const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
const find = (ref) => db.incidents.find((i) => i.ref === ref);
const patch = (ref, p) => {
  db = { ...db, incidents: db.incidents.map((i) => (i.ref === ref ? { ...i, ...p, updatedAt: new Date().toISOString() } : i)) };
  return structuredClone(find(ref));
};

const mocks = {
  getAdminOverview: async () => { await wait(); return structuredClone(db); },
  getIncident: async (ref) => { await wait(100); return structuredClone(find(ref)); },
  assign: async (ref, engineerId, { startWork = false } = {}) => {
    await wait(120);
    const e = ENGINEERS.find((x) => x.id === engineerId);
    return patch(ref, { assigneeId: engineerId, assigneeName: e?.name ?? null, ...(startWork ? { status: 'In Progress' } : {}) });
  },
  setStatus: async (ref, status, reason) => { await wait(120); return patch(ref, { status, blockedReason: status === 'Blocked' ? reason : null }); },
  decideEscalation: async (ref, decision, priority) => {
    await wait(120);
    const raised = decision === 'approve' ? cap(RAISE[priority]) : null;
    return patch(ref, { escalation: decision === 'approve' ? 'approved' : 'declined', ...(raised ? { priority: raised } : {}) });
  },
  addNote: async (ref, text) => {
    await wait(120);
    const i = find(ref);
    return patch(ref, { notes: [{ id: Date.now(), author: 'R. Vasquez', createdAt: new Date().toISOString(), text }, ...i.notes] });
  },
};

export const adminApi = USE_MOCKS ? mocks : api;
