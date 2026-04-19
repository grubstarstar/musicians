// Glue between the tRPC client and the AuthContext for 401 handling.
//
// The tRPC client is constructed at module load, before any React provider
// mounts, so it can't call `useAuth()` directly. Instead, AuthContext
// registers a handler here on mount; the tRPC client's error interceptor
// reads it. Keeping this in a tiny module (rather than authToken.ts) keeps
// the concerns separate and easy to test in isolation.

type Handler = () => void;

let handler: Handler | null = null;

export function setUnauthorizedHandler(next: Handler | null): void {
  handler = next;
}

export function handleUnauthorized(): void {
  if (handler) handler();
}
