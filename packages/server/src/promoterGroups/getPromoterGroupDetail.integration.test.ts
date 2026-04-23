// Integration test for `promoterGroups.get` (MUS-100). Skipped unless the
// test DB is up, matching the convention in `testRoutes.integration.test.ts`.
//
// Verifies two branches:
//   - Golden path: a member of the group gets `{ id, name, venues, members }`.
//   - NOT_FOUND: a non-member (authenticated, but not in `promoters_promoter_groups`
//     for this group) gets a NOT_FOUND TRPCError — *not* FORBIDDEN — so that
//     membership cannot be fingerprinted from the error code.
//
// We intentionally exercise the router via `appRouter.createCaller` rather
// than the pure query function so the membership/auth gating on the procedure
// itself is covered end-to-end.
import bcrypt from 'bcrypt';
import { sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

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

describe.skipIf(skip)('promoterGroups.get (integration)', () => {
  let originalDatabaseUrl: string | undefined;

  beforeAll(() => {
    originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = TEST_DB_URL;
  });

  afterAll(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  // Each test starts from a known-empty slate. We truncate the same set of
  // tables the /test/reset endpoint covers so any fixture leaked in by another
  // suite doesn't pollute membership queries. We also truncate in afterEach so
  // we never leave rows behind for a concurrent suite (e.g.
  // testRoutes.integration.test.ts) to trip over.
  async function truncateAll(): Promise<void> {
    const { db } = await import('../db.js');
    await db.execute(
      sql.raw(
        `TRUNCATE TABLE
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
         RESTART IDENTITY CASCADE`,
      ),
    );
  }

  beforeEach(truncateAll);
  afterEach(truncateAll);

  it('returns the group with venues and members for a member caller', async () => {
    const {
      memberId,
      groupId,
      venueId,
    } = await seedMembershipFixture({ secondMember: false });

    const { appRouter } = await import('../trpc/router.js');
    const caller = appRouter.createCaller({
      user: { id: String(memberId), username: 'member' },
    });

    const detail = await caller.promoterGroups.get({ id: groupId });

    expect(detail).toEqual({
      id: groupId,
      name: 'Test Promotions',
      // MUS-92: this fixture inserts the promoter group via raw `db.insert`
      // without setting `created_by_user_id`, so the column defaults to
      // null. The dedicated `createPromoterGroupWithCreator` path (covered
      // by the create-flow integration tests) populates it.
      createdByUserId: null,
      venues: [{ id: venueId, name: 'Test Hall', address: '1 Test Lane' }],
      members: [
        {
          userId: memberId,
          username: 'member',
          firstName: 'Member',
          lastName: null,
        },
      ],
    });
  });

  it('includes all members (sorted by username) when a group has more than one', async () => {
    const fixture = await seedMembershipFixture({ secondMember: true });

    const { appRouter } = await import('../trpc/router.js');
    const caller = appRouter.createCaller({
      user: { id: String(fixture.memberId), username: 'member' },
    });

    const detail = await caller.promoterGroups.get({ id: fixture.groupId });

    // `member` and `zmember` — sorted ascending by username.
    expect(detail.members.map((m) => m.username)).toEqual(['member', 'zmember']);
    expect(detail.members).toEqual([
      {
        userId: fixture.memberId,
        username: 'member',
        firstName: 'Member',
        lastName: null,
      },
      {
        userId: fixture.secondMemberId,
        username: 'zmember',
        firstName: null,
        lastName: null,
      },
    ]);
  });

  it('throws NOT_FOUND when the caller is not a member of the group', async () => {
    const { groupId, outsiderId } = await seedMembershipFixture({
      secondMember: false,
      withOutsider: true,
    });

    const { appRouter } = await import('../trpc/router.js');
    const caller = appRouter.createCaller({
      user: { id: String(outsiderId), username: 'outsider' },
    });

    await expect(caller.promoterGroups.get({ id: groupId })).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    );
  });

  it('throws NOT_FOUND when the group id does not exist', async () => {
    const { memberId } = await seedMembershipFixture({ secondMember: false });

    const { appRouter } = await import('../trpc/router.js');
    const caller = appRouter.createCaller({
      user: { id: String(memberId), username: 'member' },
    });

    await expect(caller.promoterGroups.get({ id: 999_999 })).rejects.toBeInstanceOf(
      TRPCError,
    );
    await expect(
      caller.promoterGroups.get({ id: 999_999 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

interface SeededFixture {
  memberId: number;
  secondMemberId: number | null;
  outsiderId: number | null;
  groupId: number;
  venueId: number;
}

async function seedMembershipFixture(opts: {
  secondMember: boolean;
  withOutsider?: boolean;
}): Promise<SeededFixture> {
  const { db } = await import('../db.js');
  const {
    promoterGroups,
    promoterGroupsVenues,
    promotersPromoterGroups,
    userRoles,
    users,
    venues,
  } = await import('../schema.js');
  const passwordHash = await bcrypt.hash('test', 4);

  const [member] = await db
    .insert(users)
    .values({
      username: 'member',
      password_hash: passwordHash,
      firstName: 'Member',
      lastName: null,
    })
    .returning({ id: users.id });

  const [memberRole] = await db
    .insert(userRoles)
    .values({ user_id: member.id, role: 'promoter' })
    .returning({ id: userRoles.id });

  const [group] = await db
    .insert(promoterGroups)
    .values({ name: 'Test Promotions' })
    .returning({ id: promoterGroups.id });

  const [venue] = await db
    .insert(venues)
    .values({ name: 'Test Hall', address: '1 Test Lane' })
    .returning({ id: venues.id });

  await db.insert(promotersPromoterGroups).values({
    user_role_id: memberRole.id,
    promoter_group_id: group.id,
  });

  await db.insert(promoterGroupsVenues).values({
    promoter_group_id: group.id,
    venue_id: venue.id,
  });

  let secondMemberId: number | null = null;
  if (opts.secondMember) {
    const [second] = await db
      .insert(users)
      .values({
        username: 'zmember',
        password_hash: passwordHash,
        firstName: null,
        lastName: null,
      })
      .returning({ id: users.id });
    const [secondRole] = await db
      .insert(userRoles)
      .values({ user_id: second.id, role: 'promoter' })
      .returning({ id: userRoles.id });
    await db.insert(promotersPromoterGroups).values({
      user_role_id: secondRole.id,
      promoter_group_id: group.id,
    });
    secondMemberId = second.id;
  }

  let outsiderId: number | null = null;
  if (opts.withOutsider) {
    // An authenticated user who happens to have a promoter role but is not
    // linked to this group. Surfaces any accidental "any promoter can see any
    // group" bug — we want NOT_FOUND here, not a leaked detail response.
    const [outsider] = await db
      .insert(users)
      .values({
        username: 'outsider',
        password_hash: passwordHash,
        firstName: null,
        lastName: null,
      })
      .returning({ id: users.id });
    await db
      .insert(userRoles)
      .values({ user_id: outsider.id, role: 'promoter' })
      .returning({ id: userRoles.id });
    outsiderId = outsider.id;
  }

  return {
    memberId: member.id,
    secondMemberId,
    outsiderId,
    groupId: group.id,
    venueId: venue.id,
  };
}
