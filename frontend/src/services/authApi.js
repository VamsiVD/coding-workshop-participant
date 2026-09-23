import { ApiError, request } from './http';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Two-factor and backup codes are UI placeholders: nothing is sent to or
// stored on the server, and any code is accepted. Replace with real endpoints
// (server-generated TOTP secret, hashed backup codes) when MFA is in scope.
// ---------------------------------------------------------------------------

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomString = (alphabet, length) =>
  Array.from(crypto.getRandomValues(new Uint32Array(length)), (n) => alphabet[n % alphabet.length]).join('');

const placeholderMfa = {
  startMfa: async ({ email, method }) => {
    await wait(150);
    if (method === 'sms') return { sent: true };
    const secret = randomString(BASE32, 16);
    const label = encodeURIComponent(`ACME Coyote Dispatch:${email}`);
    return { secret, otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=ACME` };
  },
  confirmMfa: async () => {
    await wait(150);
    const backupCodes = Array.from({ length: 8 }, () => `${randomString(CODE_CHARS, 4)}-${randomString(CODE_CHARS, 4)}`);
    return { backupCodes };
  },
  // Sign-in challenge: accepts any authenticator or backup code.
  verifyLoginMfa: async () => {
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
  ...placeholderMfa,
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
  ...placeholderMfa,
};

export const authApi = USE_MOCKS ? mocks : api;
