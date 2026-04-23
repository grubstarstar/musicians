// MUS-95 integration test: `users.addRole` end-to-end against a real
// Postgres. Mirrors `onboarding.setRole` coverage (MUS-89) but exercised
// through the settings-side procedure path, proving both sites share the
// same idempotent `addUserRole` helper:
//   - First call appends the role and returns the updated array.
//   - Second call with the same role is a no-op (idempotent) and returns
//     the same array — NOT an error.
//   - Only the whitelisted roles (`musician`, `promoter`) are accepted; an
//     arbitrary role string is rejected by the Zod enum.
//   - Additive: adding `musician` to a user who already carries `promoter`
//     leaves both roles in place (MUS-95's core scenario).
//
// Pattern mirrors `onboarding/router.integration.test.ts` — skipped unless
// the Postgres test DB is reachable so devs without `pnpm e2e:db-setup` still
// see a green `pnpm test`.
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

describe.skipIf(skip)('users.addRole (integration)', () => {
  let originalDatabaseUrl: string | undefined;
  let originalNodeEnv: string | undefined;
  const username = `add-role-itest-${Date.now()}-${Math.floor(
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

  it('appends the role additively, is idempotent, and rejects non-whitelisted roles', async () => {
    const { db } = await import('../db.js');
    const { users } = await import('../schema.js');
    const { eq } = await import('drizzle-orm');
    const { appRouter } = await import('../trpc/router.js');
    const { createCallerFactory } = await import('../trpc/trpc.js');

    // Seed a user pre-populated with `promoter` — the MUS-95 user story is
    // "a user with a single role adds the other one from settings", so we
    // verify the mutation is additive rather than replacing.
    const [created] = await db
      .insert(users)
      .values({
        username,
        password_hash: 'placeholder-hash',
        roles: ['promoter'],
      })
      .returning({ id: users.id, username: users.username, roles: users.roles });
    expect(created.roles).toEqual(['promoter']);

    const createCaller = createCallerFactory(appRouter);
    const caller = createCaller({
      user: {
        id: String(created.id),
        username,
        roles: ['promoter'],
      },
    });

    // --- (a) First call appends the new role additively. ---------------
    const first = await caller.users.addRole({ role: 'musician' });
    expect(first.roles).toEqual(['promoter', 'musician']);

    // Read back the row to prove the column actually persisted and that the
    // original `promoter` role was preserved (not clobbered).
    const [afterFirst] = await db
      .select({ roles: users.roles })
      .from(users)
      .where(eq(users.id, created.id));
    expect(afterFirst.roles).toEqual(['promoter', 'musician']);

    // --- (b) Re-submitting the same role is a no-op. -------------------
    // Idempotency is an explicit AC — re-calling must not error or
    // produce a duplicate entry.
    const second = await caller.users.addRole({ role: 'musician' });
    expect(second.roles).toEqual(['promoter', 'musician']);

    const [afterSecond] = await db
      .select({ roles: users.roles })
      .from(users)
      .where(eq(users.id, created.id));
    expect(afterSecond.roles).toEqual(['promoter', 'musician']);

    // --- (c) Adding a role the user already had from onboarding is a
    // no-op too — covers the "user bounces through add-role for a role
    // they already have" race (e.g. second tap before state refreshes).
    const third = await caller.users.addRole({ role: 'promoter' });
    expect(third.roles).toEqual(['promoter', 'musician']);

    // --- (d) Non-whitelisted roles are rejected by Zod. ----------------
    await expect(
      // `as unknown as` bypasses the compile-time enum narrowing — the
      // runtime check is what we're proving here.
      caller.users.addRole({
        role: 'engineer' as unknown as 'musician',
      }),
    ).rejects.toThrow();

    const [afterReject] = await db
      .select({ roles: users.roles })
      .from(users)
      .where(eq(users.id, created.id));
    expect(afterReject.roles).toEqual(['promoter', 'musician']);
  });
});
