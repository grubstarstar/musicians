// MUS-77: integration tests for `gigs.getSlotById` — the slot-anchored seed
// lookup that backs the post-request form's `+` CTA entry point.
//
// Follows the same probe-and-skip pattern as the other integration tests in
// this package: when `musicians_test` isn't available the whole describe
// block is skipped silently. When it IS available we drive the real tRPC
// router against the real DB via `createCallerFactory` — no HTTP / JWT.
//
// Coverage per the AC:
//   1. Organiser can read their own slot — resolves gigId + genre shape.
//   2. Slot with no genre returns `genre: null` (back-compat with slots
//      created before MUS-103).
//   3. Non-organiser is treated as NOT_FOUND — same error for "slot missing"
//      and "not yours" so membership can't be fingerprinted.
//   4. Completely missing slot id → NOT_FOUND (same error as (3)).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

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

describe.skipIf(skip)('gigs.getSlotById (integration)', () => {
  let originalDatabaseUrl: string | undefined;
  let originalNodeEnv: string | undefined;
  let db: typeof import('../db.js')['db'];
  let schema: typeof import('../schema.js');
  let appRouter: typeof import('../trpc/router.js')['appRouter'];
  let createCallerFactory: typeof import('../trpc/trpc.js')['createCallerFactory'];

  function callerFor(userId: number) {
    const factory = createCallerFactory(appRouter);
    return factory({ user: { id: String(userId), username: `user${userId}` } });
  }

  beforeAll(async () => {
    originalDatabaseUrl = process.env.DATABASE_URL;
    originalNodeEnv = process.env.NODE_ENV;
    process.env.DATABASE_URL = TEST_DB_URL;
    process.env.NODE_ENV = 'test';

    ({ db } = await import('../db.js'));
    schema = await import('../schema.js');
    ({ appRouter } = await import('../trpc/router.js'));
    ({ createCallerFactory } = await import('../trpc/trpc.js'));
  });

  afterAll(async () => {
    process.env.DATABASE_URL = originalDatabaseUrl;
    process.env.NODE_ENV = originalNodeEnv;
  });

  // `genres` are seeded by migration 0015; leave them untouched so slug
  // lookups below remain stable.
  beforeEach(async () => {
    const { sql } = await import('drizzle-orm');
    await db.execute(
      sql.raw(`
        TRUNCATE TABLE
          "gig_slots",
          "gigs",
          "venues",
          "user_roles",
          "users"
        RESTART IDENTITY CASCADE
      `),
    );
  });

  // Minimal fixture:
  //   - organiser  (alice)
  //   - outsider   (bob)
  //   - one gig organised by alice, one slot tagged `rock`, one slot with no
  //     genre. We return both slot ids so the tests can flip between them.
  async function seed(): Promise<{
    aliceId: number;
    bobId: number;
    gigId: number;
    rockGenreId: number;
    rockSlotId: number;
    plainSlotId: number;
  }> {
    const { eq } = await import('drizzle-orm');

    const [alice] = await db
      .insert(schema.users)
      .values({
        username: 'alice',
        password_hash: 'x',
        firstName: 'Alice',
        lastName: null,
        roles: ['promoter'],
      })
      .returning({ id: schema.users.id });
    const [bob] = await db
      .insert(schema.users)
      .values({
        username: 'bob',
        password_hash: 'x',
        firstName: 'Bob',
        lastName: null,
        roles: ['musician'],
      })
      .returning({ id: schema.users.id });

    // Ownership gate is on `gigs.organiser_user_id`; the promoter role check
    // matters for creating gigs but `getSlotById` doesn't need it. Still, we
    // grant it so the fixture mirrors production state.
    await db.insert(schema.userRoles).values({
      user_id: alice.id,
      role: 'promoter',
    });

    const [venue] = await db
      .insert(schema.venues)
      .values({ name: 'The Pit', address: '1 Rock St' })
      .returning({ id: schema.venues.id });

    const [gig] = await db
      .insert(schema.gigs)
      .values({
        datetime: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        venue_id: venue.id,
        doors: '7pm',
        organiser_user_id: alice.id,
        status: 'open',
      })
      .returning({ id: schema.gigs.id });

    const [rockGenre] = await db
      .select({ id: schema.genres.id })
      .from(schema.genres)
      .where(eq(schema.genres.slug, 'rock'))
      .limit(1);

    const slotRows = await db
      .insert(schema.gigSlots)
      .values([
        { gig_id: gig.id, set_order: 0, fee: 25000, genre_id: rockGenre.id },
        { gig_id: gig.id, set_order: 1, fee: 30000, genre_id: null },
      ])
      .returning({
        id: schema.gigSlots.id,
        setOrder: schema.gigSlots.set_order,
      });
    const rockSlot = slotRows.find((s) => s.setOrder === 0)!;
    const plainSlot = slotRows.find((s) => s.setOrder === 1)!;

    return {
      aliceId: alice.id,
      bobId: bob.id,
      gigId: gig.id,
      rockGenreId: rockGenre.id,
      rockSlotId: rockSlot.id,
      plainSlotId: plainSlot.id,
    };
  }

  it('returns slot + gig + genre to the organiser', async () => {
    const { aliceId, gigId, rockSlotId, rockGenreId } = await seed();
    const alice = callerFor(aliceId);

    const result = await alice.gigs.getSlotById({ slotId: rockSlotId });
    expect(result).toEqual({
      slotId: rockSlotId,
      gigId,
      genre: { id: rockGenreId, slug: 'rock', name: 'Rock' },
    });
  });

  it('returns genre: null when the slot has no genre requirement', async () => {
    const { aliceId, gigId, plainSlotId } = await seed();
    const alice = callerFor(aliceId);

    const result = await alice.gigs.getSlotById({ slotId: plainSlotId });
    expect(result).toEqual({
      slotId: plainSlotId,
      gigId,
      genre: null,
    });
  });

  it("rejects a non-organiser as NOT_FOUND (ownership gate, can't fingerprint existence)", async () => {
    const { bobId, rockSlotId } = await seed();
    const bob = callerFor(bobId);

    await expect(
      bob.gigs.getSlotById({ slotId: rockSlotId }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects a missing slot as NOT_FOUND (same shape as unauthorised)', async () => {
    const { aliceId } = await seed();
    const alice = callerFor(aliceId);

    await expect(
      // Large id guaranteed not to exist after the beforeEach truncate.
      alice.gigs.getSlotById({ slotId: 999_999 }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
