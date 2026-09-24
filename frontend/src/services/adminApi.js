// Service layer for the admin console (AdminIncidentsPage, AdminEngineersPage):
// wraps the incident, report, building, engineer-profile, people (user
// accounts) and job-request endpoints, reshapes them for the UI, and has
// in-memory mocks used when VITE_USE_MOCKS=true.
// [CONCEPT: Service layer] Components call adminApi.* and never build URLs or parse backend shapes themselves.
import { ApiError, request } from './http';
import { getSession } from './session';
import { STATUS_LABEL, toRef } from './dashboardApi';

// [CONCEPT: Environment variables] Vite exposes VITE_* vars on import.meta.env as strings, hence the === 'true'.
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

// Service targets shown beside the actuals on the Insights tab. The backend
// reports what happened; the targets are a policy, kept here until an admin
// can set them.
export const TARGETS = { ackMinutes: 60, resolveDays: 3 };

// ---------------------------------------------------------------------------
// Backend -> design shapes. `AdminIncident` is keyed by a display ref
// (INC-0042) that carries the numeric id, so it round-trips.
// ---------------------------------------------------------------------------

// Reverse of STATUS_LABEL ('In Progress' -> 'in_progress'), used when sending a status back to the server.
const STATUS_KEY = Object.fromEntries(Object.entries(STATUS_LABEL).map(([k, v]) => [v, k]));
const ESCALATION = { not_requested: null, requested: 'requested', approved: 'approved', rejected: 'declined' };
// Approving an escalation raises the priority one level.
const RAISE = { Low: 'medium', Medium: 'high', High: 'critical', Critical: null };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const toId = (ref) => Number(String(ref).replace(/^INC-/, ''));

// [CONCEPT: Pure helper function] Maps one row of GET /incidents to an AdminIncident.
// List rows carry no notes, so detailLoaded: false tells the UI to fetch the full incident when opened.
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

// Same AdminIncident shape, built from GET /incidents/:id (nested location/assignee objects) plus its notes.
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
    // Only the full incident carries these; the edit form starts from them.
    description: d.description,
    categoryId: d.category.id,
    notes: notes.map((n) => ({ id: n.id, author: n.author.full_name, authorId: n.author.id, createdAt: n.created_at, text: n.body })),
    detailLoaded: true,
  };
}

// One engineer from /reports/engineer-workload. "Busy" means at or over their ticket cap;
// being unavailable ("On leave") wins over both.
function fromWorkload(r) {
  let availability = 'Available';
  if (!r.is_available) availability = 'On leave';
  else if (r.active_tickets >= r.max_active_tickets) availability = 'Busy';
  return { id: r.user_id, name: r.full_name, skill: r.specialization ?? 'General facilities', availability, capacity: r.max_active_tickets };
}

// [CONCEPT: Pure helper function] One EngineerOut (GET /engineers) as an EngineerProfile for the
// engineers page. activeTickets comes from the workload report, which only lists active
// accounts; an inactive engineer holds nothing (deactivation requires it), and null means unknown.
function fromEngineer(e, activeTickets = null) {
  return {
    id: e.user_id,
    email: e.email,
    name: e.full_name,
    phone: e.phone ?? null,
    specializationId: e.specialization?.id ?? null,
    specialization: e.specialization?.label ?? null,
    isActive: e.is_active,
    isAvailable: e.is_available,
    capacity: e.max_active_tickets,
    activeTickets: e.is_active ? activeTickets : 0,
    createdAt: e.created_at,
  };
}

// Form field names (UI) <-> backend field names. Used both to build request
// bodies and to rename server validation errors so each lands under its input.
const ENGINEER_FIELDS = {
  email: 'email',
  password: 'password',
  name: 'full_name',
  specializationId: 'specialization_id',
  phone: 'phone',
  capacity: 'max_active_tickets',
  isAvailable: 'is_available',
};
const FIELD_OF = Object.fromEntries(Object.entries(ENGINEER_FIELDS).map(([ui, be]) => [be, ui]));

// Only keys present in `form` are sent, so an edit leaves the rest alone (PATCH semantics).
// An empty phone is sent as null so clearing the box clears the number.
function engineerBody(form) {
  const body = {};
  Object.entries(ENGINEER_FIELDS).forEach(([ui, be]) => {
    if (form[ui] === undefined) return;
    body[be] = ui === 'phone' ? (form.phone?.trim() || null) : form[ui];
  });
  if (typeof body.full_name === 'string') body.full_name = body.full_name.trim();
  return body;
}

