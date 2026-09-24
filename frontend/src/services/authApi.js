// Service layer for sign-in and registration (POST /auth/login, /auth/register),
// with mocks for VITE_USE_MOCKS=true. Saving the returned token is session.js's job.
// [CONCEPT: Service layer] LoginPage and RegisterPage call authApi.* instead of fetch directly.
import { ApiError, request } from './http';

// [CONCEPT: Environment variables] Read at build time by Vite; the string 'true' switches to the mocks below.
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

// Fake network delay for the mocks and placeholders.
const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Email verification at registration is a UI placeholder: no email is sent and
// nothing is stored on the server, so any code is accepted. Sign-in does not
// ask for it. Replace with real endpoints (server-sent, hashed, expiring code)
// when email MFA is in scope.
// ---------------------------------------------------------------------------

const placeholderEmailCheck = {
  verifyEmail: async () => {
    await wait(150);
    return { ok: true };
  },
  resendEmailCode: async () => {
    await wait(150);
    return { ok: true };
  },
};

const api = {
  // -> UserOut { id, email, full_name, role, ... }
  // The form uses camelCase (fullName); the backend expects snake_case (full_name).
  register: ({ fullName, email, password }) =>
    request('/auth/register', { method: 'POST', body: { full_name: fullName, email, password } }),
  // -> { access_token, token_type, expires_in, user }
  login: ({ email, password }) => request('/auth/login', { method: 'POST', body: { email, password } }),
  ...placeholderEmailCheck,
};

// [CONCEPT: Mock data] Mimics the server's rules and errors: only @acme.inc emails register,
// and any password of 10+ characters signs in. Errors are thrown as ApiError, like the real request().
const mocks = {
  register: async ({ fullName, email }) => {
    await wait();
    if (!/@acme\.inc$/i.test(email)) throw new ApiError('The request data is invalid.', { email: 'Only @acme.inc addresses can register.' });
    return { id: 1, email, full_name: fullName, role: 'employee' };
  },
  login: async ({ email, password }) => {
    await wait();
    if (password.length < 10) throw new ApiError('The email address or password is incorrect.');
    return { access_token: 'mock', token_type: 'bearer', expires_in: 3600, user: { id: 1, email, full_name: 'Mock User', role: 'employee' } };
  },
  ...placeholderEmailCheck,
};

export const authApi = USE_MOCKS ? mocks : api;
