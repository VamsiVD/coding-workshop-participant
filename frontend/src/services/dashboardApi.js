import { request } from './http';
import { getSession } from './session';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

// ---------------------------------------------------------------------------
// Backend -> design shapes. The design's `Ticket` is keyed by a display ref
// (INC-0042); the API by numeric id. The ref carries the id, so it round-trips.
// ---------------------------------------------------------------------------

export const STATUS_LABEL = { open: 'Open', in_progress: 'In Progress', blocked: 'Blocked', resolved: 'Resolved', closed: 'Closed' };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export const toRef = (id) => `INC-${String(id).padStart(4, '0')}`;
const toId = (ref) => Number(String(ref).replace(/^INC-/, ''));

const place = (building, floor) => [building, floor].filter(Boolean).join(' · ');

function fromSummary(row) {
  return {
    ref: toRef(row.id),
    id: row.id,
    title: row.title,
    category: row.category.label,
    status: STATUS_LABEL[row.status],
    priority: cap(row.priority),
    engineer: row.assignee_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Placeholder: the backend has no per-user read tracking yet.
    unreadCount: 0,
    escalationRequested: row.escalation_status === 'requested',
    seat: row.seat_code ?? undefined,
    place: place(row.building_name, row.floor_label),
  };
}

function fromDetail(d, notes) {
  const me = getSession()?.user.id;
  return {
    ref: toRef(d.id),
    id: d.id,
    title: d.title,
    category: d.category.label,
    status: STATUS_LABEL[d.status],
    priority: cap(d.priority),
    engineer: d.assignee?.full_name ?? null,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    unreadCount: 0,
    escalationRequested: d.escalation_status === 'requested',
    seat: d.location.seat_code ?? undefined,
    place: place(d.location.building_name, d.location.floor_label),
    buildingId: d.location.building_id,
    floorId: d.location.floor_id,
    blockedReason: d.blocked_reason ?? undefined,
    notes: notes.map((n) => ({
      id: n.id,
      author: n.author.full_name,
      mine: n.author.id === me,
      createdAt: n.created_at,
      text: n.body,
    })),
  };
}

async function getTicket(ref) {
  const id = toId(ref);
  const [detail, notes] = await Promise.all([
    request(`/incidents/${id}`),
    request(`/incidents/${id}/notes?order=desc&limit=100`),
  ]);
  return fromDetail(detail, notes.items);
}

// Open incidents other people reported where the caller's latest active ticket
// is. The backend has no home location for a user, so that ticket stands in.
async function getNearby(tickets) {
  const anchor = tickets.find((t) => t.status !== 'Closed' && t.status !== 'Resolved');
  if (!anchor) return { nearby: [], location: null };
  const t = await getTicket(anchor.ref);
  const where = t.floorId ? `floor_id=${t.floorId}` : `building_id=${t.buildingId}`;
  const rows = await request(`/incidents/similar?${where}&limit=6`);
  const mine = new Set(tickets.map((x) => x.id));
  return {
    location: t.place,
    nearby: rows.filter((r) => !mine.has(r.id)).map((r) => ({
      ref: toRef(r.id),
      title: r.title,
      status: STATUS_LABEL[r.status],
      // Placeholder: "affects me too" is not stored by the backend yet.
      affectedCount: 0,
      affectsMe: false,
    })),
  };
}

const api = {
  // -> { stats: { avgFixDays }, location, tickets: Ticket[], nearby: NearbyIncident[] }
  getDashboard: async () => {
    // An employee's list is already scoped to their own reports by the server.
    const [page, times] = await Promise.all([
      request('/incidents?sort=-updated_at&limit=100'),
      request('/reports/response-times'),
    ]);
    const tickets = page.items.map(fromSummary);
    const { nearby, location } = await getNearby(tickets).catch(() => ({ nearby: [], location: null }));
    const hours = times.overall.avg_hours_to_resolve;
    return {
      stats: { avgFixDays: hours == null ? null : Math.round((hours / 24) * 10) / 10 },
      location,
      tickets,
      nearby,
    };
  },
  getTicket,
  // Placeholder: no read tracking on the backend.
  markRead: async () => ({ ok: true }),
  addNote: async (ref, text) => {
    await request(`/incidents/${toId(ref)}/notes`, { method: 'POST', body: { body: text } });
    return getTicket(ref);
  },
  confirmFix: async (ref) => {
    await request(`/incidents/${toId(ref)}/status`, { method: 'POST', body: { status: 'closed' } });
    return getTicket(ref);
  },
  reopen: async (ref, reason) => {
    await request(`/incidents/${toId(ref)}/status`, { method: 'POST', body: { status: 'in_progress', reason: reason || null } });
    return getTicket(ref);
  },
  requestEscalation: async (ref, reason) => {
    await request(`/incidents/${toId(ref)}/escalation`, { method: 'POST', body: { reason } });
    return getTicket(ref);
  },
  // Placeholder: toggles locally only; nothing is saved.
  setAffected: async (ref, affected) => ({ affectsMe: affected }),
};