// Re-throws a server error with its `fields` renamed to the form's names. A
// duplicate email (409) and an unknown specialisation (404) carry no fields,
// so they are pinned to the matching input here.
function asFormError(e) {
  if (!(e instanceof ApiError)) throw e;
  const fields = Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [FIELD_OF[k] ?? k, v]));
  if (e.status === 409 && !fields.email) fields.email = e.message;
  if (e.status === 404 && /specialisation/i.test(e.message)) fields.specializationId = e.message;
  throw new ApiError(e.message, fields, e.status);
}

// [CONCEPT: Pure helper function] One UserAdminOut (GET /users) as a Person for the people list.
// The workplace ids are left out: the people screen does not show them.
function fromUser(u) {
  return { id: u.id, email: u.email, name: u.full_name, role: u.role, isActive: u.is_active, createdAt: u.created_at };
}

// Server field names in a PATCH /users error -> the people forms' field names.
// Nested engineer settings come back dotted ("engineer.max_active_tickets").
const USER_FIELD_OF = {
  full_name: 'name',
  role: 'role',
  is_active: 'isActive',
  'engineer.specialization_id': 'specializationId',
  'engineer.phone': 'phone',
  'engineer.max_active_tickets': 'capacity',
  'engineer.is_available': 'isAvailable',
};

// changes: any of { name, role, isActive, engineer: { specializationId, phone, capacity, isAvailable } }.
// Only the keys given are sent (PATCH semantics); the server treats a missing key as "keep".
function userBody(changes) {
  const body = {};
  if (changes.name !== undefined) body.full_name = changes.name.trim();
  if (changes.role !== undefined) body.role = changes.role;
  if (changes.isActive !== undefined) body.is_active = changes.isActive;
  if (changes.engineer) {
    const e = changes.engineer;
    body.engineer = {};
    if (e.specializationId !== undefined) body.engineer.specialization_id = e.specializationId;
    if (e.phone !== undefined) body.engineer.phone = e.phone?.trim() || null;
    if (e.capacity !== undefined) body.engineer.max_active_tickets = e.capacity;
    if (e.isAvailable !== undefined) body.engineer.is_available = e.isAvailable;
  }
  return body;
}

// Like asFormError, for the people forms. 403 (yourself) and 409 (last admin,
// active tickets) have no field: their message is shown as the dialog's alert.
function asUserError(e) {
  if (!(e instanceof ApiError)) throw e;
  const fields = Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [USER_FIELD_OF[k] ?? k, v]));
  if (e.status === 404 && /specialisation/i.test(e.message)) fields.specializationId = e.message;
  throw new ApiError(e.message, fields, e.status);
}

// One pending AssignmentRequestOut as a JobRequest. `ref` lets the UI match it to an AdminIncident.
function fromRequest(r) {
  return {
    id: r.id,
    incidentId: r.incident_id,
    ref: toRef(r.incident_id),
    incidentTitle: r.incident_title,
    engineerId: r.engineer_id,
    engineerName: r.engineer_name,
    note: r.note ?? null,
    createdAt: r.created_at,
  };
}

// The backend reports hours; the UI shows minutes to acknowledge and days (1 decimal) to resolve.
// null means "no data yet" and is kept as null rather than shown as 0.
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
// At most 5 pages of 100, i.e. 500 incidents. Stops early once `total` is reached or a page is empty.
// `extra` is more query string (already encoded), such as a created_from/created_to range.
async function listAll(extra = '') {
  const items = [];
  for (let page = 1; page <= 5; page += 1) {
    const res = await request(`/incidents?sort=-created_at&limit=100&page=${page}${extra}`);
    items.push(...res.items);
    if (items.length >= res.total || res.items.length === 0) break;
  }
  return items;
}

// Date range -> "&created_from=...&created_to=..." for the incident list and
// the response-times report. Either end may be null (open-ended).
// [CONCEPT: URLSearchParams] Encodes the ISO timestamps (their "+" and ":") safely.
function rangeQuery({ from, to }) {
  const q = new URLSearchParams();
  if (from) q.set('created_from', from.toISOString());
  if (to) q.set('created_to', to.toISOString());
  const s = q.toString();
  return s ? `&${s}` : '';
}

