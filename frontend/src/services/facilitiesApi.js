// Service layer for the admin facilities page (features/admin/facilities):
// buildings, their floors and the desks and rooms on each floor. Reshapes
// backend rows into camelCase UI shapes, with in-memory mocks used when
// VITE_USE_MOCKS=true.
// [CONCEPT: Service layer] The page calls facilitiesApi.* and never builds URLs or reads snake_case itself.
import { ApiError, request } from './http';

// [CONCEPT: Environment variables] Vite inlines this at build time; 'true' swaps in the mocks below.
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

// UI shapes:
//   Building: { id, name, code, address, isActive, createdAt, floorCount }
//   Floor:    { id, buildingId, level, label, createdAt, deskCount, roomCount }
//   Seat:     { id, floorId, code, kind: 'desk' | 'room', createdAt }
//   Tree:     { buildings: [{ id, name, code, floors: [{ id, level, label, seats: [{ id, code, kind }] }] }] }
// Counts are not in the backend rows; they are filled in by the list calls and
// left undefined on write responses, so the hook keeps the count it already has.

// [CONCEPT: Pure helper function] Backend rows -> UI shapes.
const fromBuilding = (b, floorCount) => ({
  id: b.id, name: b.name, code: b.code, address: b.address ?? '', isActive: b.is_active, createdAt: b.created_at, floorCount,
});
const fromFloor = (f, seats) => ({
  id: f.id, buildingId: f.building_id, level: f.level, label: f.label ?? '', createdAt: f.created_at,
  deskCount: seats ? seats.filter((s) => s.kind !== 'room').length : undefined,
  roomCount: seats ? seats.filter((s) => s.kind === 'room').length : undefined,
});
const fromSeat = (s) => ({ id: s.id, floorId: s.floor_id, code: s.code, kind: s.kind ?? 'desk', createdAt: s.created_at });

// UI change objects -> PATCH/POST bodies. Only keys the caller set are sent,
// because the backend treats an omitted field as "leave alone".
function buildingBody(form) {
  const body = {};
  if (form.name !== undefined) body.name = form.name.trim();
  if (form.code !== undefined) body.code = form.code.trim();
  if (form.address !== undefined) body.address = form.address.trim() || null;
  if (form.isActive !== undefined) body.is_active = form.isActive;
  return body;
}
function floorBody(form) {
  const body = {};
  if (form.level !== undefined) body.level = Number(form.level);
  if (form.label !== undefined) body.label = form.label.trim() || null;
  return body;
}
function seatBody(form) {
  const body = {};
  if (form.code !== undefined) body.code = form.code.trim();
  if (form.kind !== undefined) body.kind = form.kind;
  return body;
}

// Re-throws a write error with the form's field names. A duplicate (409 from a
// unique index) carries no fields and a generic message, so it is pinned to
// the input that caused it with a message that says which rule was broken.
function asFormError(duplicate) {
  return (e) => {
    if (!(e instanceof ApiError)) throw e;
    const fields = Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [k === 'is_active' ? 'isActive' : k, v]));
    if (e.status === 409) Object.assign(fields, duplicate);
    throw new ApiError(e.message, fields, e.status);
  };
}
const DUP_BUILDING = { code: 'A building already uses this name or code.' };
const DUP_FLOOR = { level: 'This building already has a floor at that level.' };
const DUP_SEAT = { code: 'This floor already has a desk or room with that code.' };

async function listFloors(buildingId) {
  const rows = await request(`/buildings/${buildingId}/floors`);
  // [CONCEPT: Async data fetching] Seats per floor in parallel, only to count desks and rooms.
  const seats = await Promise.all(rows.map((f) => request(`/floors/${f.id}/seats`)));
  return rows.map((f, i) => fromFloor(f, seats[i]));
}

