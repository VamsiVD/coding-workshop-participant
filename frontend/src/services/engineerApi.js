// Service layer for the engineer workbench (features/engineer): the engineer's
// profile, their assigned tickets, the open-job pool and job requests. Reshapes
// backend rows into the design's EngineerIncident, with in-memory mocks from the
// design used when VITE_USE_MOCKS=true.
// [CONCEPT: Service layer] The workbench calls engineerApi.* and never builds URLs or parses backend shapes itself.
import { request } from './http';
import { STATUS_LABEL, toRef } from './dashboardApi';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

// EngineerIncident: { ref, id, title, buildingName, floor, seat, category, status, priority,
//   assigneeId, reporter, description, blockedReason, requestedByMe, createdAt, notes, detailLoaded }
// notes: [{ id, author, mine, text, createdAt }], newest first. Pool rows carry no notes.

// Reverse of STATUS_LABEL ('In Progress' -> 'in_progress'), for sending a status back.
const STATUS_KEY = Object.fromEntries(Object.entries(STATUS_LABEL).map(([k, v]) => [v, k]));
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const toId = (ref) => Number(String(ref).replace(/^INC-/, ''));

// [CONCEPT: Pure helper function] One row of GET /incidents or /incidents/pool as an EngineerIncident.
function fromSummary(row) {
  return {
    ref: toRef(row.id),
    id: row.id,
    title: row.title,
    buildingName: row.building_name,
    floor: row.floor_label ?? null,
    seat: row.seat_code ?? null,
    category: row.category.label,
    status: STATUS_LABEL[row.status],
    priority: cap(row.priority),
    assigneeId: row.assignee_id ?? null,
    reporter: row.reporter_name,
    description: null,
    blockedReason: row.blocked_reason ?? null,
    requestedByMe: Boolean(row.requested_by_me),
    createdAt: row.created_at,
    notes: [],
    detailLoaded: false,
  };
}

// GET /incidents/:id plus its notes. The description is shown as the reporter's
// opening message, the way the design lays the conversation out.
function fromDetail(d, notes, myId) {
  return {
    ...fromSummary({
      ...d,
      building_name: d.location.building_name,
      floor_label: d.location.floor_label,
      seat_code: d.location.seat_code,
      assignee_id: d.assignee?.id,
      reporter_name: d.reporter.full_name,
    }),
    description: d.description,
    notes: [
      ...notes.map((n) => ({ id: n.id, author: n.author.full_name, mine: n.author.id === myId, text: n.body, createdAt: n.created_at })),
      { id: `${d.id}-description`, author: d.reporter.full_name, mine: false, text: d.description, createdAt: d.created_at },
    ],
    detailLoaded: true,
  };
}

// The backend allows Open -> In Progress, In Progress -> Blocked/Resolved and
// Blocked -> In Progress. The design offers Blocked and Resolved from any state,
// so those moves go through In Progress first, as the workflow requires.
export function statusPath(from, to) {
  if (from === to) return [];
  if (to !== 'In Progress' && from !== 'In Progress') return ['In Progress', to];
  return [to];
}

// Assigned work is paged through (capped at 5 x 100) like the admin list.
async function listMine() {
  const items = [];
  for (let page = 1; page <= 5; page += 1) {
    const res = await request(`/incidents?sort=-created_at&limit=100&page=${page}`);
    items.push(...res.items);
    if (items.length >= res.total || res.items.length === 0) break;
  }
  return items;
}

async function getIncident(ref, myId) {
  const id = toId(ref);
  // [CONCEPT: Async data fetching] Detail and notes load in parallel.
  const [detail, notes] = await Promise.all([
    request(`/incidents/${id}`),
    request(`/incidents/${id}/notes?order=desc&limit=100`),
  ]);
  return fromDetail(detail, notes.items, myId);
}

const api = {
  // -> { id, name, skills[], buildings[], available, capacity }
  // The backend profile has one specialisation and no building list.
  getProfile: async () => {
    const p = await request('/engineers/me');
    return {
      id: p.user_id,
      name: p.full_name,
      skills: p.specialization ? [p.specialization.label] : [],
      buildings: [],
      available: p.is_available,
      capacity: p.max_active_tickets,
    };
  },
  setAvailability: async (available) => {
    const p = await request('/engineers/me/availability', { method: 'PATCH', body: { is_available: available } });
    return { available: p.is_available };
  },
  // Everything assigned to me that is not closed yet.
  listAssigned: async () => (await listMine()).map(fromSummary).filter((i) => i.status !== 'Closed'),
  listPool: async () => (await request('/incidents/pool')).map(fromSummary),
  getIncident,
  // Returns a partial incident; the hook merges it into the pool row.
  requestJob: async (ref, note) => {
    await request(`/incidents/${toId(ref)}/assignment-requests`, { method: 'POST', body: { note: note || null } });
    return { ref, requestedByMe: true };
  },
  withdrawRequest: async (ref) => {
    await request(`/incidents/${toId(ref)}/assignment-requests/me`, { method: 'DELETE' });
    return { ref, requestedByMe: false };
  },
  // status: 'In Progress' | 'Blocked' | 'Resolved'. The reason is stored on the
  // status change and also posted as a note, because notes are what the
  // reporter reads on their dashboard.
  updateStatus: async (ref, from, status, reason, myId) => {
    const id = toId(ref);
    for (const step of statusPath(from, status)) {
      await request(`/incidents/${id}/status`, {
        method: 'POST',
        body: { status: STATUS_KEY[step], reason: step === status ? reason || null : null },
      });
    }
    if (reason) {
      await request(`/incidents/${id}/notes`, { method: 'POST', body: { body: `${status}: ${reason}` } });
    }
    return getIncident(ref, myId);
  },
  addNote: async (ref, text, myId) => {
    await request(`/incidents/${toId(ref)}/notes`, { method: 'POST', body: { body: text } });
    return getIncident(ref, myId);
  },
};