async function getIncident(ref) {
  const id = toId(ref);
  // [CONCEPT: Async data fetching] Promise.all runs both requests in parallel; if either fails, the whole call rejects.
  const [detail, notes] = await Promise.all([
    request(`/incidents/${id}`),
    request(`/incidents/${id}/notes?order=desc&limit=100`),
  ]);
  return fromDetail(detail, notes.items);
}

// Real backend implementation. The mock object further down has the same method names and return shapes.
const api = {
  // -> { incidents: AdminIncident[], engineers: Engineer[], buildings: string[], kpis: Kpis, requests: JobRequest[] }
  getAdminOverview: async () => {
    const [rows, workload, buildings, times, requests] = await Promise.all([
      listAll(),
      request('/reports/engineer-workload'),
      request('/buildings'),
      request('/reports/response-times'),
      request('/assignment-requests'),
    ]);
    return {
      incidents: rows.map(fromSummary),
      engineers: workload.rows.map(fromWorkload),
      buildings: buildings.map((b) => b.name),
      kpis: kpisFrom(times),
      requests: requests.map(fromRequest),
    };
  },
  // Insights for incidents reported within { from, to } (Dates, either may be null).
  // The server filters, so the range is not limited to the newest 500 incidents
  // the overview holds; the BRIN index on incidents.created_at serves it.
  // -> { incidents: AdminIncident[], kpis: Kpis }
  getInsights: async (range) => {
    const q = rangeQuery(range);
    const [rows, times] = await Promise.all([
      listAll(q),
      request(`/reports/response-times?${q.slice(1)}`),
    ]);
    return { incidents: rows.map(fromSummary), kpis: kpisFrom(times) };
  },
  // -> AdminIncident with notes
  getIncident,
  // Every transition returns the server's version of the incident.
  // startWork: also move an open ticket to In Progress; the server does both in one transaction.
  assign: async (ref, engineerId, { startWork = false } = {}) => {
    await request(`/incidents/${toId(ref)}/assign`, { method: 'POST', body: { engineer_id: engineerId, start_work: startWork } });
    return getIncident(ref);
  },
  // status is a UI label ('Blocked'); the reason is sent as null when empty.
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
  // An admin may edit or delete any note. Both return the refreshed incident.
  editNote: async (ref, noteId, text) => {
    await request(`/notes/${noteId}`, { method: 'PATCH', body: { body: text } });
    return getIncident(ref);
  },
  deleteNote: async (ref, noteId) => {
    await request(`/notes/${noteId}`, { method: 'DELETE' });
    return getIncident(ref);
  },
  // changes: any of { title, description, categoryId } -> AdminIncident. An admin may edit at any status.
  // Only the keys given are sent (PATCH semantics); the location is not edited here.
  updateIncident: async (ref, changes) => {
    const body = {};
    if (changes.title !== undefined) body.title = changes.title.trim();
    if (changes.description !== undefined) body.description = changes.description.trim();
    if (changes.categoryId !== undefined) body.category_id = changes.categoryId;
    await request(`/incidents/${toId(ref)}`, { method: 'PATCH', body });
    return getIncident(ref);
  },
  // Permanent: the incident goes with its notes and timeline. -> { ref }
  deleteIncident: async (ref) => {
    await request(`/incidents/${toId(ref)}`, { method: 'DELETE' });
    return { ref };
  },

  // --- Engineers' job requests (pending only, oldest first) ---
  // -> JobRequest[]
  listRequests: async () => (await request('/assignment-requests')).map(fromRequest),
  // Approving is assign(ref, engineerId): the backend then drops every request on that incident.
  // -> null (204)
  declineRequest: async (id) => { await request(`/assignment-requests/${id}`, { method: 'DELETE' }); return null; },

  // --- Engineer profiles ---
  // Inactive accounts included, so the page can show them muted. The workload
  // report supplies the active ticket count, which EngineerOut lacks.
  // -> EngineerProfile[]
  listEngineers: async () => {
    const [list, workload] = await Promise.all([
      request('/engineers?include_inactive=true'),
      request('/reports/engineer-workload'),
    ]);
    const load = new Map(workload.rows.map((r) => [r.user_id, r.active_tickets]));
    return list.map((e) => fromEngineer(e, load.get(e.user_id) ?? null));
  },
  // Active categories only, for the specialisation picker. -> { id, label, type }[]
  listCategories: async () => (await request('/categories')).map((c) => ({ id: c.id, label: c.label, type: c.category_type })),
  // form: { email, password, name, specializationId, phone, capacity, isAvailable } -> EngineerProfile.
  // Rejects with ApiError whose `fields` use the form's names.
  createEngineer: async (form) => {
    try {
      return fromEngineer(await request('/engineers', { method: 'POST', body: engineerBody(form) }), 0);
    } catch (e) { return asFormError(e); }
  },
  // changes: any of { name, specializationId, phone, capacity, isAvailable } -> EngineerProfile
  // (activeTickets null: PATCH does not report it, so callers keep the value they had).
  updateEngineer: async (id, changes) => {
    try {
      return fromEngineer(await request(`/engineers/${id}`, { method: 'PATCH', body: engineerBody(changes) }));
    } catch (e) { return asFormError(e); }
  },
  // Soft delete. 409 (ApiError with the server's message) while they still hold active tickets.
  // There is no reactivation endpoint. -> EngineerProfile with isActive false
  deactivateEngineer: async (id) => fromEngineer(await request(`/engineers/${id}`, { method: 'DELETE' })),

  // --- People (every account; administrators only) ---
  // q under 2 characters is not sent (the server rejects it) so the full list shows.
  // role: 'employee' | 'engineer' | 'admin' | null for all. -> Person[] sorted by name.
  listUsers: async ({ q = '', role = null, includeInactive = true } = {}) => {
    const params = new URLSearchParams({ include_inactive: String(includeInactive) });
    if (q.trim().length >= 2) params.set('q', q.trim());
    if (role) params.set('role', role);
    return (await request(`/users?${params}`)).map(fromUser);
  },
  // changes: any of { name, role, isActive, engineer: { specializationId, phone, capacity, isAvailable } } -> Person.
  // role 'engineer' promotes (creating or reviving the engineer profile with `engineer`).
  // Rejects with ApiError: 403 own role / self-deactivation, 409 last admin or active tickets,
  // 400 with `fields` renamed to the form's names.
  updateUser: async (id, changes) => {
    try {
      return fromUser(await request(`/users/${id}`, { method: 'PATCH', body: userBody(changes) }));
    } catch (e) { return asUserError(e); }
  },
};

