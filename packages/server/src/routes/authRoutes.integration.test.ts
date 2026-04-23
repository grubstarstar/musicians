// Integration test for the register endpoint (MUS-99). Mirrors the shape of
// `testRoutes.integration.test.ts`: skip the whole suite when the test DB
// isn't reachable, so this is safe to leave in `pnpm test` for devs who
// haven't run `pnpm e2e:db-setup`.
//
// Uses the real Postgres (via postgres.js + Drizzle) instead of mocks — we
// need the unique-index behaviour for the duplicate-username case and bcrypt
// hashing end-to-end for the golden path.
//
// Coexistence with the testRoutes integration suite: both files share the same
// physical test DB and vitest runs test files in parallel workers by default.
// We therefore DON'T truncate the table in beforeEach — that would race with
// testRoutes' `POST /test/reset` seed. Instead every test uses usernames
// prefixed `authreg_` and afterEach deletes only those rows, leaving any
// seed-fixture data the other suite owns untouched.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import { like } from 'drizzle-orm';

const TEST_DB_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/musicians_test';

const USERNAME_PREFIX = 'authreg_';

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

describe.skipIf(skip)('POST /api/auth/register (integration)', () => {
  let originalDatabaseUrl: string | undefined;
  let app: { fetch: (req: Request) => Promise<Response> };

  beforeAll(async () => {
    originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = TEST_DB_URL;

    // Import after env is set so the singleton DB client connects to the test DB.
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
    // Scrub only rows this suite created. Leaves anything else (e.g. seed
    // fixture rows from a concurrent testRoutes run) alone.
    const { db } = await import('../db.js');
    const { users } = await import('../schema.js');
    await db.delete(users).where(like(users.username, `${USERNAME_PREFIX}%`));
  });

  async function postRegister(body: unknown): Promise<Response> {
    return app.fetch(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  }

  it('creates the user, hashes the password, returns a token and sets the cookie', async () => {
    const username = `${USERNAME_PREFIX}newuser`;
    const res = await postRegister({ username, password: 'longenough' });

    expect(res.status).toBe(201);
    const json = (await res.json()) as { username?: string; token?: string };
    expect(json.username).toBe(username);
    expect(typeof json.token).toBe('string');
    expect(json.token?.split('.')).toHaveLength(3); // JWT: header.payload.signature

    const cookie = res.headers.get('set-cookie');
    expect(cookie).toMatch(/^auth_token=.+/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Path=\//);

    // Verify the DB row: bcrypt hash stored (not plaintext), matches the
    // input when compared.
    const { db } = await import('../db.js');
    const { users } = await import('../schema.js');
    const { eq } = await import('drizzle-orm');
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        password_hash: users.password_hash,
      })
      .from(users)
      .where(eq(users.username, username));
    expect(rows).toHaveLength(1);
    expect(rows[0].password_hash).not.toBe('longenough');
    expect(await bcrypt.compare('longenough', rows[0].password_hash)).toBe(true);
  });

  it('returns the user id stringified in the JWT sub claim', async () => {
    const username = `${USERNAME_PREFIX}subcheck`;
    const res = await postRegister({ username, password: 'longenough' });
    expect(res.status).toBe(201);
    const { token } = (await res.json()) as { token: string };

    const { verifyToken } = await import('../auth.js');
    const payload = await verifyToken(token);
    expect(payload).not.toBeNull();
    expect(typeof payload?.sub).toBe('string');
    expect(payload?.username).toBe(username);
    // sub should decode to a positive integer (the user's serial id). We
    // can't assert a specific value because other suites may have bumped
    // the serial, but the shape + positivity is what matters.
    expect(Number(payload?.sub)).toBeGreaterThan(0);
    expect(Number.isInteger(Number(payload?.sub))).toBe(true);
  });

  it('rejects a duplicate username with 409 and leaves the original row intact', async () => {
    const username = `${USERNAME_PREFIX}dupe`;
    const first = await postRegister({ username, password: 'longenough' });
    expect(first.status).toBe(201);

    const second = await postRegister({
      username,
      password: 'differentpassword',
    });
    expect(second.status).toBe(409);
    const json = (await second.json()) as { error?: string };
    expect(json.error).toBe('username already taken');

    // Still exactly one row for this username, and its hash still matches
    // the first password.
    const { db } = await import('../db.js');
    const { users } = await import('../schema.js');
    const { eq } = await import('drizzle-orm');
    const rows = await db
      .select({ password_hash: users.password_hash })
      .from(users)
      .where(eq(users.username, username));
    expect(rows).toHaveLength(1);
    expect(await bcrypt.compare('longenough', rows[0].password_hash)).toBe(true);
  });

  it('rejects a password shorter than 8 characters with 400', async () => {
    const username = `${USERNAME_PREFIX}shortpw`;
    const res = await postRegister({ username, password: '1234567' });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe('password must be at least 8 characters');

    // No row written.
    const { db } = await import('../db.js');
    const { users } = await import('../schema.js');
    const { eq } = await import('drizzle-orm');
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username));
    expect(rows).toHaveLength(0);
  });

  it('rejects missing username with 400', async () => {
    const res = await postRegister({ password: 'longenough' });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe('username and password are required');
  });

  it('rejects missing password with 400', async () => {
    const res = await postRegister({ username: `${USERNAME_PREFIX}nopw` });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe('username and password are required');
  });

  it('rejects a whitespace-only username with 400', async () => {
    const res = await postRegister({
      username: '   ',
      password: 'longenough',
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe('username is required');
  });

  it('trims the username before persisting', async () => {
    const username = `${USERNAME_PREFIX}trimme`;
    const res = await postRegister({
      username: `  ${username}  `,
      password: 'longenough',
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as { username?: string };
    expect(json.username).toBe(username);

    const { db } = await import('../db.js');
    const { users } = await import('../schema.js');
    const { eq } = await import('drizzle-orm');
    const rows = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.username, username));
    expect(rows.map((r) => r.username)).toEqual([username]);
  });
});
