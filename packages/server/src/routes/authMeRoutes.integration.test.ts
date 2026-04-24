// MUS-101 integration test: `/api/auth/me` reads roles from the DB (not the
// JWT snapshot) and rejects tokens whose `sub` refers to a deleted user.
//
// Pattern mirrors `authRoutes.integration.test.ts`: skipped when the test DB
// isn't reachable, so devs without `pnpm e2e:db-setup` still see a green
// `pnpm test`. Scrub-by-prefix in afterEach so we don't collide with
// `authRoutes.integration.test.ts` running against the same physical DB.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { like } from 'drizzle-orm';

const TEST_DB_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/musicians_test';

const USERNAME_PREFIX = 'authme_';

async function testDbAvailable(): Promise<boolean> {
  try {
    const { default: postgres } = await import('postgres');
    const probe = postgres(TEST_DB_URL, { max: 1, connect_timeout: 1 });
    try {
      await probe`SELECT 1`;
      return true;
    } finally {
      await probe.end();
    }
  } catch {
    return false;
  }
}

const skip = !(await testDbAvailable());

describe.skipIf(skip)('GET /api/auth/me (integration, MUS-101)', () => {
  let originalDatabaseUrl: string | undefined;
  let app: { fetch: (req: Request) => Promise<Response> };

  beforeAll(async () => {
    originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = TEST_DB_URL;

    const { Hono } = await import('hono');
    const authRoutes = (await import('./authRoutes.js')).default;
    const built = new Hono();
    built.route('/api/auth', authRoutes);
    app = built;
  });

  afterAll(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  afterEach(async () => {
    const { db } = await import('../db.js');
    const { users } = await import('../schema.js');
    await db.delete(users).where(like(users.username, `${USERNAME_PREFIX}%`));
  });

  async function postRegister(username: string): Promise<string> {
    const res = await app.fetch(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: 'longenough' }),
      }),
    );
    expect(res.status).toBe(201);
    const { token } = (await res.json()) as { token: string };
    return token;
  }

  async function getMe(token: string): Promise<Response> {
    return app.fetch(
      new Request('http://localhost/api/auth/me', {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
  }

  it('returns the fresh roles from the DB after onboarding.setRole (same session)', async () => {
    // Reproduces the MUS-101 bug: JWT was issued at register time with
    // roles=[], then onboarding.setRole mutates users.roles. Without the fix,
    // /me returned the stale JWT snapshot and the mobile app saw roles=[].
    const username = `${USERNAME_PREFIX}samesession`;
    const token = await postRegister(username);

    // Sanity: immediately after register, roles should be [].
    const beforeRes = await getMe(token);
    expect(beforeRes.status).toBe(200);
    const beforeBody = (await beforeRes.json()) as { username: string; roles: string[] };
    expect(beforeBody).toEqual({ username, roles: [] });

    // Drive the role mutation through the real tRPC router, same way the
    // mobile role-picker does, then re-fetch /me with the *same* stale token.
    const { appRouter } = await import('../trpc/router.js');
    const { createCallerFactory } = await import('../trpc/trpc.js');
    const { db } = await import('../db.js');
    const { users } = await import('../schema.js');
    const { eq } = await import('drizzle-orm');
    const [row] = await db
      .select({ id: users.id, username: users.username, roles: users.roles })
      .from(users)
      .where(eq(users.username, username));
    const callerFactory = createCallerFactory(appRouter);
    const caller = callerFactory({
      user: { id: String(row.id), username: row.username, roles: row.roles },
    });
    await caller.onboarding.setRole({ role: 'musician' });

    const afterRes = await getMe(token);
    expect(afterRes.status).toBe(200);
    const afterBody = (await afterRes.json()) as { username: string; roles: string[] };
    expect(afterBody.username).toBe(username);
    expect(afterBody.roles).toEqual(['musician']);
  });

  it('returns the fresh roles on a simulated cold reload (same JWT, new context)', async () => {
    // Cold-reload scenario: user completes onboarding, closes the app, opens
    // it again. The client reads the token from SecureStore and hits /me —
    // exactly what AuthContext.fetchMe does at boot. The token is the same
    // bytes as before; the server must still return DB-fresh roles.
    const username = `${USERNAME_PREFIX}coldreload`;
    const token = await postRegister(username);

    const { appRouter } = await import('../trpc/router.js');
    const { createCallerFactory } = await import('../trpc/trpc.js');
    const { db } = await import('../db.js');
    const { users } = await import('../schema.js');
    const { eq } = await import('drizzle-orm');
    const [row] = await db
      .select({ id: users.id, username: users.username, roles: users.roles })
      .from(users)
      .where(eq(users.username, username));
    const callerFactory = createCallerFactory(appRouter);
    const caller = callerFactory({
      user: { id: String(row.id), username: row.username, roles: row.roles },
    });
    await caller.onboarding.setRole({ role: 'musician' });

    // The "cold reload" part: after the mutation, a brand-new request with
    // the original (stale-payload) token must still see the updated roles.
    // No extra auth ceremony — same behaviour as an app restart that replays
    // the cached bearer token against a fresh server process.
    const reloadRes = await getMe(token);
    expect(reloadRes.status).toBe(200);
    const reloadBody = (await reloadRes.json()) as { roles: string[] };
    expect(reloadBody.roles).toContain('musician');
  });

  it('rejects with 401 when the JWT sub refers to a deleted user', async () => {
    // AC #3: deleted-user-with-valid-JWT must be rejected, not trusted. This
    // was trivially bypassable pre-MUS-101 because /me decoded roles straight
    // from the JWT without consulting the DB.
    const username = `${USERNAME_PREFIX}ghost`;
    const token = await postRegister(username);

    // Delete the row out from under the still-valid token.
    const { db } = await import('../db.js');
    const { users } = await import('../schema.js');
    const { eq } = await import('drizzle-orm');
    await db.delete(users).where(eq(users.username, username));

    const res = await getMe(token);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe('Unauthorized');
  });

  it('rejects with 401 when no token is supplied', async () => {
    // Existing behaviour, locked in so the rewrite doesn't regress it.
    const res = await app.fetch(new Request('http://localhost/api/auth/me'));
    expect(res.status).toBe(401);
  });

  it('rejects with 401 when the token is malformed', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/auth/me', {
        headers: { authorization: 'Bearer not-a-real-jwt' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('reads the cookie when the Authorization header is absent (web flow)', async () => {
    // The mobile app uses bearer tokens; the web app uses the HttpOnly
    // cookie. Same resolver, same DB-read behaviour — this just locks in
    // that MUS-101 didn't accidentally break the cookie fallback.
    const username = `${USERNAME_PREFIX}cookie`;
    const token = await postRegister(username);

    const res = await app.fetch(
      new Request('http://localhost/api/auth/me', {
        headers: { cookie: `auth_token=${token}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { username: string; roles: string[] };
    expect(body.username).toBe(username);
    expect(body.roles).toEqual([]);
  });
});