// ---------------------------------------------------------------------------
// Mocks (VITE_USE_MOCKS=true), from the design.
// ---------------------------------------------------------------------------

// [CONCEPT: Mock data] Fake engineers and incidents so the console works without a backend.
const ENGINEERS = [
  { id: 1, name: 'A. Klein', skill: 'HVAC & plumbing', availability: 'Available', capacity: 6 },
  { id: 2, name: 'S. Raman', skill: 'Network & Wi-Fi', availability: 'Busy', capacity: 6 },
  { id: 3, name: 'L. Duarte', skill: 'AV & displays', availability: 'Available', capacity: 6 },
  { id: 4, name: 'T. Novak', skill: 'General facilities', availability: 'Available', capacity: 6 },
  { id: 5, name: 'J. Mbeki', skill: 'Electrical', availability: 'On leave', capacity: 6 },
];

// ago(h): an ISO timestamp h hours before now, so mock ages stay realistic whenever the app runs.
const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
// Builds one mock AdminIncident from positional values. `reason` fills either the escalation
// reason or the blocked reason, depending on the escalation and status given.
const row = (ref, title, building, floor, seat, category, status, priority, assigneeId, ageHours, reporter, escalation, reason) => ({
  ref, id: toId(ref), title, building, floor, seat: seat || null, category, status, priority,
  assigneeId: assigneeId || null, assigneeName: ENGINEERS.find((e) => e.id === assigneeId)?.name ?? null,
  createdAt: ago(ageHours), updatedAt: ago(Math.min(ageHours, 30)), reporter,
  escalation, escalationReason: escalation === 'requested' ? reason : null, blockedReason: status === 'Blocked' ? reason : null,
  description: `Reported: ${title}.`, categoryId: null,
  notes: [{ id: ref, author: reporter, authorId: null, createdAt: ago(ageHours), text: `Reported: ${title}.` }], detailLoaded: true,
});

