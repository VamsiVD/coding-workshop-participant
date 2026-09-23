export const SCOPE = ['Just me', 'My area', 'Whole floor'];
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
export function groupCategories(categories) {
  return Object.entries(CATEGORY_GROUP_LABELS)
    .map(([type, label]) => ({ label, items: categories.filter((c) => c.category_type === type) }))
    .filter((g) => g.items.length);
}

export const floorLabel = (f) => f.label ?? (f.level === 0 ? 'Ground' : `Level ${f.level}`);

// Suggested priority from the two impact answers. The backend does not take a
// priority from the reporter (an admin sets it), so this is advice only.
export function suggestPriority(scope, working) {
  const n = SCOPE.indexOf(scope) + WORKING.indexOf(working);
  if (n <= 0) return 'Low';
  if (n <= 2) return 'Medium';
  if (n === 3) return 'High';
  return 'Critical';
}

export function validateIncident(f) {
  const e = {};
  if (!f.buildingId) e.buildingId = 'Select a building.';
  if (!f.floorId) e.floorId = 'Select a floor.';
  if (!f.categoryId) e.categoryId = 'Choose the closest category.';
  if (f.title.trim().length < 3) e.title = 'Add a short title (at least 3 characters).';
  if (f.description.trim().length < 20) e.description = 'At least 20 characters, please.';
  if (f.escalate && f.escalateReason.trim().length < 3) e.escalateReason = 'Explain why this needs escalating.';
  return e;
}
