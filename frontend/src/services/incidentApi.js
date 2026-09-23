import { request } from './http';
import { STATUS_LABEL, toRef } from './dashboardApi';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const api = {
  // -> [{ id, name, code, floors: [{ id, level, label, seats: [{ id, code }] }] }]
  listBuildings: async () => (await request('/facilities/tree')).buildings,
  // -> [{ id, label, category_type }]
  listCategories: () => request('/categories'),
  // Ids of the caller's own incidents, so the duplicate check only offers
  // "add a note" where the caller can actually open the ticket.
  listMyIncidentIds: async () => new Set((await request('/incidents?limit=100')).items.map((r) => r.id)),
  // -> [{ ref, id, title, status }] open tickets on that floor
  listOpenOnFloor: async ({ floorId }) => {
    const rows = await request(`/incidents/similar?floor_id=${floorId}&limit=10`);
    return rows.map((r) => ({ ref: toRef(r.id), id: r.id, title: r.title, status: STATUS_LABEL[r.status] }));
  },
  // -> { ref, status, priority, escalated }
  createIncident: async (payload, { escalationReason } = {}) => {
    const created = await request('/incidents', { method: 'POST', body: payload });
    let escalated = false;
    if (escalationReason) {
      // A separate call: the backend records escalation as its own workflow
      // step. If it fails the ticket still exists, so say so rather than
      // failing the whole report.
      try {
        await request(`/incidents/${created.id}/escalation`, { method: 'POST', body: { reason: escalationReason } });
        escalated = true;
      } catch {
        escalated = null;
      }
    }
    return { ref: toRef(created.id), status: STATUS_LABEL[created.status], priority: cap(created.priority), escalated };
  },
};

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const MOCK_BUILDINGS = [
  { id: 1, name: 'HQ North', code: 'HQ1', floors: [{ id: 11, level: 0, label: 'Ground Floor', seats: [] }, { id: 12, level: 3, label: 'Level 3', seats: [{ id: 101, code: 'HQ1-3F-A14' }] }] },
  { id: 2, name: 'Riverside Annex', code: 'RA1', floors: [{ id: 21, level: 0, label: 'Ground Floor', seats: [] }] },
];
const MOCK_CATEGORIES = [
  { id: 1, label: 'HVAC', category_type: 'facility' },
  { id: 2, label: 'Lighting', category_type: 'facility' },
  { id: 3, label: 'Wi-Fi', category_type: 'technology' },
  { id: 4, label: 'Printer', category_type: 'technology' },
];

const mocks = {
  listBuildings: async () => { await wait(); return MOCK_BUILDINGS; },
  listCategories: async () => { await wait(); return MOCK_CATEGORIES; },
  listMyIncidentIds: async () => new Set([412]),
  listOpenOnFloor: async ({ floorId }) => {
    await wait();
    return floorId === 12 ? [
      { ref: 'INC-0412', id: 412, title: 'Air conditioning not cooling, east wing', status: 'In Progress' },
      { ref: 'INC-0409', id: 409, title: 'Flickering light above desk 3.20', status: 'Open' },
    ] : [];
  },
  createIncident: async (_, { escalationReason } = {}) => { await wait(); return { ref: 'INC-0419', status: 'Open', priority: 'Medium', escalated: Boolean(escalationReason) }; },
};

export const incidentApi = USE_MOCKS ? mocks : api;
