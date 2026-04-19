// Dev-only bearer-token acquisition for mobile.
//
// Reads EXPO_PUBLIC_DEV_USERNAME / EXPO_PUBLIC_DEV_PASSWORD at bundle time
// (Metro inlines these), does a one-shot POST /api/auth/login against the
// same API origin the tRPC client is pointed at, and caches the resulting JWT
// in memory for the lifetime of the app process.
//
// This is intentionally minimal and temporary: MUS-49 replaces it with a real
// login screen + persisted auth state. Do NOT add retry, refresh, 401-routing,
// or secure-storage here — that belongs downstream.

const DEV_USERNAME = process.env.EXPO_PUBLIC_DEV_USERNAME ?? 'admin';
const DEV_PASSWORD = process.env.EXPO_PUBLIC_DEV_PASSWORD ?? 'password123';

let cachedToken: string | null = null;
let inFlight: Promise<string | null> | null = null;

interface LoginResponse {
  token?: string;
  username?: string;
  error?: string;
}

async function loginOnce(apiUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: DEV_USERNAME, password: DEV_PASSWORD }),
    });
    if (!res.ok) {
      console.warn(
        `[devAuth] Login failed (${res.status}) for user "${DEV_USERNAME}". ` +
          'tRPC calls that require auth will receive UNAUTHORIZED.'
      );
      return null;
    }
    const body = (await res.json()) as LoginResponse;
    if (!body.token) {
      console.warn('[devAuth] Login succeeded but response had no token field.');
      return null;
    }
    return body.token;
  } catch (err) {
    console.warn('[devAuth] Login request threw:', err);
    return null;
  }
}

/**
 * Returns a cached bearer token, logging in on first call. Concurrent callers
 * share the same in-flight request. Returns null if login fails — callers
 * should still issue the request so the server returns a normal UNAUTHORIZED
 * response (useful for surfacing misconfiguration).
 */
export async function getDevAuthToken(apiUrl: string): Promise<string | null> {
  if (cachedToken) return cachedToken;
  if (!inFlight) {
    inFlight = loginOnce(apiUrl).then((token) => {
      cachedToken = token;
      inFlight = null;
      return token;
    });
  }
  return inFlight;
}
