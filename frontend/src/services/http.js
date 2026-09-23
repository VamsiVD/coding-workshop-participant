import { clearSession, getSession } from './session';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(message, fields = {}, status = 0) {
    super(message);
    this.fields = fields;
    this.status = status;
  }
}

// Pydantic prefixes validator messages with "Value error, ".
const cleanMessage = (msg) => String(msg).replace(/^Value error, /, '');

export async function request(path, { method = 'GET', body } = {}) {
  const session = getSession();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A rejected token means the session is over: drop it and sign in again.
    // Without a token, a 401 is a failed sign-in and the page shows the error.
    if (res.status === 401 && session) {
      clearSession();
      window.location.assign('/login');
    }
    // Backend shape: { error: { code, message, fields? } }
    const { message, fields = {} } = data.error ?? {};
    const cleaned = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, cleanMessage(v)]));
    throw new ApiError(message || 'Something went wrong. Please try again.', cleaned, res.status);
  }
  return data;
}
