// Integration tests for the `promoter_group_join` request flow (MUS-88).
// Mirror of `bandJoinRouter.integration.test.ts` for promoter groups: drives
// the real tRPC router against `musicians_test` using `createCallerFactory`,
// no HTTP / JWT ceremony. Skipped when the test DB isn't reachable.
//
// Coverage per the ticket AC:
//   - create (happy path + appears in My Requests)
//   - accept (by a group member; inserts `promoters_promoter_groups`; closes)
//   - reject (by a group member; does NOT insert membership; closes)
//   - cancel (by the source; does NOT touch membership)
//   - already-a-member guard (PRECONDITION_FAILED on create)
//   - group-not-found guard (NOT_FOUND on create)
//   - non-member cannot respond (FORBIDDEN)
//   - only-source can cancel (FORBIDDEN)

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

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

describe.skipIf(skip)('requests promoter_group_join router (integration)', () => {
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

  // Truncate the same set of tables as `getPromoterGroupDetail.integration.test.ts`
  // plus the request tables — full promoter-group graph needs venues,
  // user_roles, and all the join tables cleared to avoid FK noise.
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
          "engineers_live_audio_groups",
          "engineers_recording_studios",
          "promoter_groups_venues",
          "promoters_promoter_groups",
          "live_audio_groups",
          "recording_studios",
          "venues",
          "promoter_groups",
          "user_roles",
          "band_tracks",
          "band_members",
          "bands",
          "users"
        RESTART IDENTITY CASCADE
      `),
    );
  });

  // Fixture shape used across tests:
  //   alice  — member of `groupA` (authoriser / group member)
  //   bob    — NOT a member of any promoter group (requester)
  //   carol  — unrelated user (neither group member nor requester)
  //   groupA — `Test Promotions` with alice as the only member
  //   groupB — unrelated second group, no members
  async function seed(): Promise<{
    aliceId: number;
    bobId: number;
    carolId: number;
    groupAId: number;
    groupBId: number;
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

    const [aliceRole] = await db
      .insert(schema.userRoles)
      .values({ user_id: alice.id, role: 'promoter' })
      .returning({ id: schema.userRoles.id });

    const [groupA] = await db
      .insert(schema.promoterGroups)
      .values({ name: 'Test Promotions' })
      .returning({ id: schema.promoterGroups.id });
    const [groupB] = await db
      .insert(schema.promoterGroups)
      .values({ name: 'Other Promotions' })
      .returning({ id: schema.promoterGroups.id });

    await db.insert(schema.promotersPromoterGroups).values({
      user_role_id: aliceRole.id,
      promoter_group_id: groupA.id,
    });

    return {
      aliceId: alice.id,
      bobId: bob.id,
      carolId: carol.id,
      groupAId: groupA.id,
      groupBId: groupB.id,
    };
  }

  describe('create', () => {
    it('persists a promoter_group_join request and lists it under My Requests', async () => {
      const { bobId, groupAId } = await seed();
      const bob = callerFor(bobId);

      const created = await bob.requests.create({
        kind: 'promoter_group_join',
        promoterGroupId: groupAId,
      });
      expect(created.kind).toBe('promoter_group_join');
      expect(created.status).toBe('open');
      expect(created.slotCount).toBe(1);
      expect(created.slotsFilled).toBe(0);
      // promoter_group has no anchor column on `requests` — both anchors null.
      expect(created.anchorBandId).toBeNull();
      expect(created.anchorGigId).toBeNull();
      expect(created.details).toEqual({
        kind: 'promoter_group_join',
        promoterGroupId: groupAId,
      });

      const mine = await bob.requests.listMine();
      expect(mine).toHaveLength(1);
      expect(mine[0]?.id).toBe(created.id);
      expect(mine[0]?.kind).toBe('promoter_group_join');
      expect(mine[0]?.status).toBe('open');
      // No anchor band/gig for this kind.
      expect(mine[0]?.anchorBand).toBeNull();
      expect(mine[0]?.anchorGig).toBeNull();
    });

    it('rejects when the target promoter group does not exist', async () => {
      const { bobId } = await seed();
      const bob = callerFor(bobId);

      await expect(
        bob.requests.create({
          kind: 'promoter_group_join',
          promoterGroupId: 999999,
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('rejects with a clear message when the requester is already a member of the group', async () => {
      const { aliceId, groupAId } = await seed();
      const alice = callerFor(aliceId);

      const thrown: unknown = await alice.requests
        .create({ kind: 'promoter_group_join', promoterGroupId: groupAId })
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
        anon.requests.create({ kind: 'promoter_group_join', promoterGroupId: 1 }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
  });

  describe('respondToPromoterGroupJoin — accept', () => {
    it('adds the requester to the promoter group, marks the request closed, and is authorised for any group member', async () => {
      const { aliceId, bobId, groupAId } = await seed();
      const bob = callerFor(bobId);
      const alice = callerFor(aliceId);

      const created = await bob.requests.create({
        kind: 'promoter_group_join',
        promoterGroupId: groupAId,
      });

      const outcome = await alice.requests.respondToPromoterGroupJoin({
        requestId: created.id,
        decision: 'accepted',
      });
      expect(outcome).toEqual({ requestId: created.id, status: 'closed' });

      // Bob now has a user_roles row with role='promoter'.
      const bobRoleRows = await db
        .select({
          id: schema.userRoles.id,
          user_id: schema.userRoles.user_id,
          role: schema.userRoles.role,
        })
        .from(schema.userRoles);
      const bobRole = bobRoleRows.find(
        (r) => r.user_id === bobId && r.role === 'promoter',
      );
      expect(bobRole).toBeDefined();

      // And a promoters_promoter_groups row linking bob's role to groupA.
      const memberships = await db
        .select({
          user_role_id: schema.promotersPromoterGroups.user_role_id,
          promoter_group_id: schema.promotersPromoterGroups.promoter_group_id,
        })
        .from(schema.promotersPromoterGroups);
      expect(memberships).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ promoter_group_id: groupAId }),
        ]),
      );
      const bobMembership = memberships.find(
        (m) => m.user_role_id === bobRole?.id && m.promoter_group_id === groupAId,
      );
      expect(bobMembership).toBeDefined();

      // Request row closed with slots_filled ticked.
      const [reqRow] = await db.select().from(schema.requests);
      expect(reqRow?.status).toBe('closed');
      expect(reqRow?.slots_filled).toBe(1);
    });

    it('reuses an existing promoter user_roles row when the requester already has one', async () => {
      const { aliceId, bobId, groupAId, groupBId } = await seed();
      const bob = callerFor(bobId);
      const alice = callerFor(aliceId);

      // Pre-seed bob with a promoter role and membership of groupB — he's
      // already a promoter but not in groupA. The accept path must reuse
      // bob's existing user_roles row, not duplicate it.
      const [bobExistingRole] = await db
        .insert(schema.userRoles)
        .values({ user_id: bobId, role: 'promoter' })
        .returning({ id: schema.userRoles.id });
      await db.insert(schema.promotersPromoterGroups).values({
        user_role_id: bobExistingRole.id,
        promoter_group_id: groupBId,
      });

      const created = await bob.requests.create({
        kind: 'promoter_group_join',
        promoterGroupId: groupAId,
      });
      await alice.requests.respondToPromoterGroupJoin({
        requestId: created.id,
        decision: 'accepted',
      });

      // Still exactly one promoter role row for bob.
      const bobPromoterRoles = await db
        .select({ id: schema.userRoles.id })
        .from(schema.userRoles)
        .where(
          and(
            eq(schema.userRoles.user_id, bobId),
            eq(schema.userRoles.role, 'promoter'),
          ),
        );
      expect(bobPromoterRoles).toHaveLength(1);
      expect(bobPromoterRoles[0]?.id).toBe(bobExistingRole.id);

      // And now two memberships for that role (groupB + groupA).
      const memberships = await db
        .select({
          user_role_id: schema.promotersPromoterGroups.user_role_id,
          promoter_group_id: schema.promotersPromoterGroups.promoter_group_id,
        })
        .from(schema.promotersPromoterGroups);
      const bobMemberships = memberships.filter(
        (m) => m.user_role_id === bobExistingRole.id,
      );
      expect(bobMemberships.map((m) => m.promoter_group_id).sort()).toEqual(
        [groupAId, groupBId].sort(),
      );
    });

    it('is idempotent wrt promoters_promoter_groups (no duplicate row) when the requester was somehow added between create and accept', async () => {
      const { aliceId, bobId, groupAId } = await seed();
      const bob = callerFor(bobId);
      const alice = callerFor(aliceId);

      const created = await bob.requests.create({
        kind: 'promoter_group_join',
        promoterGroupId: groupAId,
      });

      // Simulate a concurrent admission of bob BEFORE accept: create his
      // promoter role + membership directly.
      const [bobRole] = await db
        .insert(schema.userRoles)
        .values({ user_id: bobId, role: 'promoter' })
        .returning({ id: schema.userRoles.id });
      await db
        .insert(schema.promotersPromoterGroups)
        .values({
          user_role_id: bobRole.id,
          promoter_group_id: groupAId,
        })
        .onConflictDoNothing();

      const outcome = await alice.requests.respondToPromoterGroupJoin({
        requestId: created.id,
        decision: 'accepted',
      });
      expect(outcome.status).toBe('closed');

      // Exactly one bob membership — the unique index prevented the duplicate.
      const memberships = await db
        .select({
          user_role_id: schema.promotersPromoterGroups.user_role_id,
          promoter_group_id: schema.promotersPromoterGroups.promoter_group_id,
        })
        .from(schema.promotersPromoterGroups);
      const bobRows = memberships.filter(
        (m) => m.user_role_id === bobRole.id && m.promoter_group_id === groupAId,
      );
      expect(bobRows).toHaveLength(1);
    });

    it('rejects accept attempts from non-members of the target group', async () => {
      const { bobId, carolId, groupAId } = await seed();
      const bob = callerFor(bobId);
      const carol = callerFor(carolId);

      const created = await bob.requests.create({
        kind: 'promoter_group_join',
        promoterGroupId: groupAId,
      });

      await expect(
        carol.requests.respondToPromoterGroupJoin({
          requestId: created.id,
          decision: 'accepted',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      // And no membership was created.
      const memberships = await db
        .select({
          user_role_id: schema.promotersPromoterGroups.user_role_id,
          promoter_group_id: schema.promotersPromoterGroups.promoter_group_id,
        })
        .from(schema.promotersPromoterGroups);
      // Only alice's membership remains. No role row for bob either.
      expect(memberships).toHaveLength(1);
      const bobRoles = await db
        .select({ id: schema.userRoles.id, user_id: schema.userRoles.user_id })
        .from(schema.userRoles);
      expect(bobRoles.find((r) => r.user_id === bobId)).toBeUndefined();
    });

    it('rejects responding to a non-promoter_group_join request', async () => {
      const { aliceId, bobId } = await seed();
      const bob = callerFor(bobId);
      const alice = callerFor(aliceId);

      // Post a `band-for-musician` request — a different kind.
      const [drums] = await db
        .select({ id: schema.instruments.id })
        .from(schema.instruments)
        .where(eq(schema.instruments.name, 'Drums'))
        .limit(1);
      const otherReq = await bob.requests.create({
        kind: 'band-for-musician',
        instrumentId: drums.id,
      });

      await expect(
        alice.requests.respondToPromoterGroupJoin({
          requestId: otherReq.id,
          decision: 'accepted',
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('rejects responding twice', async () => {
      const { aliceId, bobId, groupAId } = await seed();
      const bob = callerFor(bobId);
      const alice = callerFor(aliceId);

      const created = await bob.requests.create({
        kind: 'promoter_group_join',
        promoterGroupId: groupAId,
      });
      await alice.requests.respondToPromoterGroupJoin({
        requestId: created.id,
        decision: 'accepted',
      });
      await expect(
        alice.requests.respondToPromoterGroupJoin({
          requestId: created.id,
          decision: 'accepted',
        }),
      ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    });
  });

  describe('respondToPromoterGroupJoin — reject', () => {
    it('closes the request without inserting any membership row', async () => {
      const { aliceId, bobId, groupAId } = await seed();
      const bob = callerFor(bobId);
      const alice = callerFor(aliceId);

      const created = await bob.requests.create({
        kind: 'promoter_group_join',
        promoterGroupId: groupAId,
      });

      const outcome = await alice.requests.respondToPromoterGroupJoin({
        requestId: created.id,
        decision: 'rejected',
      });
      expect(outcome).toEqual({ requestId: created.id, status: 'closed' });

      const [reqRow] = await db.select().from(schema.requests);
      expect(reqRow?.status).toBe('closed');
      // slots_filled is NOT ticked on reject — no seat was filled.
      expect(reqRow?.slots_filled).toBe(0);

      // No new role row for bob and no new membership.
      const bobRoles = await db
        .select({ user_id: schema.userRoles.user_id })
        .from(schema.userRoles);
      expect(bobRoles.find((r) => r.user_id === bobId)).toBeUndefined();

      const memberships = await db
        .select({ user_role_id: schema.promotersPromoterGroups.user_role_id })
        .from(schema.promotersPromoterGroups);
      expect(memberships).toHaveLength(1); // alice's pre-existing only.
    });
  });

  describe('cancel', () => {
    it('marks the request cancelled without touching promoter-group membership', async () => {
      const { bobId, groupAId } = await seed();
      const bob = callerFor(bobId);

      const created = await bob.requests.create({
        kind: 'promoter_group_join',
        promoterGroupId: groupAId,
      });

      const outcome = await bob.requests.cancel({ requestId: created.id });
      expect(outcome).toEqual({
        requestId: created.id,
        status: 'cancelled',
      });

      const [reqRow] = await db.select().from(schema.requests);
      expect(reqRow?.status).toBe('cancelled');

      // Bob still not a promoter, no new membership rows.
      const bobRoles = await db
        .select({ user_id: schema.userRoles.user_id })
        .from(schema.userRoles);
      expect(bobRoles.find((r) => r.user_id === bobId)).toBeUndefined();

      const memberships = await db
        .select({ user_role_id: schema.promotersPromoterGroups.user_role_id })
        .from(schema.promotersPromoterGroups);
      expect(memberships).toHaveLength(1); // alice's pre-existing only.
    });

    it('rejects cancel attempts from a user who is not the source', async () => {
      const { aliceId, bobId, groupAId } = await seed();
      const bob = callerFor(bobId);
      const alice = callerFor(aliceId);

      const created = await bob.requests.create({
        kind: 'promoter_group_join',
        promoterGroupId: groupAId,
      });

      await expect(
        alice.requests.cancel({ requestId: created.id }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('rejects cancel after the request is already closed/cancelled', async () => {
      const { aliceId, bobId, groupAId } = await seed();
      const bob = callerFor(bobId);
      const alice = callerFor(aliceId);

      const created = await bob.requests.create({
        kind: 'promoter_group_join',
        promoterGroupId: groupAId,
      });
      await alice.requests.respondToPromoterGroupJoin({
        requestId: created.id,
        decision: 'accepted',
      });
      await expect(
        bob.requests.cancel({ requestId: created.id }),
      ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    });
  });

});
