// Integration tests for the `band_join` request flow (MUS-87). Drives the
// real tRPC router against `musicians_test` using `createCallerFactory`, no
// HTTP / JWT ceremony. Skipped when the test DB isn't reachable — mirrors
// the probe-and-skip pattern in `routes/testRoutes.integration.test.ts`.
//
// Coverage per the ticket AC:
//   - create (happy path + appears in My Requests)
//   - accept (by a band member; inserts `band_members`; closes request)
//   - reject (by a band member; does NOT insert `band_members`; closes)
//   - cancel (by the source; does NOT touch membership)
//   - already-a-member guard (PRECONDITION_FAILED on create)
//   - band-not-found guard (NOT_FOUND on create)
//   - non-member cannot respond (FORBIDDEN)
//   - only-source can cancel (FORBIDDEN)

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TRPCError } from '@trpc/server';

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

describe.skipIf(skip)('requests band_join router (integration)', () => {
  // We bind module imports inside `beforeAll` so the singleton DB client in
  // `db.ts` connects to the test DB, not the dev one. Types are declared via
  // `typeof import(...)` so we don't need the values at module scope.
  let originalDatabaseUrl: string | undefined;
  let originalNodeEnv: string | undefined;
  let db: typeof import('../db.js')['db'];
  let schema: typeof import('../schema.js');
  let appRouter: typeof import('../trpc/router.js')['appRouter'];
  let createCallerFactory: typeof import('../trpc/trpc.js')['createCallerFactory'];

  // Helper: build a caller for a given user id (null = anonymous). `ctx.user.id`
  // is a string in the real JWT — the procedure coerces with Number(), so
  // strings here mirror production behaviour.
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

  // Reset fixture before each test so failures in one case don't cascade.
  // Uses the same TRUNCATE pattern as `POST /test/reset` — direct SQL rather
  // than importing seedE2E so we can shape our own fixture (three users, two
  // bands) without colliding with the Maestro seed.
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
          "band_members",
          "band_tracks",
          "bands",
          "users"
        RESTART IDENTITY CASCADE
      `),
    );
  });

  // Fixture shape used across tests:
  //   alice  — member of `theTesters`  (authoriser / band member)
  //   bob    — NOT a member of any band (requester)
  //   carol  — unrelated user (neither band member nor requester)
  //   bandA  — `theTesters` with alice as the only member
  //   bandB  — unrelated second band, no members
  async function seed(): Promise<{
    aliceId: number;
    bobId: number;
    carolId: number;
    bandAId: number;
    bandBId: number;
  }> {
    const [alice] = await db
      .insert(schema.users)
      .values({
        username: 'alice',
        password_hash: 'x',
        firstName: 'Alice',
        lastName: null,
      })
      .returning({ id: schema.users.id });
    const [bob] = await db
      .insert(schema.users)
      .values({
        username: 'bob',
        password_hash: 'x',
        firstName: 'Bob',
        lastName: null,
      })
      .returning({ id: schema.users.id });
    const [carol] = await db
      .insert(schema.users)
      .values({
        username: 'carol',
        password_hash: 'x',
        firstName: 'Carol',
        lastName: null,
      })
      .returning({ id: schema.users.id });

    const [bandA] = await db
      .insert(schema.bands)
      .values({ name: 'The Testers', imageUrl: null })
      .returning({ id: schema.bands.id });
    const [bandB] = await db
      .insert(schema.bands)
      .values({ name: 'Unrelated Band', imageUrl: null })
      .returning({ id: schema.bands.id });

    await db.insert(schema.bandMembers).values({
      band_id: bandA.id,
      user_id: alice.id,
    });

    return {
      aliceId: alice.id,
      bobId: bob.id,
      carolId: carol.id,
      bandAId: bandA.id,
      bandBId: bandB.id,
    };
  }

  describe('create', () => {
    it('persists a band_join request, anchors to the target band, and lists it under My Requests', async () => {
      const { bobId, bandAId } = await seed();
      const bob = callerFor(bobId);

      const created = await bob.requests.create({
        kind: 'band_join',
        bandId: bandAId,
      });
      expect(created.kind).toBe('band_join');
      expect(created.status).toBe('open');
      expect(created.slotCount).toBe(1);
      expect(created.slotsFilled).toBe(0);
      expect(created.anchorBandId).toBe(bandAId);
      expect(created.details).toEqual({ kind: 'band_join', bandId: bandAId });

      // "appears in My Requests with a pending state" — status 'open' is the
      // pending state since request_status is ('open' | 'closed' | 'cancelled').
      const mine = await bob.requests.listMine();
      expect(mine).toHaveLength(1);
      expect(mine[0]?.id).toBe(created.id);
      expect(mine[0]?.kind).toBe('band_join');
      expect(mine[0]?.status).toBe('open');
      expect(mine[0]?.anchorBand).toEqual(
        expect.objectContaining({ id: bandAId, name: 'The Testers' }),
      );
    });

    it('rejects when the target band does not exist', async () => {
      const { bobId } = await seed();
      const bob = callerFor(bobId);

      await expect(
        bob.requests.create({ kind: 'band_join', bandId: 999999 }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('rejects with a clear message when the requester is already a member of the band', async () => {
      const { aliceId, bandAId } = await seed();
      const alice = callerFor(aliceId);

      // alice is already a member of bandA.
      const thrown: unknown = await alice.requests
        .create({ kind: 'band_join', bandId: bandAId })
        .then(
          () => null,
          (e: unknown) => e,
        );
      expect(thrown).toBeInstanceOf(TRPCError);
      const err = thrown as TRPCError;
      expect(err.code).toBe('PRECONDITION_FAILED');
      expect(err.message).toMatch(/already a member/i);

      // And no request row was inserted.
      const rows = await db.select().from(schema.requests);
      expect(rows).toHaveLength(0);
    });

    it('requires authentication', async () => {
      await seed();
      const anon = callerFor(null);
      await expect(
        anon.requests.create({ kind: 'band_join', bandId: 1 }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
  });

  describe('respondToBandJoin — accept', () => {
    it('adds the requester to band_members, marks the request closed, and is authorised for any band member', async () => {
      const { aliceId, bobId, bandAId } = await seed();
      const bob = callerFor(bobId);
      const alice = callerFor(aliceId);

      const created = await bob.requests.create({
        kind: 'band_join',
        bandId: bandAId,
      });

      const outcome = await alice.requests.respondToBandJoin({
        requestId: created.id,
        decision: 'accepted',
      });
      expect(outcome).toEqual({ requestId: created.id, status: 'closed' });

      // Membership inserted for the REQUESTER, not the accepter.
      const members = await db
        .select({
          band_id: schema.bandMembers.band_id,
          user_id: schema.bandMembers.user_id,
        })
        .from(schema.bandMembers);
      expect(members).toEqual(
        expect.arrayContaining([
          { band_id: bandAId, user_id: aliceId }, // pre-existing
          { band_id: bandAId, user_id: bobId }, // from the accept
        ]),
      );
      expect(members).toHaveLength(2);

      // Request row closed with slots_filled ticked.
      const [reqRow] = await db.select().from(schema.requests);
      expect(reqRow?.status).toBe('closed');
      expect(reqRow?.slots_filled).toBe(1);
    });

    it('is idempotent wrt band_members (no duplicate row) when the requester was somehow added between create and accept', async () => {
      const { aliceId, bobId, bandAId } = await seed();
      const bob = callerFor(bobId);
      const alice = callerFor(aliceId);

      const created = await bob.requests.create({
        kind: 'band_join',
        bandId: bandAId,
      });

      // Simulate a concurrent insert of the same membership BEFORE accept.
      await db
        .insert(schema.bandMembers)
        .values({ band_id: bandAId, user_id: bobId })
        .onConflictDoNothing();

      const outcome = await alice.requests.respondToBandJoin({
        requestId: created.id,
        decision: 'accepted',
      });
      expect(outcome.status).toBe('closed');

      const members = await db
        .select({
          band_id: schema.bandMembers.band_id,
          user_id: schema.bandMembers.user_id,
        })
        .from(schema.bandMembers);
      // Exactly one bob membership — composite PK prevented the duplicate.
      const bobRows = members.filter(
        (m) => m.band_id === bandAId && m.user_id === bobId,
      );
      expect(bobRows).toHaveLength(1);
    });

    it('rejects accept attempts from non-members of the target band', async () => {
      const { bobId, carolId, bandAId } = await seed();
      const bob = callerFor(bobId);
      const carol = callerFor(carolId);

      const created = await bob.requests.create({
        kind: 'band_join',
        bandId: bandAId,
      });

      await expect(
        carol.requests.respondToBandJoin({
          requestId: created.id,
          decision: 'accepted',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      // And no membership was created.
      const bobRows = await db
        .select({ user_id: schema.bandMembers.user_id })
        .from(schema.bandMembers);
      expect(bobRows.find((r) => r.user_id === bobId)).toBeUndefined();
    });

    it('rejects responding to a non-band_join request', async () => {
      const { aliceId, bobId } = await seed();
      const bob = callerFor(bobId);
      const alice = callerFor(aliceId);

      // Post a `band-for-musician` request — a different kind.
      const otherReq = await bob.requests.create({
        kind: 'band-for-musician',
        instrument: 'Drums',
      });

      await expect(
        alice.requests.respondToBandJoin({
          requestId: otherReq.id,
          decision: 'accepted',
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('rejects responding twice', async () => {
      const { aliceId, bobId, bandAId } = await seed();
      const bob = callerFor(bobId);
      const alice = callerFor(aliceId);

      const created = await bob.requests.create({
        kind: 'band_join',
        bandId: bandAId,
      });
      await alice.requests.respondToBandJoin({
        requestId: created.id,
        decision: 'accepted',
      });
      await expect(
        alice.requests.respondToBandJoin({
          requestId: created.id,
          decision: 'accepted',
        }),
      ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    });
  });

  describe('respondToBandJoin — reject', () => {
    it('closes the request without inserting any band_members row', async () => {
      const { aliceId, bobId, bandAId } = await seed();
      const bob = callerFor(bobId);
      const alice = callerFor(aliceId);

      const created = await bob.requests.create({
        kind: 'band_join',
        bandId: bandAId,
      });

      const outcome = await alice.requests.respondToBandJoin({
        requestId: created.id,
        decision: 'rejected',
      });
      expect(outcome).toEqual({ requestId: created.id, status: 'closed' });

      const [reqRow] = await db.select().from(schema.requests);
      expect(reqRow?.status).toBe('closed');
      // slots_filled is NOT ticked on reject — no seat was filled.
      expect(reqRow?.slots_filled).toBe(0);

      const members = await db
        .select({ user_id: schema.bandMembers.user_id })
        .from(schema.bandMembers);
      // Only the pre-existing alice membership. bob was not added.
      expect(members.find((m) => m.user_id === bobId)).toBeUndefined();
    });
  });

  describe('cancel', () => {
    it('marks the request cancelled without touching band_members', async () => {
      const { bobId, bandAId } = await seed();
      const bob = callerFor(bobId);

      const created = await bob.requests.create({
        kind: 'band_join',
        bandId: bandAId,
      });

      const outcome = await bob.requests.cancel({ requestId: created.id });
      expect(outcome).toEqual({
        requestId: created.id,
        status: 'cancelled',
      });

      const [reqRow] = await db.select().from(schema.requests);
      expect(reqRow?.status).toBe('cancelled');

      // Membership untouched.
      const members = await db
        .select({ user_id: schema.bandMembers.user_id })
        .from(schema.bandMembers);
      expect(members.find((m) => m.user_id === bobId)).toBeUndefined();
    });

    it('rejects cancel attempts from a user who is not the source', async () => {
      const { aliceId, bobId, bandAId } = await seed();
      const bob = callerFor(bobId);
      const alice = callerFor(aliceId);

      const created = await bob.requests.create({
        kind: 'band_join',
        bandId: bandAId,
      });

      await expect(
        alice.requests.cancel({ requestId: created.id }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('rejects cancel after the request is already closed/cancelled', async () => {
      const { aliceId, bobId, bandAId } = await seed();
      const bob = callerFor(bobId);
      const alice = callerFor(aliceId);

      const created = await bob.requests.create({
        kind: 'band_join',
        bandId: bandAId,
      });
      await alice.requests.respondToBandJoin({
        requestId: created.id,
        decision: 'accepted',
      });
      await expect(
        bob.requests.cancel({ requestId: created.id }),
      ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    });
  });
});
