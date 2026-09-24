// Client-side validation rules for the registration form, shared by
// RegisterPage (on submit), DetailsStep (live email check), PasswordRules
// (live checklist) and CodeInput (digit filter).

// Company addresses only: one or more non-space, non-@ characters, then
// exactly "@acme.inc" at the end; case-insensitive.
export const ACME_EMAIL = /^[^\s@]+@acme\.inc$/i;

// Each rule has an id (React key), a label (shown in the checklist) and a test.
// Keeping them as data means the checklist and the submit check use the same
// rules and cannot drift apart.
export const passwordRules = [
  { id: 'length', label: 'At least 10 characters', test: (p) => p.length >= 10 },
  { id: 'number', label: 'One number', test: (p) => /\d/.test(p) },
  { id: 'symbol', label: 'One symbol', test: (p) => /[^A-Za-z0-9]/.test(p) },
  { id: 'case', label: 'Upper and lower case', test: (p) => /[A-Z]/.test(p) && /[a-z]/.test(p) },
];

// [CONCEPT: Form validation] Returns { field: message } for each problem; an
// empty object means step 0 can be submitted. The server validates again.
// [CONCEPT: Pure helper function] No state or side effects, so it is easy to test.
export function validateDetails(form) {
  const errors = {};
  if (!form.firstName.trim()) errors.firstName = 'Enter your first name.';
  if (!form.lastName.trim()) errors.lastName = 'Enter your last name.';
  if (!ACME_EMAIL.test(form.email.trim())) errors.email = 'Only @acme.inc addresses can register.';
  if (!passwordRules.every((r) => r.test(form.password))) errors.password = 'Your password doesn’t meet all the requirements.';
  if (!form.acceptedPolicy) errors.acceptedPolicy = 'Accept the acceptable use policy to continue.';
  return errors;
}

// Strips everything but digits and caps the length, e.g. "12 34-567" -> "123456".
export const onlyDigits = (v, max = 6) => v.replace(/\D/g, '').slice(0, max);
