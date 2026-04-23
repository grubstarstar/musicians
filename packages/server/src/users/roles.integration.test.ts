// MUS-86 integration test: users.roles round-trips through Postgres and a
// protected tRPC procedure can append to the set.
//
// Skipped unless the Postgres test DB is reachable, matching the pattern in
// `routes/testRoutes.integration.test.ts` — devs without `pnpm e2e:db-setup`
// having been run still see a green `pnpm test`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

const TEST_DB_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/musicians_test';

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

describe.skipIf(skip)('users.roles (integration)', () => {
  let originalDatabaseUrl: string | undefined;
  let originalNodeEnv: string | undefined;
  // Unique username per run so we don't collide with whatever the seed or a
  // previous run left behind. Cleaned up in afterAll.
  const username = `roles-itest-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  beforeAll(async () => {
    originalDatabaseUrl = process.env.DATABASE_URL;
    originalNodeEnv = process.env.NODE_ENV;
    process.env.DATABASE_URL = TEST_DB_URL;
    process.env.NODE_ENV = 'test';
  });

  afterAll(async () => {
    // Clean up the row so re-runs don't accumulate state.
    const { db } = await import('../db.js');
    const { users } = await import('../schema.js');
    const { eq } = await import('drizzle-orm');
    await db.delete(users).where(eq(users.username, username));

    process.env.DATABASE_URL = originalDatabaseUrl;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('freshly inserted user has empty roles and appending via a protected procedure persists', async () => {
    const { db } = await import('../db.js');
    const { users } = await import('../schema.js');
    const { eq } = await import('drizzle-orm');
    const { createCallerFactory, protectedProcedure, router } = await import(
      '../trpc/trpc.js'
    );
    const { hasRole } = await import('../auth.js');

    // --- (a) Freshly inserted user defaults to an empty roles array. -------
    // Insert without supplying `roles` — the DB default '{}' should take
    // effect. Mirrors what a future `/register` handler would do.
    const [created] = await db
      .insert(users)
      .values({ username, password_hash: 'placeholder-hash' })
      .returning({ id: users.id, username: users.username, roles: users.roles });

    expect(created.username).toBe(username);
    expect(created.roles).toEqual([]);

    // Cross-check via a round-trip select so we know the column actually
    // persisted, not just the returning clause.
    const [fetched] = await db
      .select({ roles: users.roles })
      .from(users)
      .where(eq(users.id, created.id));
    expect(fetched.roles).toEqual([]);

    // --- (b) Appending a role via a protected tRPC procedure persists. ----
    const user = created;

    // Test-only router exposing a single protected mutation that reads
    // `ctx.user.roles`, appends the input role if absent, and persists via
    // the Drizzle array-append operator. This exercises the whole pipeline
    // the ticket cares about:
    //   1. protectedProcedure injects the typed `ctx.user` (roles: string[])
    //   2. the procedure uses `hasRole` to avoid duplicate appends
    //   3. the SQL append writes to the column and we read it back
    const appendRoleRouter = router({
      appendRole: protectedProcedure
        .input(z.object({ role: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
          // ctx.user.roles is the JWT snapshot; compute the next set from the
          // DB row to avoid races with other role edits in flight.
          if (hasRole(ctx.user, input.role)) {
            return { roles: ctx.user.roles };
          }
          const userId = Number(ctx.user.id);
          const [updated] = await db
            .update(users)
            .set({ roles: sql`array_append(${users.roles}, ${input.role})` })
            .where(eq(users.id, userId))
            .returning({ roles: users.roles });
          return { roles: updated.roles };
        }),
    });

    const createCaller = createCallerFactory(appendRoleRouter);
    const caller = createCaller({
      user: {
        id: String(user.id),
        username,
        // Initial ctx mirrors the JWT — empty to start, matching the DB.
        roles: [],
      },
    });

    const result = await caller.appendRole({ role: 'musician' });
    expect(result.roles).toEqual(['musician']);

    // Cross-check by reading the column directly — no caching in play.
    const [persisted] = await db
      .select({ roles: users.roles })
      .from(users)
      .where(eq(users.id, user.id));
    expect(persisted.roles).toEqual(['musician']);

    // Second call with the same role is a no-op thanks to `hasRole` — but the
    // caller's ctx snapshot still shows the pre-append state, so we rebuild
    // the caller with the refreshed roles to model a fresh request.
    const refreshedCaller = createCaller({
      user: { id: String(user.id), username, roles: ['musician'] },
    });
    const second = await refreshedCaller.appendRole({ role: 'musician' });
    expect(second.roles).toEqual(['musician']);

    // Appending a different role lands alongside, not replacing.
    const third = await refreshedCaller.appendRole({ role: 'promoter' });
    expect(third.roles).toEqual(['musician', 'promoter']);

    const [final] = await db
      .select({ roles: users.roles })
      .from(users)
      .where(eq(users.id, user.id));
    expect(final.roles).toEqual(['musician', 'promoter']);
  });
});
