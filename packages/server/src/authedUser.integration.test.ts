// MUS-101 integration test: `resolveAuthedUser` — the shared token→DB-roles
// resolver that backs both REST `/api/auth/me` and the tRPC context.
//
// Unit-testing a DB-backed helper would require mocking Drizzle, which we
// avoid per CLAUDE.md. The round-trip tests here are the first line of defence
// for the "roles come from the DB, not the JWT" contract; `/me` behaviour is
// covered end-to-end in `authMeRoutes.integration.test.ts`, and the tRPC
// context consumer is covered by every protectedProcedure call in the rest of
// the suite.
//
// Pattern mirrors the other integration tests: skipped when the test DB isn't
// reachable, and rows are scrubbed by `authedUser_` prefix to stay out of the
// way of peer suites running against the same physical DB.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { like } from 'drizzle-orm';

const TEST_DB_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/musicians_test';

const USERNAME_PREFIX = 'authedUser_';

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

describe.skipIf(skip)('resolveAuthedUser (integration, MUS-101)', () => {
  let originalDatabaseUrl: string | undefined;

  beforeAll(async () => {
    originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = TEST_DB_URL;
  });

  afterAll(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  afterEach(async () => {
    const { db } = await import('./db.js');
    const { users } = await import('./schema.js');
    await db.delete(users).where(like(users.username, `${USERNAME_PREFIX}%`));
  });

  async function insertUser(
    suffix: string,
    initialRoles: string[] = [],
  ): Promise<{ id: number; username: string }> {
    const { db } = await import('./db.js');
    const { users } = await import('./schema.js');
    const username = `${USERNAME_PREFIX}${suffix}`;
    const [row] = await db
      .insert(users)
      .values({ username, password_hash: 'placeholder-hash', roles: initialRoles })
      .returning({ id: users.id, username: users.username });
    return row;
  }

  async function makeBearerRequest(token: string): Promise<Request> {
    return new Request('http://localhost/any', {
      headers: { authorization: `Bearer ${token}` },
    });
  }

  async function makeCookieRequest(token: string): Promise<Request> {
    return new Request('http://localhost/any', {
      headers: { cookie: `auth_token=${token}` },
    });
  }

  it('returns roles from the DB, not the JWT payload', async () => {
    // The JWT is minted with the old roles snapshot (empty). We then mutate
    // users.roles directly and expect `resolveAuthedUser` to see the fresh
    // value — same mechanism `/me` relies on.
    const { signToken } = await import('./auth.js');
    const { resolveAuthedUser } = await import('./authedUser.js');
    const { db } = await import('./db.js');
    const { users } = await import('./schema.js');
    const { eq } = await import('drizzle-orm');

    const row = await insertUser('freshroles', []);
    const token = await signToken({
      sub: String(row.id),
      username: row.username,
      roles: [],
    });

    // Bypass onboarding.setRole — this test is about the resolver, not the
    // mutation. Just write the column directly.
    await db.update(users).set({ roles: ['musician'] }).where(eq(users.id, row.id));

    const resolved = await resolveAuthedUser(await makeBearerRequest(token));
    expect(resolved).not.toBeNull();
    expect(resolved?.id).toBe(String(row.id));
    expect(resolved?.username).toBe(row.username);
    expect(resolved?.roles).toEqual(['musician']);
  });

  it('returns null when the JWT sub refers to a deleted user', async () => {
    // AC #3: deleted user with a still-valid JWT must not be trusted.
    const { signToken } = await import('./auth.js');
    const { resolveAuthedUser } = await import('./authedUser.js');
    const { db } = await import('./db.js');
    const { users } = await import('./schema.js');
    const { eq } = await import('drizzle-orm');

    const row = await insertUser('ghost', []);
    const token = await signToken({
      sub: String(row.id),
      username: row.username,
      roles: [],
    });

    // Delete the row; the token is still cryptographically valid.
    await db.delete(users).where(eq(users.id, row.id));

    const resolved = await resolveAuthedUser(await makeBearerRequest(token));
    expect(resolved).toBeNull();
  });

  it('returns null when no token is present on the request', async () => {
    const { resolveAuthedUser } = await import('./authedUser.js');
    const resolved = await resolveAuthedUser(new Request('http://localhost/any'));
    expect(resolved).toBeNull();
  });

  it('returns null for a malformed / unsigned token', async () => {
    const { resolveAuthedUser } = await import('./authedUser.js');
    const resolved = await resolveAuthedUser(await makeBearerRequest('not-a-real-jwt'));
    expect(resolved).toBeNull();
  });

  it('falls back to the cookie when Authorization is absent', async () => {
    const { signToken } = await import('./auth.js');
    const { resolveAuthedUser } = await import('./authedUser.js');

    const row = await insertUser('cookie', ['promoter']);
    const token = await signToken({
      sub: String(row.id),
      username: row.username,
      roles: [],
    });

    const resolved = await resolveAuthedUser(await makeCookieRequest(token));
    expect(resolved?.roles).toEqual(['promoter']);
  });
});