const api = {
  // Every building, retired ones included, each with its floor count.
  // -> Building[] sorted by name (server order)
  listBuildings: async () => {
    const rows = await request('/buildings?include_inactive=true');
    const floors = await Promise.all(rows.map((b) => request(`/buildings/${b.id}/floors`)));
    return rows.map((b, i) => fromBuilding(b, floors[i].length));
  },
  // Active buildings only, nested; the admin page does not need it, pickers do. -> Tree
  getTree: async () => request('/facilities/tree'),
  // -> Floor[] sorted by level, with desk and room counts
  listFloors,
  // -> Seat[] sorted by code
  listSeats: async (floorId) => (await request(`/floors/${floorId}/seats`)).map(fromSeat),

  // form: { name, code, address } -> Building (floorCount 0)
  createBuilding: async (form) => fromBuilding(await request('/buildings', { method: 'POST', body: buildingBody(form) }).catch(asFormError(DUP_BUILDING)), 0),
  // changes: any of { name, code, address, isActive } -> Building (floorCount undefined)
  updateBuilding: async (id, changes) => fromBuilding(await request(`/buildings/${id}`, { method: 'PATCH', body: buildingBody(changes) }).catch(asFormError(DUP_BUILDING))),
  // 409 (ApiError with the server's message) while it has floors or incidents. -> { id }
  deleteBuilding: async (id) => request(`/buildings/${id}`, { method: 'DELETE' }),

  // form: { level, label } -> Floor (0 desks, 0 rooms)
  createFloor: async (buildingId, form) => fromFloor(await request(`/buildings/${buildingId}/floors`, { method: 'POST', body: floorBody(form) }).catch(asFormError(DUP_FLOOR)), []),
  // changes: any of { level, label } -> Floor (counts undefined)
  updateFloor: async (id, changes) => fromFloor(await request(`/floors/${id}`, { method: 'PATCH', body: floorBody(changes) }).catch(asFormError(DUP_FLOOR))),
  // 409 while it has seats or incidents. -> { id }
  deleteFloor: async (id) => request(`/floors/${id}`, { method: 'DELETE' }),

  // form: { code, kind } -> Seat. Desk codes come back upper-cased; room names keep their case.
  createSeat: async (floorId, form) => fromSeat(await request(`/floors/${floorId}/seats`, { method: 'POST', body: seatBody(form) }).catch(asFormError(DUP_SEAT))),
  // changes: any of { code, kind } -> Seat
  updateSeat: async (id, changes) => fromSeat(await request(`/seats/${id}`, { method: 'PATCH', body: seatBody(changes) }).catch(asFormError(DUP_SEAT))),
  // 409 while incidents name it. -> { id }
  deleteSeat: async (id) => request(`/seats/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Mocks (VITE_USE_MOCKS=true)
// ---------------------------------------------------------------------------

const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
let nextId = 1000;

// [CONCEPT: Mock data] Backend-shaped rows, so the mocks go through the same mappers as real responses.
const db = {
  buildings: [
    { id: 1, name: 'Headquarters', code: 'HQ1', address: '1 Acme Plaza', is_active: true, created_at: now() },
    { id: 2, name: 'Tower B', code: 'TWB', address: '40 Harbour Road', is_active: true, created_at: now() },
    { id: 3, name: 'Old Annex', code: 'ANX', address: null, is_active: false, created_at: now() },
  ],
  floors: [
    { id: 11, building_id: 1, level: 0, label: 'Ground Floor', created_at: now() },
    { id: 12, building_id: 1, level: 1, label: 'First Floor', created_at: now() },
    { id: 13, building_id: 1, level: 2, label: null, created_at: now() },
    { id: 21, building_id: 2, level: -1, label: 'Basement', created_at: now() },
    { id: 22, building_id: 2, level: 0, label: 'Lobby', created_at: now() },
  ],
  seats: [],
  // Seats with incident history: deleting one is refused, as the backend does.
  used: new Set(),
};
db.floors.forEach((f) => {
  const b = db.buildings.find((x) => x.id === f.building_id);
  for (let n = 1; n <= 4; n += 1) {
    db.seats.push({ id: f.id * 100 + n, floor_id: f.id, code: `${b.code}-${f.level}F-A0${n}`, kind: 'desk', created_at: now() });
  }
});
db.seats.push({ id: 1191, floor_id: 11, code: 'Condor', kind: 'room', created_at: now() });
db.seats.push({ id: 1291, floor_id: 12, code: 'Falcon', kind: 'room', created_at: now() });
db.used.add(1101).add(1191);

const notFound = (what) => { throw new ApiError(`${what} not found.`, {}, 404); };
const conflict = (fields, msg = 'That record already exists.') => { throw new ApiError(msg, fields, 409); };
const byName = (a, b) => a.name.localeCompare(b.name);
const seatsOf = (floorId) => db.seats.filter((s) => s.floor_id === floorId);
// Same normalisation as the backend: desk codes upper-case, room names as typed.
const norm = (code, kind) => (kind === 'room' ? code.trim() : code.trim().toUpperCase());

function checkBuilding(body, id) {
  if (db.buildings.some((b) => b.id !== id && (b.code === body.code || (body.name && b.name === body.name)))) conflict(DUP_BUILDING);
}

const mocks = {
  listBuildings: async () => {
    await wait();
    return [...db.buildings].sort(byName).map((b) => fromBuilding(b, db.floors.filter((f) => f.building_id === b.id).length));
  },
  getTree: async () => {
    await wait();
    return {
      buildings: db.buildings.filter((b) => b.is_active).sort(byName).map((b) => ({
        id: b.id, name: b.name, code: b.code,
        floors: db.floors.filter((f) => f.building_id === b.id).sort((x, y) => x.level - y.level).map((f) => ({
          id: f.id, level: f.level, label: f.label, seats: seatsOf(f.id).map(({ id, code, kind }) => ({ id, code, kind })),
        })),
      })),
    };
  },
  listFloors: async (buildingId) => {
    await wait(120);
    if (!db.buildings.some((b) => b.id === buildingId)) notFound('Building');
    return db.floors.filter((f) => f.building_id === buildingId).sort((a, b) => a.level - b.level).map((f) => fromFloor(f, seatsOf(f.id)));
  },
  listSeats: async (floorId) => {
    await wait(120);
    if (!db.floors.some((f) => f.id === floorId)) notFound('Floor');
    return seatsOf(floorId).sort((a, b) => a.code.localeCompare(b.code)).map(fromSeat);
  },

  createBuilding: async (form) => {
    await wait();
    const body = buildingBody(form);
    body.code = body.code.toUpperCase();
    checkBuilding(body);
    const row = { id: nextId++, address: null, ...body, is_active: true, created_at: now() };
    db.buildings.push(row);
    return fromBuilding(row, 0);
  },
  updateBuilding: async (id, changes) => {
    await wait();
    const row = db.buildings.find((b) => b.id === id) ?? notFound('Building');
    const body = buildingBody(changes);
    if (body.code) body.code = body.code.toUpperCase();
    checkBuilding({ ...row, ...body }, id);
    Object.assign(row, body);
    return fromBuilding(row);
  },
  deleteBuilding: async (id) => {
    await wait();
    if (!db.buildings.some((b) => b.id === id)) notFound('Building');
    const floors = db.floors.filter((f) => f.building_id === id).length;
    if (floors) conflict({}, `This building has ${floors} floor(s) and 0 incident(s). Deactivate it instead of deleting it, so the history is kept.`);
    db.buildings = db.buildings.filter((b) => b.id !== id);
    return { id };
  },

  createFloor: async (buildingId, form) => {
    await wait();
    if (!db.buildings.some((b) => b.id === buildingId)) notFound('Building');
    const body = floorBody(form);
    if (db.floors.some((f) => f.building_id === buildingId && f.level === body.level)) conflict(DUP_FLOOR);
    const row = { id: nextId++, building_id: buildingId, label: null, ...body, created_at: now() };
    db.floors.push(row);
    return fromFloor(row, []);
  },
  updateFloor: async (id, changes) => {
    await wait();
    const row = db.floors.find((f) => f.id === id) ?? notFound('Floor');
    const body = floorBody(changes);
    if (body.level !== undefined && db.floors.some((f) => f.id !== id && f.building_id === row.building_id && f.level === body.level)) conflict(DUP_FLOOR);
    Object.assign(row, body);
    return fromFloor(row);
  },
  deleteFloor: async (id) => {
    await wait();
    if (!db.floors.some((f) => f.id === id)) notFound('Floor');
    const seats = seatsOf(id).length;
    if (seats) conflict({}, `This floor has ${seats} seat(s) and 0 incident(s), so it cannot be deleted.`);
    db.floors = db.floors.filter((f) => f.id !== id);
    return { id };
  },

  createSeat: async (floorId, form) => {
    await wait();
    if (!db.floors.some((f) => f.id === floorId)) notFound('Floor');
    const kind = form.kind ?? 'desk';
    const code = norm(form.code, kind);
    if (seatsOf(floorId).some((s) => s.code === code)) conflict(DUP_SEAT);
    const row = { id: nextId++, floor_id: floorId, code, kind, created_at: now() };
    db.seats.push(row);
    return fromSeat(row);
  },
  updateSeat: async (id, changes) => {
    await wait();
    const row = db.seats.find((s) => s.id === id) ?? notFound('Seat');
    const kind = changes.kind ?? row.kind;
    const code = changes.code !== undefined ? norm(changes.code, kind) : row.code;
    if (seatsOf(row.floor_id).some((s) => s.id !== id && s.code === code)) conflict(DUP_SEAT);
    Object.assign(row, { code, kind });
    return fromSeat(row);
  },
  deleteSeat: async (id) => {
    await wait();
    if (!db.seats.some((s) => s.id === id)) notFound('Seat');
    if (db.used.has(id)) conflict({}, 'This seat has 1 incident(s) against it, so it cannot be deleted.');
    db.seats = db.seats.filter((s) => s.id !== id);
    return { id };
  },
};

export const facilitiesApi = USE_MOCKS ? mocks : api;
