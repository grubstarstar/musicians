// MUS-103: genres taxonomy + band-for-gig-slot EoI hard-gate integration tests.
//
// Drives the real tRPC router against `musicians_test` via `createCallerFactory`
// (no HTTP / JWT ceremony). Mirrors the probe-and-skip pattern used elsewhere
// in this suite so the file is silent when the test DB isn't up.
//
// Coverage per the AC:
//   1. Band fetch shape — `bands.getById` returns a shaped `genres: { id, slug,
//      name }[]` array. Also spot-checks `bands.listMine`.
//   2. Slot fetch shape — `gigs.getById` returns `genre: { id, slug, name }` on
//      slots that have a genre_id set, and `genre: null` when unset.
//   3. EoI hard-gate accept — applying band's `band_genres` includes the slot
//      genre: EoI is accepted.
//   4. EoI hard-gate reject — applying band's `band_genres` does NOT include
//      the slot genre: EoI is rejected with FORBIDDEN and a clear message.
//   5. EoI back-compat — when the request's `details.genreId` is null/unset,
//      EoIs are accepted regardless of the applying band's genres.

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

describe.skipIf(skip)('genres taxonomy + EoI hard-gate (integration)', () => {
  let originalDatabaseUrl: string | undefined;
  let originalNodeEnv: string | undefined;
  let db: typeof import('../db.js')['db'];
  let schema: typeof import('../schema.js');
  let appRouter: typeof import('../trpc/router.js')['appRouter'];
  let createCallerFactory: typeof import('../trpc/trpc.js')['createCallerFactory'];

  function callerFor(userId: number | null) {
    const factory = createCallerFactory(appRouter);
    const ctx =
      userId === null
        ? { user: null }
        : { user: { id: String(userId), username: `user${userId}` } };
    return factory(ctx);
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

  // Truncate user-data tables between tests so failures don't cascade.
  // `genres` is deliberately NOT truncated — it's the curated taxonomy seeded
  // by migration `0015_genres_taxonomy.sql` and every test resolves ids from
  // it via slug lookups below.
  beforeEach(async () => {
    const { sql } = await import('drizzle-orm');
    await db.execute(
      sql.raw(`
        TRUNCATE TABLE
          "expressions_of_interest",
          "requests",
          "gig_slots",
          "gigs",
          "rehearsals",
          "band_genres",
          "band_members",
          "band_tracks",
          "bands",
          "users"
        RESTART IDENTITY CASCADE
      `),
    );
  });

  // Shared fixture:
  //   - alice  promoter (organises gigs)
  //   - bob    member of `rockers` (the applying band, genres: rock)
  //   - carol  member of `jazzcats` (second applying band, genres: jazz)
  //   - rockers   band, bob is the only member, linked to 'rock' genre
  //   - jazzcats  band, carol is the only member, linked to 'jazz' genre
  //   - A single gig organised by alice with two slots:
  //       slot[0]: no genre filter
  //       slot[1]: genre = 'rock'
  //
  // Genre ids are looked up from the curated taxonomy by slug so the seed
  // doesn't hard-code ids (migration order controls those).
  async function seed(): Promise<{
    aliceId: number;
    bobId: number;
    carolId: number;
    rockersId: number;
    jazzcatsId: number;
    gigId: number;
    rockGenreId: number;
    jazzGenreId: number;
    openSlotId: number;
    rockSlotId: number;
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
    const [carol] = await db
      .insert(schema.users)
      .values({
        username: 'carol',
        password_hash: 'x',
        firstName: 'Carol',
        lastName: null,
        roles: ['musician'],
      })
      .returning({ id: schema.users.id });

    // The hard-gate in `band-for-gig-slot` request create requires alice to
    // hold the `promoter` role (on `user_roles`, per `hasPromoterRole`). The
    // `users.roles` array is a separate MUS-86 concern — we set both so any
    // future tightening of the gate doesn't break this suite.
    await db.insert(schema.userRoles).values({
      user_id: alice.id,
      role: 'promoter',
    });

    const [rockers] = await db
      .insert(schema.bands)
      .values({ name: 'Rockers', imageUrl: null })
      .returning({ id: schema.bands.id });
    const [jazzcats] = await db
      .insert(schema.bands)
      .values({ name: 'Jazzcats', imageUrl: null })
      .returning({ id: schema.bands.id });

    await db.insert(schema.bandMembers).values([
      { band_id: rockers.id, user_id: bob.id },
      { band_id: jazzcats.id, user_id: carol.id },
    ]);

    const [rockGenre] = await db
      .select({ id: schema.genres.id })
      .from(schema.genres)
      .where(eq(schema.genres.slug, 'rock'))
      .limit(1);
    const [jazzGenre] = await db
      .select({ id: schema.genres.id })
      .from(schema.genres)
      .where(eq(schema.genres.slug, 'jazz'))
      .limit(1);

    await db.insert(schema.bandGenres).values([
      { band_id: rockers.id, genre_id: rockGenre.id },
      { band_id: jazzcats.id, genre_id: jazzGenre.id },
    ]);

    // A venue is needed for the gig. Address is arbitrary — the EoI flow
    // doesn't read venue details beyond the FK integrity.
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

    const slotRows = await db
      .insert(schema.gigSlots)
      .values([
        { gig_id: gig.id, set_order: 0, fee: 25000, genre_id: null },
        { gig_id: gig.id, set_order: 1, fee: 30000, genre_id: rockGenre.id },
      ])
      .returning({
        id: schema.gigSlots.id,
        setOrder: schema.gigSlots.set_order,
      });
    const openSlot = slotRows.find((s) => s.setOrder === 0)!;
    const rockSlot = slotRows.find((s) => s.setOrder === 1)!;

    return {
      aliceId: alice.id,
      bobId: bob.id,
      carolId: carol.id,
      rockersId: rockers.id,
      jazzcatsId: jazzcats.id,
      gigId: gig.id,
      rockGenreId: rockGenre.id,
      jazzGenreId: jazzGenre.id,
      openSlotId: openSlot.id,
      rockSlotId: rockSlot.id,
    };
  }

  describe('bands.getById / bands.listMine include genres', () => {
    it('returns the shaped `genres` array on the band profile', async () => {
      const { bobId, rockersId, rockGenreId } = await seed();
      const bob = callerFor(bobId);

      const profile = await bob.bands.getById({ id: rockersId });
      expect(profile.id).toBe(rockersId);
      expect(profile.genres).toEqual([
        expect.objectContaining({
          id: rockGenreId,
          slug: 'rock',
          name: 'Rock',
        }),
      ]);
      // Spot-check the projection: no snake_case leaks.
      const keys = Object.keys(profile.genres[0]!);
      expect(keys.sort()).toEqual(['id', 'name', 'slug']);
    });

    it('returns an empty `genres` array when the band has no links', async () => {
      const { bobId } = await seed();
      const bob = callerFor(bobId);

      // Extra band with no band_genres rows. bob joins it so listMine surfaces it.
      const [loose] = await db
        .insert(schema.bands)
        .values({ name: 'Loose Threads', imageUrl: null })
        .returning({ id: schema.bands.id });
      await db.insert(schema.bandMembers).values({
        band_id: loose.id,
        user_id: bobId,
      });

      const profile = await bob.bands.getById({ id: loose.id });
      expect(profile.genres).toEqual([]);
    });

    it('bands.listMine returns genres per band in one shot', async () => {
      const { bobId, rockersId, rockGenreId } = await seed();
      const bob = callerFor(bobId);

      const mine = await bob.bands.listMine();
      expect(mine).toHaveLength(1);
      expect(mine[0]?.id).toBe(rockersId);
      expect(mine[0]?.genres).toEqual([
        expect.objectContaining({
          id: rockGenreId,
          slug: 'rock',
          name: 'Rock',
        }),
      ]);
    });
  });

  describe('gigs.getById includes per-slot genre', () => {
    it('returns `genre: null` on slots with no filter and the shaped genre on filtered slots', async () => {
      const { aliceId, gigId, rockGenreId, openSlotId, rockSlotId } = await seed();
      const alice = callerFor(aliceId);

      const gig = await alice.gigs.getById({ id: gigId });
      expect(gig.slots).toHaveLength(2);

      const openSlot = gig.slots.find((s) => s.id === openSlotId);
      const rockSlot = gig.slots.find((s) => s.id === rockSlotId);
      expect(openSlot?.genre).toBeNull();
      expect(rockSlot?.genre).toEqual({
        id: rockGenreId,
        slug: 'rock',
        name: 'Rock',
      });
    });
  });

  describe('expressionsOfInterest.create hard-gate', () => {
    it('accepts when the applying band has the request\'s genreId among its band_genres', async () => {
      const { aliceId, bobId, gigId, rockersId, rockGenreId } = await seed();
      const alice = callerFor(aliceId);
      const bob = callerFor(bobId);

      // alice (promoter) creates a band-for-gig-slot request with rock filter
      const req = await alice.requests.create({
        kind: 'band-for-gig-slot',
        gigId,
        genreId: rockGenreId,
      });
      // Sanity: the genreId was snapshotted onto details.
      expect(req.details).toMatchObject({
        kind: 'band-for-gig-slot',
        genreId: rockGenreId,
      });

      // bob applies on behalf of Rockers (rock genre) — should succeed.
      const eoi = await bob.expressionsOfInterest.create({
        requestId: req.id,
        details: { kind: 'band-for-gig-slot', bandId: rockersId },
      });
      expect(eoi.state).toBe('pending');
      expect(eoi.requestId).toBe(req.id);
    });

    it('rejects with FORBIDDEN when the applying band\'s genres do not include the request\'s genreId', async () => {
      const { aliceId, carolId, gigId, jazzcatsId, rockGenreId } = await seed();
      const alice = callerFor(aliceId);
      const carol = callerFor(carolId);

      const req = await alice.requests.create({
        kind: 'band-for-gig-slot',
        gigId,
        genreId: rockGenreId,
      });

      // carol (Jazzcats, jazz only) tries to apply — should be hard-gated.
      await expect(
        carol.expressionsOfInterest.create({
          requestId: req.id,
          details: { kind: 'band-for-gig-slot', bandId: jazzcatsId },
        }),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: expect.stringMatching(/band genre does not match/i),
      });

      // And no EoI row was inserted.
      const rows = await db.select().from(schema.expressionsOfInterest);
      expect(rows).toHaveLength(0);
    });

    it('accepts regardless of band genres when the request has no genreId (back-compat)', async () => {
      const { aliceId, carolId, gigId, jazzcatsId } = await seed();
      const alice = callerFor(aliceId);
      const carol = callerFor(carolId);

      // No genreId on the request — open to any band.
      const req = await alice.requests.create({
        kind: 'band-for-gig-slot',
        gigId,
      });
      // Sanity: details.genreId is absent on the snapshot.
      expect(req.details).toMatchObject({ kind: 'band-for-gig-slot' });
      expect((req.details as { genreId?: number }).genreId).toBeUndefined();

      // carol applies as Jazzcats (jazz, no rock link) — should succeed
      // because there's no genre requirement to gate on.
      const eoi = await carol.expressionsOfInterest.create({
        requestId: req.id,
        details: { kind: 'band-for-gig-slot', bandId: jazzcatsId },
      });
      expect(eoi.state).toBe('pending');
    });
  });
});
