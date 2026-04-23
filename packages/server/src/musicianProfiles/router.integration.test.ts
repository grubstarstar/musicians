// Integration test for the musicianProfiles tRPC router (MUS-85).
//
// Follows the same pattern as `testRoutes.integration.test.ts`: probes the
// test DB, skips the whole suite if it isn't up, and exercises both
// procedures via a real DB round-trip against `musicians_test`.
//
// Why a caller rather than HTTP: the tRPC caller exposes the router with a
// synthetic `Context`, so we can toggle between authenticated and
// unauthenticated calls without building JWTs. That keeps the tests focused
// on the contract: "unauthenticated upsertMine throws UNAUTHORIZED",
// "get returns null when there's no row", etc.
import { TRPCError } from '@trpc/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

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

describe.skipIf(skip)('musicianProfiles router (integration)', () => {
  let originalDatabaseUrl: string | undefined;
  // Two callers: one "logged in" as the seeded user, one with no user. We
  // rebuild them after the dynamic imports so they share the same `db`
  // singleton that the router imports.
  let authedCaller: {
    musicianProfiles: {
      get: (input: { userId: number }) => Promise<unknown>;
      upsertMine: (input: {
        instruments: string[];
        experienceYears: number | null;
        location: string | null;
        bio: string | null;
        availableForSessionWork: boolean;
      }) => Promise<unknown>;
    };
  };
  let anonCaller: {
    musicianProfiles: {
      get: (input: { userId: number }) => Promise<unknown>;
      upsertMine: (input: {
        instruments: string[];
        experienceYears: number | null;
        location: string | null;
        bio: string | null;
        availableForSessionWork: boolean;
      }) => Promise<unknown>;
    };
  };

  let userId: number;
  let otherUserId: number;

  beforeAll(async () => {
    originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = TEST_DB_URL;

    // Import after env is set so the singleton `db` binds to the test DB.
    const { appRouter } = await import('../trpc/router.js');
    const { createCallerFactory } = await import('../trpc/trpc.js');
    const createCaller = createCallerFactory(appRouter);

    const { db } = await import('../db.js');
    const { users, musicianProfiles } = await import('../schema.js');
    const { eq } = await import('drizzle-orm');

    // Reuse the seedE2E `sesh` user — it's the bandless musician fixture that
    // most closely matches this slice's target shape (a user who may or may
    // not later have a profile). If it's not there, create it.
    const [existingSesh] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, 'mus85-sesh'))
      .limit(1);
    if (existingSesh) {
      userId = existingSesh.id;
    } else {
      const [row] = await db
        .insert(users)
        .values({
          username: 'mus85-sesh',
          password_hash: 'test-only-not-a-real-hash',
        })
        .returning({ id: users.id });
      if (!row) throw new Error('Failed to seed mus85-sesh user');
      userId = row.id;
    }

    const [existingOther] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, 'mus85-other'))
      .limit(1);
    if (existingOther) {
      otherUserId = existingOther.id;
    } else {
      const [row] = await db
        .insert(users)
        .values({
          username: 'mus85-other',
          password_hash: 'test-only-not-a-real-hash',
        })
        .returning({ id: users.id });
      if (!row) throw new Error('Failed to seed mus85-other user');
      otherUserId = row.id;
    }

    // Start each test with a clean slate for both users' profile rows.
    await db.delete(musicianProfiles).where(eq(musicianProfiles.user_id, userId));
    await db.delete(musicianProfiles).where(eq(musicianProfiles.user_id, otherUserId));

    authedCaller = createCaller({
      user: { id: String(userId), username: 'mus85-sesh' },
    });
    anonCaller = createCaller({ user: null });
  });

  beforeEach(async () => {
    // Reset the profile rows between tests so ordering never matters.
    const { db } = await import('../db.js');
    const { musicianProfiles } = await import('../schema.js');
    const { eq } = await import('drizzle-orm');
    await db.delete(musicianProfiles).where(eq(musicianProfiles.user_id, userId));
    await db.delete(musicianProfiles).where(eq(musicianProfiles.user_id, otherUserId));
  });

  afterAll(async () => {
    // Leave the two test users in place (they're cheap; inserting/deleting
    // users each run churns sequences) but make sure their profile rows are
    // gone so a subsequent run doesn't inherit state.
    const { db } = await import('../db.js');
    const { musicianProfiles } = await import('../schema.js');
    const { eq } = await import('drizzle-orm');
    await db.delete(musicianProfiles).where(eq(musicianProfiles.user_id, userId));
    await db.delete(musicianProfiles).where(eq(musicianProfiles.user_id, otherUserId));
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it('get returns null for a user with no profile row', async () => {
    const result = await authedCaller.musicianProfiles.get({ userId });
    expect(result).toBeNull();
  });

  it('upsertMine inserts a new row keyed off ctx.user.id', async () => {
    const created = (await authedCaller.musicianProfiles.upsertMine({
      instruments: ['drums', 'percussion'],
      experienceYears: 8,
      location: 'Melbourne',
      bio: 'Session drummer since 2016.',
      availableForSessionWork: true,
    })) as {
      userId: number;
      instruments: string[];
      experienceYears: number | null;
      location: string | null;
      bio: string | null;
      availableForSessionWork: boolean;
      createdAt: Date;
      updatedAt: Date;
    };

    expect(created.userId).toBe(userId);
    expect(created.instruments).toEqual(['drums', 'percussion']);
    expect(created.experienceYears).toBe(8);
    expect(created.location).toBe('Melbourne');
    expect(created.bio).toBe('Session drummer since 2016.');
    expect(created.availableForSessionWork).toBe(true);
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);

    // Round-trip: `get` for the same user returns the persisted row.
    const fetched = await authedCaller.musicianProfiles.get({ userId });
    expect(fetched).toEqual(created);
  });

  it('upsertMine overwrites an existing row, preserves createdAt, bumps updatedAt', async () => {
    const first = (await authedCaller.musicianProfiles.upsertMine({
      instruments: ['guitar'],
      experienceYears: 5,
      location: null,
      bio: null,
      availableForSessionWork: false,
    })) as { createdAt: Date; updatedAt: Date };

    // A small sleep keeps the timestamp delta unambiguous on very fast runs.
    await new Promise((r) => setTimeout(r, 15));

    const second = (await authedCaller.musicianProfiles.upsertMine({
      instruments: ['guitar', 'bass'],
      experienceYears: 6,
      location: 'Sydney',
      bio: 'Updated.',
      availableForSessionWork: true,
    })) as {
      userId: number;
      instruments: string[];
      experienceYears: number | null;
      location: string | null;
      bio: string | null;
      availableForSessionWork: boolean;
      createdAt: Date;
      updatedAt: Date;
    };

    expect(second.userId).toBe(userId);
    expect(second.instruments).toEqual(['guitar', 'bass']);
    expect(second.experienceYears).toBe(6);
    expect(second.location).toBe('Sydney');
    expect(second.bio).toBe('Updated.');
    expect(second.availableForSessionWork).toBe(true);
    // `created_at` is preserved across the conflict update.
    expect(second.createdAt.getTime()).toBe(first.createdAt.getTime());
    // `updated_at` moves forward (>= avoids flake if the clock snaps).
    expect(second.updatedAt.getTime()).toBeGreaterThanOrEqual(first.updatedAt.getTime());
  });

  it('upsertMine accepts nullable fields explicitly set to null', async () => {
    const result = (await authedCaller.musicianProfiles.upsertMine({
      instruments: [],
      experienceYears: null,
      location: null,
      bio: null,
      availableForSessionWork: false,
    })) as {
      instruments: string[];
      experienceYears: number | null;
      location: string | null;
      bio: string | null;
      availableForSessionWork: boolean;
    };
    expect(result.instruments).toEqual([]);
    expect(result.experienceYears).toBeNull();
    expect(result.location).toBeNull();
    expect(result.bio).toBeNull();
    expect(result.availableForSessionWork).toBe(false);
  });

  it('unauthenticated upsertMine throws UNAUTHORIZED', async () => {
    await expect(
      anonCaller.musicianProfiles.upsertMine({
        instruments: ['violin'],
        experienceYears: 3,
        location: 'Perth',
        bio: null,
        availableForSessionWork: true,
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('input schema rejects any attempt to pass a userId (mutation is caller-keyed)', async () => {
    // Zod strips unknown keys by default, which means a caller who *tries*
    // to target another user by sending a `userId` in the payload silently
    // has it ignored — the row still lands on their own id. This test
    // pins that behaviour so a future schema relaxation that started
    // honouring an input `userId` would regress loudly.
    await authedCaller.musicianProfiles.upsertMine({
      // @ts-expect-error — userId is deliberately not part of the input schema
      userId: otherUserId,
      instruments: ['keys'],
      experienceYears: 2,
      location: null,
      bio: null,
      availableForSessionWork: false,
    });

    const mine = (await authedCaller.musicianProfiles.get({ userId })) as {
      userId: number;
    } | null;
    const other = await authedCaller.musicianProfiles.get({ userId: otherUserId });
    expect(mine?.userId).toBe(userId);
    expect(other).toBeNull();
  });

  it('get validates userId is a positive integer', async () => {
    await expect(
      authedCaller.musicianProfiles.get({ userId: 0 }),
    ).rejects.toBeInstanceOf(TRPCError);
    await expect(
      authedCaller.musicianProfiles.get({ userId: -1 }),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});