// In-memory "database" for mock mode. It lives only in this module, so a page reload resets it.
let db = {
  buildings: ['HQ North · Munich', 'Tower B · Austin', 'Docklands · Dublin'],
  engineers: ENGINEERS,
  // Full engineer profiles for the engineers page; `engineers` above is the
  // workload view of the same people and is kept in step by the mocks below.
  profiles: [
    ...ENGINEERS.map((e, n) => ({
      id: e.id, email: `${e.name.replace(/\W/g, '').toLowerCase()}@acme.inc`, name: e.name, phone: n % 2 ? null : `+49 89 5550 10${n}`,
      specializationId: n + 1, specialization: e.skill, isActive: true, isAvailable: e.availability !== 'On leave',
      capacity: e.capacity, activeTickets: null, createdAt: ago(24 * 90),
    })),
    { id: 6, email: 'r.okoye@acme.inc', name: 'R. Okoye', phone: null, specializationId: null, specialization: null, isActive: false, isAvailable: false, capacity: 5, activeTickets: 0, createdAt: ago(24 * 400) },
  ],
  // Every account, for the people list. Engineers share ids with `profiles`;
  // a profile only counts as an engineer while its account's role is engineer.
  accounts: [
    ...ENGINEERS.map((e) => ({ id: e.id, email: `${e.name.replace(/\W/g, '').toLowerCase()}@acme.inc`, name: e.name, role: 'engineer', isActive: true, createdAt: ago(24 * 90) })),
    { id: 6, email: 'r.okoye@acme.inc', name: 'R. Okoye', role: 'engineer', isActive: false, createdAt: ago(24 * 400) },
    { id: 100, email: 'r.vasquez@acme.inc', name: 'R. Vasquez', role: 'admin', isActive: true, createdAt: ago(24 * 500) },
    { id: 101, email: 'n.haddad@acme.inc', name: 'N. Haddad', role: 'admin', isActive: true, createdAt: ago(24 * 200) },
    ...['M. Okafor', 'D. Price', 'C. Byrne', 'P. Weber', 'A. Schulz', 'K. Ortiz', 'S. Walsh', 'L. Chen'].map((name, n) => ({
      id: 200 + n, email: `${name.replace(/\W/g, '').toLowerCase()}@acme.inc`, name, role: 'employee', isActive: n !== 5, createdAt: ago(24 * (30 + n * 11)),
    })),
  ],
  // Pending job requests, oldest first like the real endpoint.
  requests: [
    { id: 1, incidentId: 418, ref: 'INC-0418', incidentTitle: 'Meeting room projector shows no signal', engineerId: 3, engineerName: 'L. Duarte', note: 'I’m in Tower B this afternoon and know that room.', createdAt: ago(2.5) },
    { id: 2, incidentId: 418, ref: 'INC-0418', incidentTitle: 'Meeting room projector shows no signal', engineerId: 4, engineerName: 'T. Novak', note: null, createdAt: ago(1.5) },
    { id: 3, incidentId: 419, ref: 'INC-0419', incidentTitle: 'Monitor won’t turn on', engineerId: 3, engineerName: 'L. Duarte', note: 'Can swap it for a spare from stock.', createdAt: ago(0.5) },
  ],
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

// Specialisation choices for the mock engineer form; ids 1-5 match the profiles above.
const CATEGORIES = ['HVAC & plumbing', 'Network & Wi-Fi', 'AV & displays', 'General facilities', 'Electrical', 'Lighting']
  .map((label, n) => ({ id: n + 1, label, type: n === 1 || n === 2 ? 'technology' : 'facility' }));

// Fake network delay, so loading states are visible in mock mode.
const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
const find = (ref) => db.incidents.find((i) => i.ref === ref);
// [CONCEPT: Immutable update] Builds a new db and a new incident object instead of mutating the old ones.
// structuredClone hands the caller a deep copy, so UI code cannot change the mock db by accident.
const patch = (ref, p) => {
  db = { ...db, incidents: db.incidents.map((i) => (i.ref === ref ? { ...i, ...p, updatedAt: new Date().toISOString() } : i)) };
  return structuredClone(find(ref));
};

// Open, in-progress and blocked tickets held by one engineer, like the workload report counts them.
const mockLoad = (id) => db.incidents.filter((i) => i.assigneeId === id && ['Open', 'In Progress', 'Blocked'].includes(i.status)).length;
const withLoad = (p) => structuredClone({ ...p, activeTickets: p.isActive ? mockLoad(p.id) : 0 });
// Profiles whose account is currently an engineer; a demoted engineer's profile is kept but hidden.
const isEngineer = (p) => db.accounts.some((a) => a.id === p.id && a.role === 'engineer');
// Rebuilds the incident console's workload list from the profiles, so a new,
// edited, demoted or deactivated engineer shows up in the assignment picker too.
const syncWorkload = () => {
  db = {
    ...db,
    engineers: db.profiles.filter((p) => p.isActive && isEngineer(p)).map((p) => {
      let availability = 'Available';
      if (!p.isAvailable) availability = 'On leave';
      else if (mockLoad(p.id) >= p.capacity) availability = 'Busy';
      return { id: p.id, name: p.name, skill: p.specialization ?? 'General facilities', availability, capacity: p.capacity };
    }),
  };
};

const mocks = {
  getAdminOverview: async () => { await wait(); return structuredClone(db); },
  // The mock KPIs are fixed figures, so only the incident list follows the range.
  getInsights: async ({ from, to }) => {
    await wait();
    const inRange = (i) => (!from || new Date(i.createdAt) >= from) && (!to || new Date(i.createdAt) <= to);
    return structuredClone({ incidents: db.incidents.filter(inRange), kpis: db.kpis });
  },
  getIncident: async (ref) => { await wait(100); return structuredClone(find(ref)); },
  assign: async (ref, engineerId, { startWork = false } = {}) => {
    await wait(120);
    const e = db.engineers.find((x) => x.id === engineerId);
    // Like the backend, assigning clears every pending request on the incident.
    db = { ...db, requests: db.requests.filter((r) => r.ref !== ref) };
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
    // Newest note first, matching the real API's order=desc.
    const i = find(ref);
    return patch(ref, { notes: [{ id: Date.now(), author: 'R. Vasquez', authorId: 0, createdAt: new Date().toISOString(), text }, ...i.notes] });
  },
  editNote: async (ref, noteId, text) => {
    await wait(120);
    return patch(ref, { notes: find(ref).notes.map((n) => (n.id === noteId ? { ...n, text } : n)) });
  },
  deleteNote: async (ref, noteId) => {
    await wait(120);
    return patch(ref, { notes: find(ref).notes.filter((n) => n.id !== noteId) });
  },
  updateIncident: async (ref, changes) => {
    await wait(120);
    const c = { ...changes };
    // The mock stores the label too, which the real backend returns on its own.
    if (c.categoryId !== undefined) c.category = CATEGORIES.find((x) => x.id === c.categoryId)?.label ?? find(ref).category;
    return patch(ref, c);
  },
  deleteIncident: async (ref) => {
    await wait(150);
    if (!find(ref)) throw new ApiError('Incident not found.', {}, 404);
    db = { ...db, incidents: db.incidents.filter((i) => i.ref !== ref), requests: db.requests.filter((r) => r.ref !== ref) };
    return { ref };
  },

  listRequests: async () => { await wait(100); return structuredClone(db.requests); },
  declineRequest: async (id) => {
    await wait(100);
    if (!db.requests.some((r) => r.id === id)) throw new ApiError('Request not found.', {}, 404);
    db = { ...db, requests: db.requests.filter((r) => r.id !== id) };
    return null;
  },

  listEngineers: async () => { await wait(); return db.profiles.filter(isEngineer).map(withLoad); },
  listCategories: async () => { await wait(100); return structuredClone(CATEGORIES); },
  createEngineer: async (form) => {
    await wait(150);
    const email = form.email.trim().toLowerCase();
    if (!email.endsWith('@acme.inc')) throw new ApiError('The request data is invalid.', { email: 'Use an @acme.inc address.' }, 422);
    if (db.accounts.some((a) => a.email === email)) throw new ApiError('An account with this email address already exists.', { email: 'An account with this email address already exists.' }, 409);
    const id = Math.max(...db.accounts.map((a) => a.id)) + 1;
    const profile = {
      id, email, name: form.name.trim(), phone: form.phone?.trim() || null, specializationId: form.specializationId ?? null,
      specialization: CATEGORIES.find((c) => c.id === form.specializationId)?.label ?? null,
      isActive: true, isAvailable: form.isAvailable ?? true, capacity: form.capacity ?? 5, activeTickets: 0, createdAt: new Date().toISOString(),
    };
    const account = { id, email, name: profile.name, role: 'engineer', isActive: true, createdAt: profile.createdAt };
    db = { ...db, profiles: [...db.profiles, profile], accounts: [...db.accounts, account] };
    syncWorkload();
    return structuredClone(profile);
  },
  updateEngineer: async (id, changes) => {
    await wait(120);
    const c = { ...changes };
    if ('specializationId' in c) c.specialization = CATEGORIES.find((x) => x.id === c.specializationId)?.label ?? null;
    if ('phone' in c) c.phone = c.phone?.trim() || null;
    db = {
      ...db,
      profiles: db.profiles.map((p) => (p.id === id ? { ...p, ...c } : p)),
      accounts: db.accounts.map((a) => (a.id === id && c.name ? { ...a, name: c.name } : a)),
    };
    syncWorkload();
    return { ...structuredClone(db.profiles.find((p) => p.id === id)), activeTickets: null };
  },
  deactivateEngineer: async (id) => {
    await wait(150);
    const held = mockLoad(id);
    if (held) throw new ApiError(`This engineer still has ${held} active ticket(s). Reassign them first.`, {}, 409);
    db = {
      ...db,
      profiles: db.profiles.map((p) => (p.id === id ? { ...p, isActive: false, isAvailable: false } : p)),
      accounts: db.accounts.map((a) => (a.id === id ? { ...a, isActive: false } : a)),
    };
    syncWorkload();
    return withLoad(db.profiles.find((p) => p.id === id));
  },

  listUsers: async ({ q = '', role = null, includeInactive = true } = {}) => {
    await wait(150);
    const term = q.trim().toLowerCase();
    return structuredClone(db.accounts
      .filter((a) => (includeInactive || a.isActive) && (!role || a.role === role))
      .filter((a) => term.length < 2 || `${a.name} ${a.email}`.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name)));
  },
  // Roughly the backend's rules (app/services/users.py), with the same messages and statuses.
  updateUser: async (id, changes) => {
    await wait(150);
    const acc = db.accounts.find((a) => a.id === id);
    if (!acc) throw new ApiError('User not found.', {}, 404);
    const role = changes.role ?? acc.role;
    const roleChanges = role !== acc.role;
    const deactivating = changes.isActive === false && acc.isActive;
    if (id === getSession()?.user?.id && (roleChanges || deactivating)) {
      throw new ApiError("You can't change your own role or deactivate yourself.", {}, 403);
    }
    if (acc.role === 'admin' && acc.isActive && (roleChanges || deactivating)
      && !db.accounts.some((a) => a.id !== id && a.role === 'admin' && a.isActive)) {
      throw new ApiError('Keep at least one active admin: promote someone else first.', {}, 409);
    }
    if (acc.role === 'engineer' && (roleChanges || deactivating) && mockLoad(id)) {
      throw new ApiError(`${acc.name} still has ${mockLoad(id)} active ticket(s). Reassign them first.`, {}, 409);
    }
    if (changes.engineer && role !== 'engineer') throw new ApiError('Engineer settings apply only to engineers.', {}, 400);

    const next = { ...acc, role, ...(changes.name !== undefined ? { name: changes.name.trim() } : {}), ...(changes.isActive !== undefined ? { isActive: changes.isActive } : {}) };
    // Engineer settings in the profile's shape; only the keys given change.
    const e = changes.engineer ?? {};
    const settings = {
      ...('specializationId' in e ? { specializationId: e.specializationId, specialization: CATEGORIES.find((x) => x.id === e.specializationId)?.label ?? null } : {}),
      ...('phone' in e ? { phone: e.phone?.trim() || null } : {}),
      ...('capacity' in e ? { capacity: e.capacity } : {}),
      ...('isAvailable' in e ? { isAvailable: e.isAvailable } : {}),
    };
    const kept = db.profiles.find((p) => p.id === id);
    // Becoming (or staying) an engineer: revive or create the profile; either way name and status follow the account.
    let profiles = db.profiles.map((p) => (p.id === id ? { ...p, ...(role === 'engineer' ? settings : {}), name: next.name, isActive: next.isActive } : p));
    if (role === 'engineer' && !kept) {
      profiles = [...profiles, {
        id, email: acc.email, name: next.name, phone: null, specializationId: null, specialization: null,
        isActive: next.isActive, isAvailable: true, capacity: 5, activeTickets: 0, createdAt: new Date().toISOString(), ...settings,
      }];
    }
    db = { ...db, accounts: db.accounts.map((a) => (a.id === id ? next : a)), profiles };
    syncWorkload();
    return structuredClone(next);
  },
};

// Chosen once at build time; both objects expose the same methods, so callers never check the mode.
export const adminApi = USE_MOCKS ? mocks : api;
