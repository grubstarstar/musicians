// Module-scoped holder for the current auth token, used by the tRPC client's
// `headers` callback so every request carries the latest Authorization header.
//
// AuthContext is the single writer; tRPC's httpBatchLink is the reader. Using
// a plain module variable avoids wiring React context through the tRPC client
// factory (which is created once at module load, before any providers mount).
//
// This is also what lets the 401-handler reset auth state: AuthContext clears
// the token here, and any in-flight retries will see the empty Authorization.

let currentToken: string | null = null;

export function getAuthToken(): string | null {
  return currentToken;
}

export function setAuthToken(token: string | null): void {
  currentToken = token;
}
