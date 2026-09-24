// Shared fetch helper: every service file calls request() to reach the backend.
// It adds the JSON and auth headers and turns error responses into ApiError.
import { clearSession, getSession } from './session';

// [CONCEPT: Environment variables] VITE_API_BASE can override the base path; it defaults to '/api'.
// Same origin in both places: Vite proxies /api in dev, CloudFront routes it on
// AWS. Not VITE_API_URL, which the deploy scripts set to the bare site URL.
const BASE_URL = import.meta.env.VITE_API_BASE ?? '/api';

// Error thrown by request(). `fields` maps form field names to messages so forms can show them
// next to the right input; `status` is the HTTP status (0 when not from a response).
export class ApiError extends Error {
  constructor(message, fields = {}, status = 0) {
    super(message);
    this.fields = fields;
    this.status = status;
  }
}

// Pydantic prefixes validator messages with "Value error, ".
const cleanMessage = (msg) => String(msg).replace(/^Value error, /, '');

// [CONCEPT: Fetch wrapper] One place for base URL, headers, JSON encoding and error handling.
// Resolves with the parsed JSON body; rejects with ApiError on any non-2xx response.
export async function request(path, { method = 'GET', body } = {}) {
  const session = getSession();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      // [CONCEPT: Bearer token auth] Signed-in requests carry the login token in the Authorization header.
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  // Empty or non-JSON bodies (e.g. a proxy error page) become {} instead of a parse error.
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
