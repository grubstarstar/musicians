// MUS-89 integration test: `onboarding.setRole` end-to-end against a real
// Postgres. Covers the three cases the AC calls out:
//   - First call appends the role and returns the updated array.
//   - Second call with the same role is a no-op (idempotent) and returns
//     the same array — NOT an error.
//   - Only the whitelisted roles (`musician`, `promoter`) are accepted; an
//     arbitrary role string is rejected by the Zod enum.
//
// Pattern mirrors `users/roles.integration.test.ts` (MUS-86) — skipped
// unless the Postgres test DB is reachable so devs without
// `pnpm e2e:db-setup` still see a green `pnpm test`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_DB_URL =
  process.env.E2E_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/musicians_test';

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

describe.skipIf(skip)('onboarding.setRole (integration)', () => {
  let originalDatabaseUrl: string | undefined;
  let originalNodeEnv: string | undefined;
  const username = `onboarding-itest-${Date.now()}-${Math.floor(
    Math.random() * 1e6,
  )}`;

  beforeAll(async () => {
    originalDatabaseUrl = process.env.DATABASE_URL;
    originalNodeEnv = process.env.NODE_ENV;
    process.env.DATABASE_URL = TEST_DB_URL;
    process.env.NODE_ENV = 'test';
  });

  afterAll(async () => {
    // Drop the test row so re-runs don't accumulate state.
    const { db } = await import('../db.js');
    const { users } = await import('../schema.js');
    const { eq } = await import('drizzle-orm');
    await db.delete(users).where(eq(users.username, username));

    process.env.DATABASE_URL = originalDatabaseUrl;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('appends the role, is idempotent, and rejects non-whitelisted roles', async () => {
    const { db } = await import('../db.js');
    const { users } = await import('../schema.js');
    const { eq } = await import('drizzle-orm');
    const { appRouter } = await import('../trpc/router.js');
    const { createCallerFactory } = await import('../trpc/trpc.js');

    // Seed a user with an empty roles array — same shape as a fresh
    // /register output before the onboarding wizard runs.
    const [created] = await db
      .insert(users)
      .values({ username, password_hash: 'placeholder-hash' })
      .returning({ id: users.id, username: users.username, roles: users.roles });
    expect(created.roles).toEqual([]);

    const createCaller = createCallerFactory(appRouter);
    const caller = createCaller({
      user: {
        id: String(created.id),
        username,
        roles: [],
      },
    });

    // --- (a) First call appends the role. -------------------------------
    const first = await caller.onboarding.setRole({ role: 'musician' });
    expect(first.roles).toEqual(['musician']);

    // Read back the row to prove the column actually persisted.
    const [afterFirst] = await db
      .select({ roles: users.roles })
      .from(users)
      .where(eq(users.id, created.id));
    expect(afterFirst.roles).toEqual(['musician']);

    // --- (b) Re-submitting the same role is a no-op. --------------------
    // Idempotency is an explicit AC — the ctx.user.roles snapshot is stale
    // (still `[]`) which exercises the DB short-circuit path, not the
    // `ctx.user.roles.includes` optimisation inside the procedure.
    const second = await caller.onboarding.setRole({ role: 'musician' });
    expect(second.roles).toEqual(['musician']);

    const [afterSecond] = await db
      .select({ roles: users.roles })
      .from(users)
      .where(eq(users.id, created.id));
    expect(afterSecond.roles).toEqual(['musician']);

    // --- (c) Non-whitelisted roles are rejected. ------------------------
    // The Zod enum runs before the mutation body, so this throws from the
    // tRPC caller rather than hitting the DB. Using try/catch so the test
    // still passes if the error shape changes (we just care that it throws
    // and the DB column is untouched).
    await expect(
      // `as unknown as` bypasses the compile-time enum narrowing — the
      // runtime check is what we're proving here.
      caller.onboarding.setRole({
        role: 'engineer' as unknown as 'musician',
      }),
    ).rejects.toThrow();

    const [afterReject] = await db
      .select({ roles: users.roles })
      .from(users)
      .where(eq(users.id, created.id));
    expect(afterReject.roles).toEqual(['musician']);
  });
});
