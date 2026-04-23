import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
);

const COOKIE_NAME = 'auth_token';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

// JWT payload shape. `roles` (MUS-86) is carried in the token so mobile and
// web clients can read them without an extra `/me` round-trip. Defaults to
// an empty array on tokens minted before this change — `verifyToken`
// normalises missing/malformed roles to `[]` for forward compatibility.
export interface AuthTokenPayload {
  sub: string;
  username: string;
  roles: string[];
}

export async function signToken(payload: AuthTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const sub = typeof payload.sub === 'string' ? payload.sub : null;
    const username = typeof payload.username === 'string' ? payload.username : null;
    if (!sub || !username) return null;
    // Tolerate legacy tokens minted before MUS-86 (no `roles`) and any
    // malformed entries by normalising to an empty array / string[]. This
    // avoids a forced logout cycle when the server rolls out ahead of
    // clients with cached tokens.
    const rawRoles = payload.roles;
    const roles: string[] = Array.isArray(rawRoles)
      ? rawRoles.filter((r): r is string => typeof r === 'string')
      : [];
    return { sub, username, roles };
  } catch {
    return null;
  }
}

export function buildSetCookieHeader(token: string): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`;
}

export function buildClearCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getTokenFromCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

export function getTokenFromAuthHeader(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() || null : null;
}

export function getTokenFromRequest(req: Request): string | null {
  return (
    getTokenFromAuthHeader(req.headers.get('authorization') ?? undefined) ??
    getTokenFromCookie(req.headers.get('cookie') ?? undefined)
  );
}

// MUS-86: tiny helper so downstream procedures can gate on a role without
// sprinkling `.includes(...)` across the codebase. Accepts anything with a
// `roles: string[]` shape so callers can pass `ctx.user` directly from a
// tRPC procedure. Case-sensitive; roles are free-text per the ticket.
export function hasRole(user: { roles: string[] }, role: string): boolean {
  return user.roles.includes(role);
}
