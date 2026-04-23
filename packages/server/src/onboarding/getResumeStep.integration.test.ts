// MUS-94 integration test: `onboarding.getResumeStep` end-to-end against a
// real Postgres. Covers each of the four resume states the AC enumerates, plus
// the MUS-95 cross-role interpretation (any step-2 complete === done).
//
// Pattern mirrors `onboarding/router.integration.test.ts` — skipped when the
// test DB isn't reachable so devs without `pnpm e2e:db-setup` still see a
// green `pnpm test`.
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

describe.skipIf(skip)('onboarding.getResumeStep (integration)', () => {
  let originalDatabaseUrl: string | undefined;
  let originalNodeEnv: string | undefined;
  let db: typeof import('../db.js')['db'];
  let schema: typeof import('../schema.js');
  let appRouter: typeof import('../trpc/router.js')['appRouter'];
  let createCallerFactory: typeof import('../trpc/trpc.js')['createCallerFactory'];

  function callerFor(userId: number, roles: string[]) {
    const factory = createCallerFactory(appRouter);
    return factory({
      user: { id: String(userId), username: `user${userId}`, roles },
    });
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
          "musician_profiles",
          "promoters_promoter_groups",
          "promoter_groups_venues",
          "promoter_groups",
          "user_roles",
          "band_members",
          "band_tracks",
          "bands",
          "users"
        RESTART IDENTITY CASCADE
      `),
    );
  });

  async function insertUser(
    username: string,
    roles: string[] = [],
  ): Promise<number> {
    const [row] = await db
      .insert(schema.users)
      .values({ username, password_hash: 'x', roles })
      .returning({ id: schema.users.id });
    return row.id;
  }

  it('returns role-picker when roles is empty', async () => {
    const id = await insertUser('fresh');
    const step = await callerFor(id, []).onboarding.getResumeStep();
    expect(step).toBe('role-picker');
  });

  it('returns musician when the user has the musician role but no step-2 evidence', async () => {
    const id = await insertUser('unmus', ['musician']);
    const step = await callerFor(id, ['musician']).onboarding.getResumeStep();
    expect(step).toBe('musician');
  });

  it('returns promoter when the user has the promoter role but no step-2 evidence', async () => {
    const id = await insertUser('unprom', ['promoter']);
    const step = await callerFor(id, ['promoter']).onboarding.getResumeStep();
    expect(step).toBe('promoter');
  });

  it('returns complete when the musician has a band_members row', async () => {
    const id = await insertUser('bandmus', ['musician']);
    const [band] = await db
      .insert(schema.bands)
      .values({ name: 'Test Band' })
      .returning({ id: schema.bands.id });
    await db
      .insert(schema.bandMembers)
      .values({ band_id: band.id, user_id: id });

    const step = await callerFor(id, ['musician']).onboarding.getResumeStep();
    expect(step).toBe('complete');
  });

  it('returns complete when the musician has available_for_session_work=true', async () => {
    const id = await insertUser('seshmus', ['musician']);
    await db
      .insert(schema.musicianProfiles)
      .values({ user_id: id, available_for_session_work: true });

    const step = await callerFor(id, ['musician']).onboarding.getResumeStep();
    expect(step).toBe('complete');
  });

  it('returns musician (not complete) when the musician profile has available_for_session_work=false', async () => {
    // A session-musician row exists but the user toggled the opt-in off —
    // that is NOT a completed step-2 route per the AC.
    const id = await insertUser('mus', ['musician']);
    await db
      .insert(schema.musicianProfiles)
      .values({ user_id: id, available_for_session_work: false });

    const step = await callerFor(id, ['musician']).onboarding.getResumeStep();
    expect(step).toBe('musician');
  });

  it('returns complete when the musician has a pending band_join request', async () => {
    const id = await insertUser('pendmus', ['musician']);
    const [band] = await db
      .insert(schema.bands)
      .values({ name: 'Another Band' })
      .returning({ id: schema.bands.id });
    await db.insert(schema.requests).values({
      kind: 'band_join',
      source_user_id: id,
      anchor_band_id: band.id,
      details: { kind: 'band_join', bandId: band.id },
      status: 'open',
    });

    const step = await callerFor(id, ['musician']).onboarding.getResumeStep();
    expect(step).toBe('complete');
  });

  it('returns musician when a band_join request is closed (not open)', async () => {
    // Closed/cancelled requests don't count as step-2 completion because the
    // user has no active route in-flight. They would need a new membership or
    // pending request to be considered done.
    const id = await insertUser('closedmus', ['musician']);
    const [band] = await db
      .insert(schema.bands)
      .values({ name: 'Closed Band' })
      .returning({ id: schema.bands.id });
    await db.insert(schema.requests).values({
      kind: 'band_join',
      source_user_id: id,
      anchor_band_id: band.id,
      details: { kind: 'band_join', bandId: band.id },
      status: 'closed',
    });

    const step = await callerFor(id, ['musician']).onboarding.getResumeStep();
    expect(step).toBe('musician');
  });

  it('returns complete when the promoter has a promoters_promoter_groups membership', async () => {
    const id = await insertUser('promgroup', ['promoter']);
    const [role] = await db
      .insert(schema.userRoles)
      .values({ user_id: id, role: 'promoter' })
      .returning({ id: schema.userRoles.id });
    const [group] = await db
      .insert(schema.promoterGroups)
      .values({ name: 'Test Group' })
      .returning({ id: schema.promoterGroups.id });
    await db.insert(schema.promotersPromoterGroups).values({
      user_role_id: role.id,
      promoter_group_id: group.id,
    });

    const step = await callerFor(id, ['promoter']).onboarding.getResumeStep();
    expect(step).toBe('complete');
  });

  it('returns complete when the promoter has a pending promoter_group_join request', async () => {
    const id = await insertUser('pendprom', ['promoter']);
    const [group] = await db
      .insert(schema.promoterGroups)
      .values({ name: 'Join Target Group' })
      .returning({ id: schema.promoterGroups.id });
    await db.insert(schema.requests).values({
      kind: 'promoter_group_join',
      source_user_id: id,
      details: { kind: 'promoter_group_join', promoterGroupId: group.id },
      status: 'open',
    });

    const step = await callerFor(id, ['promoter']).onboarding.getResumeStep();
    expect(step).toBe('complete');
  });

  it('returns complete when the user has both roles and musician step-2 is done (MUS-95 cross-role)', async () => {
    // The ticket's interpretation guidance: a user with two roles and only
    // one step-2 route complete is NOT re-gated. This locks in the rule so
    // MUS-95's add-role-from-settings path doesn't trip the gate.
    const id = await insertUser('multi', ['musician', 'promoter']);
    const [band] = await db
      .insert(schema.bands)
      .values({ name: 'Multi Band' })
      .returning({ id: schema.bands.id });
    await db
      .insert(schema.bandMembers)
      .values({ band_id: band.id, user_id: id });

    const step = await callerFor(
      id,
      ['musician', 'promoter'],
    ).onboarding.getResumeStep();
    expect(step).toBe('complete');
  });

  it('reads roles from the DB, not the ctx snapshot (stale JWT tolerance)', async () => {
    // If a user adds a role via another client after issuing their JWT, the
    // ctx snapshot is stale (still empty). The DB read in getOnboardingEvidence
    // must override so the next getResumeStep sees the fresh roles.
    const id = await insertUser('stalejwt', ['musician']);
    // Caller sees ctx.user.roles = [] (stale)...
    const step = await callerFor(id, []).onboarding.getResumeStep();
    // ...but the DB read returns the fresh musician role, so the resume
    // step is 'musician', not 'role-picker'.
    expect(step).toBe('musician');
  });

  it('rejects unauthenticated callers with UNAUTHORIZED', async () => {
    const factory = createCallerFactory(appRouter);
    const caller = factory({ user: null });
    await expect(caller.onboarding.getResumeStep()).rejects.toThrow();
  });
});
