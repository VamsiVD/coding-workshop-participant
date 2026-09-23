// Keeps the bearer token from POST /auth/login. "Remember me" puts it in
// localStorage (survives a browser restart); otherwise sessionStorage (ends
// with the tab). The token's own expiry still applies either way.
const KEY = 'coyote.session';

const stores = () => [window.localStorage, window.sessionStorage];

export function saveSession({ accessToken, expiresIn, user }, { remember }) {
  clearSession();
  const session = { accessToken, user, expiresAt: Date.now() + expiresIn * 1000 };
  (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(session));
  return session;
}

export function getSession() {
  for (const store of stores()) {
    try {
      const session = JSON.parse(store.getItem(KEY));
      if (session && session.expiresAt > Date.now()) return session;
    } catch {
      // Corrupt entry: fall through and treat as signed out.
    }
  }
  return null;
}

export function clearSession() {
  stores().forEach((s) => s.removeItem(KEY));
}