// ---------------------------------------------------------------------------
// Mocks (VITE_USE_MOCKS=true), from the design.
// ---------------------------------------------------------------------------

const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
let db = {
  stats: { avgFixDays: 2.8 },
  location: 'HQ North · Munich · Floor 3 · Seat 3.14',
  tickets: [
    { ref: 'INC-0419', title: 'Second monitor won’t turn on', category: 'Monitor', status: 'Open', priority: 'Medium', engineer: null, createdAt: ago(1), updatedAt: ago(1), unreadCount: 0, escalationRequested: false, seat: '3.14',
      notes: [{ id: 1, author: 'M. Okafor', mine: true, createdAt: ago(1), text: 'Second monitor stays black after the weekend. Cable reseated.' }] },
    { ref: 'INC-0412', title: 'Air conditioning not cooling, east wing', category: 'Temperature / HVAC', status: 'In Progress', priority: 'High', engineer: 'A. Klein', createdAt: ago(48), updatedAt: ago(3), unreadCount: 1, escalationRequested: false,
      notes: [
        { id: 4, author: 'A. Klein', createdAt: ago(3), text: 'Compressor part arrives tomorrow morning. Portable unit placed by the east windows for today.' },
        { id: 3, author: 'A. Klein', createdAt: ago(24), text: 'On site, diagnosing.' },
        { id: 2, author: 'M. Okafor', mine: true, createdAt: ago(48), text: '31°C at the desks by noon.' },
      ] },
    { ref: 'INC-0395', title: 'Chair hydraulics broken', category: 'Desk or chair', status: 'Blocked', priority: 'Low', engineer: 'T. Novak', createdAt: ago(192), updatedAt: ago(48), unreadCount: 0, escalationRequested: false, seat: '3.14', blockedReason: 'Replacement chair on order, due 26 Sep.',
      notes: [{ id: 5, author: 'T. Novak', createdAt: ago(48), text: 'Blocked: replacement chair on order, due 26 Sep.' }] },
    { ref: 'INC-0384', title: 'Dead pixels on second screen', category: 'Monitor', status: 'Resolved', priority: 'Low', engineer: 'L. Duarte', createdAt: ago(216), updatedAt: ago(24), unreadCount: 1, escalationRequested: false, seat: '3.14',
      notes: [{ id: 6, author: 'L. Duarte', createdAt: ago(24), text: 'Resolved: swapped the panel for a spare. Please confirm it works.' }] },
    { ref: 'INC-0371', title: 'Rattling noise from AC vent', category: 'Temperature / HVAC', status: 'Closed', priority: 'Low', engineer: 'A. Klein', createdAt: ago(432), updatedAt: ago(264), unreadCount: 0, escalationRequested: false,
      notes: [{ id: 7, author: 'A. Klein', createdAt: ago(336), text: 'Resolved: loose vent cover fixed.' }] },
  ],
  nearby: [
    { ref: 'INC-0409', title: 'Flickering light above desk 3.20', status: 'In Progress', affectedCount: 2, affectsMe: false },
    { ref: 'INC-0411', title: 'Dock not detecting laptops at 3.08', status: 'In Progress', affectedCount: 0, affectsMe: false },
  ],
};
const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
const patch = (ref, p) => { db = { ...db, tickets: db.tickets.map((t) => (t.ref === ref ? { ...t, ...p, updatedAt: new Date().toISOString() } : t)) }; return db.tickets.find((t) => t.ref === ref); };
const find = (ref) => db.tickets.find((t) => t.ref === ref);

const mocks = {
  getDashboard: async () => { await wait(); return structuredClone(db); },
  getTicket: async (ref) => { await wait(100); return structuredClone(find(ref)); },
  markRead: async (ref) => { db = { ...db, tickets: db.tickets.map((t) => (t.ref === ref ? { ...t, unreadCount: 0 } : t)) }; return { ok: true }; },
  addNote: async (ref, text) => { await wait(); const t = find(ref); return patch(ref, { notes: [{ id: Date.now(), author: 'M. Okafor', mine: true, createdAt: new Date().toISOString(), text }, ...t.notes] }); },
  confirmFix: async (ref) => { await wait(); return patch(ref, { status: 'Closed', unreadCount: 0 }); },
  reopen: async (ref) => { await wait(); return patch(ref, { status: 'In Progress', unreadCount: 0 }); },
  requestEscalation: async (ref) => { await wait(); return patch(ref, { escalationRequested: true }); },
  setAffected: async (ref, affected) => {
    await wait(120);
    db = { ...db, nearby: db.nearby.map((n) => (n.ref === ref ? { ...n, affectsMe: affected, affectedCount: n.affectedCount + (affected ? 1 : -1) } : n)) };
    const n = db.nearby.find((x) => x.ref === ref);
    return { affectedCount: n.affectedCount, affectsMe: n.affectsMe };
  },
};

export const dashboardApi = USE_MOCKS ? mocks : api;
