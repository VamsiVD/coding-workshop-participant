// Facilities page model: form limits and validation for buildings, floors and
// seats, plus the small labels the lists share. Plain functions only, so the
// rules sit in one place and the components stay about layout.

// Mirrors backend/api/app/schemas/facilities.py, so most mistakes are caught
// before a round trip. The server still has the last word.
export const LIMITS = {
  buildingName: 120,
  buildingCode: 20,
  address: 255,
  levelMin: -10,
  levelMax: 200,
  floorLabel: 60,
  seatCode: 40,
};

export const SEAT_KINDS = { desk: 'Desk', room: 'Room' };

// Seat list filter key -> [label, predicate], in toggle order.
export const SEAT_FILTERS = {
  all: ['All', () => true],
  desk: ['Desks', (s) => s.kind !== 'room'],
  room: ['Rooms', (s) => s.kind === 'room'],
};

// [CONCEPT: Pure helper function] Short level tag: G for the ground floor, B1 for a basement, L3 above ground.
export const levelTag = (level) => (level === 0 ? 'G' : level < 0 ? `B${-level}` : `L${level}`);
// A floor's display name: its label, or a name made from the level.
export const floorName = (f) => f.label || (f.level === 0 ? 'Ground floor' : f.level < 0 ? `Basement ${-f.level}` : `Level ${f.level}`);
// The server upper-cases desk codes and keeps room names as typed; comparisons follow the same rule.
export const normCode = (code, kind) => (kind === 'room' ? code.trim() : code.trim().toUpperCase());
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Case-insensitive text search over the given strings.
export const matches = (q, ...parts) => !q || parts.join(' ').toLowerCase().includes(q.trim().toLowerCase());

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

export const EMPTY_BUILDING = { name: '', code: '', address: '', isActive: true };
export const buildingForm = (b) => ({ name: b.name, code: b.code, address: b.address ?? '', isActive: b.isActive });

// [CONCEPT: Form validation] Returns { field: message }; empty means valid. `others` are the
// other buildings, so a duplicate name or code is caught before the server's 409.
export function validateBuilding(form, others) {
  const errors = {};
  const name = form.name.trim();
  const code = form.code.trim().toUpperCase();
  if (!name) errors.name = 'Enter the building’s name.';
  else if (name.length > LIMITS.buildingName) errors.name = `Keep the name to ${LIMITS.buildingName} characters.`;
  else if (others.some((b) => b.name.toLowerCase() === name.toLowerCase())) errors.name = 'Another building already has this name.';
  if (!code) errors.code = 'Enter a short code, e.g. HQ1.';
  else if (code.length > LIMITS.buildingCode) errors.code = `Keep the code to ${LIMITS.buildingCode} characters.`;
  else if (others.some((b) => b.code === code)) errors.code = 'Another building already uses this code.';
  if (form.address.trim().length > LIMITS.address) errors.address = `Keep the address to ${LIMITS.address} characters.`;
  return errors;
}

// Only changed fields go in a PATCH; a new building sends everything but isActive (it starts active).
export function buildingPayload(form, original) {
  const next = { name: form.name.trim(), code: form.code.trim().toUpperCase(), address: form.address.trim(), isActive: form.isActive };
  if (!original) return { name: next.name, code: next.code, address: next.address };
  return Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== (original[k] ?? '')));
}

// ---------------------------------------------------------------------------
// Floors
// ---------------------------------------------------------------------------

// A new floor suggests the level above the highest one, or the ground floor.
export const emptyFloor = (floors) => ({ level: String(floors.length ? Math.max(...floors.map((f) => f.level)) + 1 : 0), label: '' });
export const floorForm = (f) => ({ level: String(f.level), label: f.label ?? '' });

// Level is kept as a string while typing so the box can be emptied or start with a minus sign.
export function validateFloor(form, others) {
  const errors = {};
  const level = Number(form.level);
  if (form.level.trim() === '' || !Number.isInteger(level)) errors.level = 'Enter a whole number; 0 is the ground floor.';
  else if (level < LIMITS.levelMin || level > LIMITS.levelMax) errors.level = `Use a level from ${LIMITS.levelMin} to ${LIMITS.levelMax}.`;
  else if (others.some((f) => f.level === level)) errors.level = 'This building already has a floor at that level.';
  if (form.label.trim().length > LIMITS.floorLabel) errors.label = `Keep the label to ${LIMITS.floorLabel} characters.`;
  return errors;
}

export function floorPayload(form, original) {
  const next = { level: Number(form.level), label: form.label.trim() };
  if (!original) return next;
  return Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== (original[k] ?? '')));
}

// ---------------------------------------------------------------------------
// Seats (desks and rooms)
// ---------------------------------------------------------------------------

export const emptySeat = (kind = 'desk') => ({ code: '', kind });
export const seatForm = (s) => ({ code: s.code, kind: s.kind });

// `others` are the other seats on the same floor; codes are unique per floor.
export function validateSeat(form, others) {
  const errors = {};
  const code = normCode(form.code, form.kind);
  const what = form.kind === 'room' ? 'room name' : 'desk code';
  if (!code) errors.code = `Enter a ${what}.`;
  else if (code.length > LIMITS.seatCode) errors.code = `Keep the ${what} to ${LIMITS.seatCode} characters.`;
  else if (others.some((s) => s.code === code)) errors.code = 'This floor already has a desk or room with that code.';
  return errors;
}

// On edit the code is always sent with the kind, so switching a room to a desk
// also gets its code upper-cased by the server.
export function seatPayload(form, original) {
  const next = { code: normCode(form.code, form.kind), kind: form.kind };
  if (!original) return next;
  if (next.code === original.code && next.kind === original.kind) return {};
  return next;
}
