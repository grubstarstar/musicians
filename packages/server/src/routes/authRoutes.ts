import { Hono } from 'hono';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../db.js';
import { users } from '../schema.js';
import { signToken, verifyToken, buildSetCookieHeader, buildClearCookieHeader, getTokenFromRequest } from '../auth.js';

// Shared cost factor for any bcrypt hashing we do on the auth routes. Login's
// timing-attack dummy hash (`$2b$12$...`) is also at cost 12 — keep these in
// lockstep so a fresh register takes the same ~150ms as a mismatched login.
const BCRYPT_COST = 12;

// Server-side password policy. Mirrored on the mobile signup form so the user
// sees the same rule before submit.
const MIN_PASSWORD_LENGTH = 8;

/**
 * Classifies a `username`/`password` pair against the register rules. Pure:
 * no DB access, no bcrypt. Returns `null` when the pair is valid, or an
 * `{ status, error }` object describing the failure ready to hand to Hono's
 * `c.json`.
 *
 * Extracted so the branching stays testable without spinning a Postgres.
 */
export function validateRegisterInput(
  username: unknown,
  password: unknown,
): { status: 400; error: string } | null {
  if (typeof username !== 'string' || typeof password !== 'string') {
    return { status: 400, error: 'username and password are required' };
  }
  if (username.trim().length === 0) {
    return { status: 400, error: 'username is required' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      status: 400,
      error: `password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }
  return null;
}

const authRoutes = new Hono();

authRoutes.post('/login', async (c) => {
  const body = await c.req.json<{ username: string; password: string }>();
  const { username, password } = body;

  if (!username || !password) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const [user] = await db.select().from(users).where(eq(users.username, username));

  if (!user) {
    // Prevent timing attacks: compare against a dummy hash
    await bcrypt.compare(password, '$2b$12$KIXJhqtcnFMBpkMzL2CXS.kdwhFhXYNAqPL3GXrVTGUDXB9eZ2Lby');
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  // MUS-86: bake the user's roles into the token so clients can read them
  // without a round-trip to /me. Snapshots at login time; when roles change,
  // the next login (or /me re-fetch) refreshes them.
  const token = await signToken({
    sub: String(user.id),
    username: user.username,
    roles: user.roles,
  });
  c.header('Set-Cookie', buildSetCookieHeader(token));
  return c.json({ username: user.username, roles: user.roles, token });
});

/**
 * Registers a new account (MUS-99). Mirrors `/login`'s response shape: JSON
 * body with `{ username, token }` plus the `auth_token` HttpOnly cookie.
 *
 * Uniqueness is enforced by the `users.username` unique index. We race the
 * DB rather than pre-checking — a `SELECT ... WHERE username = ?` followed by
 * an `INSERT` would leave a narrow window where two concurrent registers on
 * the same username both see "free" and one gets a surprise 500. Catching
 * the unique-violation (`23505`) is the only correct way.
 */
authRoutes.post('/register', async (c) => {
  const body = await c.req
    .json<{ username?: unknown; password?: unknown }>()
    .catch(() => ({}) as { username?: unknown; password?: unknown });

  const validation = validateRegisterInput(body.username, body.password);
  if (validation) {
    return c.json({ error: validation.error }, validation.status);
  }
  // Narrowed by `validateRegisterInput` above.
  const username = (body.username as string).trim();
  const password = body.password as string;

  const password_hash = await bcrypt.hash(password, BCRYPT_COST);

  let insertedId: number;
  let insertedUsername: string;
  let insertedRoles: string[];
  try {
    const [inserted] = await db
      .insert(users)
      .values({ username, password_hash })
      .returning({ id: users.id, username: users.username, roles: users.roles });
    insertedId = inserted.id;
    insertedUsername = inserted.username;
    insertedRoles = inserted.roles;
  } catch (err) {
    // postgres.js surfaces unique-violation as `{ code: '23505' }`. Anything
    // else is an unexpected DB failure and should bubble as a 500.
    if (isUniqueViolation(err)) {
      return c.json({ error: 'username already taken' }, 409);
    }
    throw err;
  }

  // MUS-86: roles on the new user default to `[]`; bake them into the JWT so
  // the client matches the `/login` contract.
  const token = await signToken({
    sub: String(insertedId),
    username: insertedUsername,
    roles: insertedRoles,
  });
  c.header('Set-Cookie', buildSetCookieHeader(token));
  return c.json({ username: insertedUsername, roles: insertedRoles, token }, 201);
});

/**
 * Narrow duck-type for the Postgres unique-violation error. `23505` is the
 * Postgres `unique_violation` SQLSTATE code. Drizzle currently wraps the raw
 * postgres.js error in a `DrizzleQueryError` that exposes the original under
 * `cause`, so we check both the top-level object and `err.cause` — the API
 * there isn't stable enough to rely on only one.
 */
export function isUniqueViolation(err: unknown): boolean {
  const has23505 = (e: unknown): boolean =>
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code: unknown }).code === '23505';
  if (has23505(err)) return true;
  if (
    typeof err === 'object' &&
    err !== null &&
    'cause' in err &&
    has23505((err as { cause: unknown }).cause)
  ) {
    return true;
  }
  return false;
}

authRoutes.post('/logout', (c) => {
  c.header('Set-Cookie', buildClearCookieHeader());
  return c.json({ ok: true });
});

authRoutes.get('/me', async (c) => {
  // Accept either an Authorization bearer token (mobile) or the auth_token
  // cookie (web). `getTokenFromRequest` checks both in that order.
  const token = getTokenFromRequest(c.req.raw);
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return c.json({ username: payload.username, roles: payload.roles });
});

export default authRoutes;
