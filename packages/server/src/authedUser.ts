import { eq } from 'drizzle-orm';
import { db } from './db.js';
import { users } from './schema.js';
import { getTokenFromRequest, verifyToken } from './auth.js';

/**
 * Shape of the authenticated caller that the server trusts for the duration of
 * a single request. `roles` is sourced from the DB, not the JWT payload — see
 * MUS-101. JWT `sub` remains authoritative for identity; `roles` becomes a
 * convenience snapshot that always reflects `users.roles` at request time.
 */
export interface AuthedUser {
  id: string;
  username: string;
  roles: string[];
}

/**
 * Resolve the authenticated user for an incoming request.
 *
 * Flow:
 *   1. Pull the token from Authorization (bearer) or the auth_token cookie.
 *   2. Verify the JWT signature + expiry; failure → `null`.
 *   3. Look up `users.roles` by `sub`; if the row is gone (deleted account
 *      with a still-valid JWT, MUS-101 AC #3) → `null`.
 *   4. Return `{ id, username, roles }` where `roles` comes from the DB row.
 *
 * `null` means "unauthenticated" — the REST `/me` handler turns that into a
 * 401, and the tRPC context surfaces it as `ctx.user = null` so
 * `protectedProcedure` throws `UNAUTHORIZED`.
 *
 * One DB round-trip per authenticated request boundary is the explicit cost
 * of MUS-101 (the alternative was re-minting the JWT on every role change;
 * the ticket picked this path so any role mutation — from any code path —
 * is automatically visible to the next request without client-side token
 * juggling).
 */
export async function resolveAuthedUser(req: Request): Promise<AuthedUser | null> {
  const token = getTokenFromRequest(req);
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const userIdNum = Number(payload.sub);
  // `payload.sub` is a stringified serial id. A non-finite coercion here means
  // the token was issued with a malformed sub — treat it the same as "user
  // not found" and bounce to unauthenticated.
  if (!Number.isFinite(userIdNum)) return null;

  const [row] = await db
    .select({ roles: users.roles })
    .from(users)
    .where(eq(users.id, userIdNum))
    .limit(1);

  if (!row) return null;

  return {
    id: payload.sub,
    username: payload.username,
    roles: row.roles,
  };
}
