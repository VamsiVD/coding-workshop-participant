export const ACME_EMAIL = /^[^\s@]+@acme\.inc$/i;

export const passwordRules = [
  { id: 'length', label: 'At least 10 characters', test: (p) => p.length >= 10 },
  { id: 'number', label: 'One number', test: (p) => /\d/.test(p) },
  { id: 'symbol', label: 'One symbol', test: (p) => /[^A-Za-z0-9]/.test(p) },
  { id: 'case', label: 'Upper and lower case', test: (p) => /[A-Z]/.test(p) && /[a-z]/.test(p) },
];

export function validateDetails(form) {
  const errors = {};
  if (!form.firstName.trim()) errors.firstName = 'Enter your first name.';
  if (!form.lastName.trim()) errors.lastName = 'Enter your last name.';
  if (!ACME_EMAIL.test(form.email.trim())) errors.email = 'Only @acme.inc addresses can register.';
  if (!passwordRules.every((r) => r.test(form.password))) errors.password = 'Your password doesn’t meet all the requirements.';
  if (!form.acceptedPolicy) errors.acceptedPolicy = 'Accept the acceptable use policy to continue.';
  return errors;
}

export const onlyDigits = (v, max = 6) => v.replace(/\D/g, '').slice(0, max);
