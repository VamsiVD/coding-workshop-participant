// People tab model: role labels and filters, what a role change means for the
// person, and validation for the rename and engineer-profile forms. Plain
// functions only, like engineersModel, so the dialogs stay about layout.
import { admin } from '../../../theme/adminTheme';
import { CAPACITY_MAX, CAPACITY_MIN } from './engineersModel';

export const ROLES = ['employee', 'engineer', 'admin'];
export const ROLE_LABEL = { employee: 'Employee', engineer: 'Engineer', admin: 'Admin' };
// "an engineer", "an admin", "an employee": every role starts with a vowel today,
// but the helper keeps the sentence right if one is added.
export const withArticle = (role) => `${/^[aeiou]/i.test(role) ? 'an' : 'a'} ${role}`;

// Filter key -> [label, role sent to GET /users (null = every role)], in toggle order.
export const ROLE_FILTERS = {
  all: ['All', null],
  employee: ['Employees', 'employee'],
  engineer: ['Engineers', 'engineer'],
  admin: ['Admins', 'admin'],
};

// [CONCEPT: Pure helper function] Chip colours per role, from the admin palette.
export function roleStyle(role) {
  if (role === 'admin') return { bgcolor: admin.red, color: '#fff' };
  if (role === 'engineer') return { bgcolor: admin.brown, color: '#fff' };
  return { bgcolor: admin.sand, color: admin.ink, border: `1px solid ${admin.line}` };
}

// What access each role adds on top of reporting incidents, which everyone keeps.
const ACCESS = {
  engineer: 'the engineer workbench: picking up, requesting and working on tickets',
  admin: 'the admin console: every incident, engineers, people and facilities',
};

// [CONCEPT: Pure helper function] The effect of moving from one role to another, as
// { gains, loses, notes } sentences for the confirmation dialog.
export function roleEffects(from, to) {
  const gains = [];
  const loses = [];
  const notes = [];
  if (ACCESS[to]) gains.push(`They get ${ACCESS[to]}.`);
  if (ACCESS[from]) loses.push(`They lose ${ACCESS[from]}.`);
  if (from === 'engineer') {
    loses.push('Their engineer profile is hidden and they drop off the Engineers list. Their past work stays on record.');
    notes.push('Any active tickets must be reassigned first.');
  }
  if (from === 'admin') notes.push('At least one active admin must remain.');
  if (to === 'engineer') notes.push('If they were an engineer before, their old profile comes back with the settings below.');
  if (to === 'employee') gains.push('They keep reporting and following their own incidents.');
  return { gains, loses, notes };
}

// Blank engineer settings for a promotion; the backend's defaults (no
// specialisation, 5 tickets, available). capacity stays a string while typing.
export const EMPTY_PROFILE = { specializationId: '', phone: '', capacity: '5', isAvailable: true };

// [CONCEPT: Form validation] Mirrors EngineerProfileFields in backend/api/app/schemas/users.py.
export function validateProfile(form) {
  const errors = {};
  const cap = Number(form.capacity);
  if (form.capacity === '' || !Number.isInteger(cap) || cap < CAPACITY_MIN || cap > CAPACITY_MAX) {
    errors.capacity = `A whole number from ${CAPACITY_MIN} to ${CAPACITY_MAX}.`;
  }
  if (form.phone.trim().length > 40) errors.phone = 'Keep the phone number under 40 characters.';
  return errors;
}

// Form values -> the `engineer` settings adminApi.updateUser expects.
export const toProfile = (form) => ({
  specializationId: form.specializationId === '' ? null : form.specializationId,
  phone: form.phone.trim() || null,
  capacity: Number(form.capacity),
  isAvailable: form.isAvailable,
});

export function validateName(name) {
  if (!name.trim()) return 'Enter a name.';
  if (name.trim().length > 120) return 'Keep the name under 120 characters.';
  return '';
}
