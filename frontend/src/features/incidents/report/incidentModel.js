// Plain data and pure helpers for the "Report an incident" form: option lists,
// category grouping, the suggested-priority rule and form validation. No React
// here, so everything can be unit-tested on its own.

// Options for the two impact questions, ordered from least to most severe.
// The order matters: suggestPriority() scores answers by their index.
export const SCOPE = ['Just me', 'My area', 'Whole floor'];

// "Where is the problem?" label -> which seats the picker lists. A room is a
// kind of seat, so a problem in a conference room is saved like one at a desk.
export const SPOT = { 'At a desk': 'desk', 'In a room': 'room', 'Elsewhere on the floor': 'floor' };
export const SPOT_LABEL = Object.fromEntries(Object.entries(SPOT).map(([label, kind]) => [kind, label]));
export const WORKING = ['Yes', 'Partly', 'Not at all'];

// Mirrors the backend's workflow: an admin assigns, the engineer resolves,
// and the reporter closes by confirming the fix.
export const WORKFLOW = [
  ['Open', 'An admin assigns an engineer.'],
  ['In progress', 'Engineer notes appear on your ticket.'],
  ['Blocked', 'Waiting on parts or access; you’ll see why.'],
  ['Resolved', 'Confirm the fix or reopen it.'],
  ['Closed', 'Once you confirm the fix.'],
];

const CATEGORY_GROUP_LABELS = { facility: 'Facility', technology: 'Workplace tech' };

// [{ id, label, category_type }] -> [{ label, items: [{ id, label }] }]
// [CONCEPT: Pure helper function] Same input, same output, no side effects.
// Groups follow CATEGORY_GROUP_LABELS order; empty groups and unknown
// category_types are dropped.
export function groupCategories(categories) {
  return Object.entries(CATEGORY_GROUP_LABELS)
    .map(([type, label]) => ({ label, items: categories.filter((c) => c.category_type === type) }))
    .filter((g) => g.items.length);
}

// Prefer the floor's own label; otherwise build one from its level number.
export const floorLabel = (f) => f.label ?? (f.level === 0 ? 'Ground' : `Level ${f.level}`);

// Suggested priority from the two impact answers. The backend does not take a
// priority from the reporter (an admin sets it), so this is advice only.
// Score = index in SCOPE + index in WORKING (0..4): 0 Low, 1-2 Medium,
// 3 High, 4 Critical (whole floor and nobody can work).
export function suggestPriority(scope, working) {
  const n = SCOPE.indexOf(scope) + WORKING.indexOf(working);
  if (n <= 0) return 'Low';
  if (n <= 2) return 'Medium';
  if (n === 3) return 'High';
  return 'Critical';
}

// [CONCEPT: Form validation] Returns { field: message } for each invalid field;
// an empty object means the form can be submitted. A desk or room is needed
// only when "At a desk" or "In a room" is chosen, and the escalation reason
// only when escalation is requested.
export function validateIncident(f) {
  const e = {};
  if (!f.buildingId) e.buildingId = 'Select a building.';
  if (!f.floorId) e.floorId = 'Select a floor.';
  if (f.spotKind === 'desk' && !f.seatId) e.seatId = 'Select the desk, or choose “Elsewhere on the floor”.';
  if (f.spotKind === 'room' && !f.seatId) e.seatId = 'Select the room, or choose “Elsewhere on the floor”.';
  if (!f.categoryId) e.categoryId = 'Choose the closest category.';
  if (f.title.trim().length < 3) e.title = 'Add a short title (at least 3 characters).';
  if (f.description.trim().length < 20) e.description = 'At least 20 characters, please.';
  if (f.escalate && f.escalateReason.trim().length < 3) e.escalateReason = 'Explain why this needs escalating.';
  return e;
}