// ---------------------------------------------------------------------------
// Mocks: the design's sample data, same method names and return shapes.
// ---------------------------------------------------------------------------

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const ME = 901;
// [CONCEPT: Mock data] Rows are [ref, title, building, floor, seat, category, status, priority, assignee, hoursAgo, reporter, description, blockedReason].
let db = [
  ['INC-0421', 'Ethernet port dead at desk 7.22', 'Tower B', '7', '7.22', 'Wi-Fi', 'Open', 'Medium', ME, 4, 'L. Chen', 'Laptop shows no cable connected at this desk. Other ports nearby are fine.'],
  ['INC-0398', 'Wi-Fi drops in the open-plan area', 'Tower B', '7', '', 'Wi-Fi', 'Blocked', 'High', ME, 144, 'D. Price', 'Connection drops every 10 minutes near the windows.', 'Needs after-hours access to the ceiling access point.'],
  ['INC-0390', 'Wi-Fi slow in meeting rooms', 'Tower B', '7', '', 'Wi-Fi', 'In Progress', 'Medium', ME, 120, 'L. Chen', 'Video calls freeze in Condor and Heron rooms.'],
  ['INC-0418', 'Meeting room projector shows no signal', 'Tower B', '7', 'Condor', 'Meeting Room AV', 'Open', 'High', null, 3, 'D. Price', 'HDMI and USB-C both show no signal. Board review here at 14:00.'],
  ['INC-0420', 'No Wi-Fi in the Kestrel room', 'Tower B', '4', 'Kestrel', 'Wi-Fi', 'Open', 'Medium', null, 2, 'K. Ortiz', 'Network doesn’t appear at all inside the room.'],
  ['INC-0416', 'Dock has no power', 'Docklands', '1', '1.05', 'Laptop', 'Open', 'Low', null, 24, 'S. Walsh', 'Dock light is off; power brick is warm.'],
  ['INC-0415', 'Radiator leaking under window', 'Tower B', '2', '', 'Plumbing', 'Open', 'High', null, 6, 'T. Moss', 'Small puddle forming, towel down for now.'],
].map(([ref, title, buildingName, floor, seat, category, status, priority, assigneeId, h, reporter, description, blockedReason = null]) => ({
  ref, id: toId(ref), title, buildingName, floor, seat, category, status, priority, assigneeId, reporter, description, blockedReason,
  requestedByMe: false, createdAt: ago(h), detailLoaded: true,
  notes: [{ id: `${ref}-0`, author: reporter, mine: false, text: description, createdAt: ago(h) }],
}));
// [CONCEPT: Immutable update] Each change builds a new array and object rather than mutating the old ones.
const patch = (ref, p) => { db = db.map((i) => (i.ref === ref ? { ...i, ...p } : i)); return db.find((i) => i.ref === ref); };
const note = (ref, text) => {
  const i = db.find((x) => x.ref === ref);
  return patch(ref, { notes: [{ id: `${ref}-${Date.now()}`, author: 'S. Raman', mine: true, text, createdAt: new Date().toISOString() }, ...i.notes] });
};

const mocks = {
  getProfile: async () => { await wait(80); return { id: ME, name: 'S. Raman', skills: ['Wi-Fi', 'Meeting Room AV'], buildings: ['Tower B'], available: true, capacity: 6 }; },
  setAvailability: async (available) => { await wait(); return { available }; },
  listAssigned: async () => { await wait(); return db.filter((i) => i.assigneeId === ME && i.status !== 'Closed'); },
  listPool: async () => { await wait(); return db.filter((i) => !i.assigneeId && i.status === 'Open'); },
  getIncident: async (ref) => { await wait(80); return db.find((i) => i.ref === ref); },
  requestJob: async (ref) => { await wait(); return patch(ref, { requestedByMe: true }); },
  withdrawRequest: async (ref) => { await wait(); return patch(ref, { requestedByMe: false }); },
  updateStatus: async (ref, from, status, reason) => {
    await wait();
    patch(ref, { status, blockedReason: status === 'Blocked' ? reason : null });
    return note(ref, status === 'In Progress' ? 'Started work on this.' : `${status}: ${reason}`);
  },
  addNote: async (ref, text) => { await wait(); return note(ref, text); },
};

export const engineerApi = USE_MOCKS ? mocks : api;
