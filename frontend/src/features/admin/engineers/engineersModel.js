// Engineers page model: list filters, load labels and the profile form's
// validation. Plain functions only, so the rules sit in one place and the
// components stay about layout.
import { admin } from '../../../theme/adminTheme';

// Mirrors EngineerCreate in backend/api/app/schemas/engineers.py, so most
// mistakes are caught before a round trip. The server still has the last word.
export const EMAIL_DOMAIN = 'acme.inc';
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;
export const CAPACITY_MIN = 1;
export const CAPACITY_MAX = 100;

// Starting values for "Add engineer". capacity is kept as a string while
// typing so the number box can be emptied; it is converted on submit.
export const EMPTY_FORM = { name: '', email: '', password: '', specializationId: '', phone: '', capacity: '5', isAvailable: true };

// An existing profile as form values, for the edit dialog.
export const formFrom = (e) => ({
  name: e.name,
  email: e.email,
  password: '',
  specializationId: e.specializationId ?? '',
  phone: e.phone ?? '',
  capacity: String(e.capacity),
  isAvailable: e.isAvailable,
});

// [CONCEPT: Form validation] Returns { field: message } for every problem; an empty object means valid.
// Email and password only exist on create, so an edit skips them.
export function validateEngineer(form, isNew) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Enter the engineer’s name.';
  else if (form.name.trim().length > 120) errors.name = 'Keep the name under 120 characters.';
  if (isNew) {
    const email = form.email.trim().toLowerCase();
    if (!email) errors.email = 'Enter a work email address.';
    else if (!/^[^\s@]+@[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';
    else if (!email.endsWith(`@${EMAIL_DOMAIN}`)) errors.email = `Use an @${EMAIL_DOMAIN} address.`;
    if (form.password.length < PASSWORD_MIN) errors.password = `Use at least ${PASSWORD_MIN} characters.`;
    else if (form.password.length > PASSWORD_MAX) errors.password = `Use at most ${PASSWORD_MAX} characters.`;
  }
  const cap = Number(form.capacity);
  if (form.capacity === '' || !Number.isInteger(cap) || cap < CAPACITY_MIN || cap > CAPACITY_MAX) {
    errors.capacity = `A whole number from ${CAPACITY_MIN} to ${CAPACITY_MAX}.`;
  }
  if (form.phone.trim().length > 40) errors.phone = 'Keep the phone number under 40 characters.';
  return errors;
}

// Form values -> the service's input shape. Email and password are only sent on create.
export function toPayload(form, isNew) {
  const body = {
    name: form.name.trim(),
    specializationId: form.specializationId === '' ? null : form.specializationId,
    phone: form.phone.trim() || null,
    capacity: Number(form.capacity),
    isAvailable: form.isAvailable,
  };
  return isNew ? { ...body, email: form.email.trim().toLowerCase(), password: form.password } : body;
}

// At or over their ticket cap. Unknown load (null) is never "full".
export const isFull = (e) => e.activeTickets != null && e.activeTickets >= e.capacity;

// Filter key -> [label, predicate], in toggle order. Inactive accounts only show under their own filter and "All".
export const FILTERS = {
  active: ['Active', (e) => e.isActive],
  available: ['Available', (e) => e.isActive && e.isAvailable],
  unavailable: ['Unavailable', (e) => e.isActive && !e.isAvailable],
  inactive: ['Inactive', (e) => !e.isActive],
  all: ['All', () => true],
};

// [CONCEPT: Pure helper function] Label and dot colour for an engineer's availability column.
export function availabilityOf(e) {
  if (!e.isActive) return { label: 'Inactive', color: admin.faint };
  if (!e.isAvailable) return { label: 'Unavailable', color: admin.tan };
  if (isFull(e)) return { label: 'At capacity', color: admin.danger };
  return { label: 'Available', color: admin.brown };
}
