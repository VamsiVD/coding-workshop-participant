import { ApiError, request } from './http';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

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
  register: ({ fullName, email, password }) =>
    request('/auth/register', { method: 'POST', body: { full_name: fullName, email, password } }),
  // -> { access_token, token_type, expires_in, user }
  login: ({ email, password }) => request('/auth/login', { method: 'POST', body: { email, password } }),
  ...placeholderEmailCheck,
};

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
