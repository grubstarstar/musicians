// Integration test for the e2e test-reset endpoint (MUS-71). Skipped unless
// the test DB is running, so it's safe to leave in `pnpm test` — local devs
// without `pnpm e2e:db-setup` having been run won't see a failure.
//
// Verifies the contract the Maestro flows depend on:
//   - POST /test/reset returns 200
//   - the test DB ends up with the seedE2E fixture (MUS-97 added the
//     promoter-home slice: `promoter1`, promoter group "Test Promotions",
//     venue "Test Hall", plus the request-to-join slice: `gigtar`, `sesh`,
//     band "The Testers").
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_DB_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/musicians_test';

// Probe the test DB. If it doesn't exist (or postgres isn't running), skip
// the suite — this test is a *bonus* check; the unit suite still passes.
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

describe.skipIf(skip)('POST /test/reset (integration)', () => {
  let originalDatabaseUrl: string | undefined;
  let originalNodeEnv: string | undefined;
  let app: { fetch: (req: Request) => Promise<Response> };

  beforeAll(async () => {
    originalDatabaseUrl = process.env.DATABASE_URL;
    originalNodeEnv = process.env.NODE_ENV;
    process.env.DATABASE_URL = TEST_DB_URL;
    process.env.NODE_ENV = 'test';

    // Import after env is set so the singleton DB client connects to the test DB.
    const { Hono } = await import('hono');
    const testRoutes = (await import('./testRoutes.js')).default;
    const built = new Hono();
    built.route('/test', testRoutes);
    app = built;
  });

  afterAll(async () => {
    process.env.DATABASE_URL = originalDatabaseUrl;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('truncates and reseeds to the seedE2E fixture', async () => {
    const res = await app.fetch(
      new Request('http://localhost/test/reset', { method: 'POST' }),
    );
    expect(res.status).toBe(200);

    // Cross-check directly against the DB.
    const { db } = await import('../db.js');
    const {
      bandMembers,
      bands,
      promoterGroups,
      promoterGroupsVenues,
      promotersPromoterGroups,
      userRoles,
      users,
      venues,
    } = await import('../schema.js');
    const allUsers = await db.select({ username: users.username }).from(users);
    const allBands = await db.select({ name: bands.name }).from(bands);
    const memberships = await db
      .select({ band_id: bandMembers.band_id, user_id: bandMembers.user_id })
      .from(bandMembers);
    const allPromoterGroups = await db
      .select({ name: promoterGroups.name })
      .from(promoterGroups);
    const allVenues = await db.select({ name: venues.name }).from(venues);
    const allRoles = await db
      .select({ role: userRoles.role })
      .from(userRoles);
    const allPromoterLinks = await db
      .select({ id: promotersPromoterGroups.id })
      .from(promotersPromoterGroups);
    const allPromoterGroupVenueLinks = await db
      .select({ id: promoterGroupsVenues.id })
      .from(promoterGroupsVenues);

    expect(allUsers.map((u) => u.username).sort()).toEqual([
      'gigtar',
      'promoter1',
      'sesh',
    ]);
    expect(allBands.map((b) => b.name)).toEqual(['The Testers']);
    // Only gigtar is in a band (sesh is intentionally bandless; promoter1 is
    // a promoter and also not in any band).
    expect(memberships).toHaveLength(1);
    expect(allPromoterGroups.map((g) => g.name)).toEqual(['Test Promotions']);
    expect(allVenues.map((v) => v.name)).toEqual(['Test Hall']);
    expect(allRoles.map((r) => r.role)).toEqual(['promoter']);
    expect(allPromoterLinks).toHaveLength(1);
    expect(allPromoterGroupVenueLinks).toHaveLength(1);
  });

  it('is idempotent — second reset still leaves the same fixture', async () => {
    const first = await app.fetch(
      new Request('http://localhost/test/reset', { method: 'POST' }),
    );
    expect(first.status).toBe(200);
    const second = await app.fetch(
      new Request('http://localhost/test/reset', { method: 'POST' }),
    );
    expect(second.status).toBe(200);

    const { db } = await import('../db.js');
    const { users } = await import('../schema.js');
    const allUsers = await db.select({ username: users.username }).from(users);
    expect(allUsers.map((u) => u.username).sort()).toEqual([
      'gigtar',
      'promoter1',
      'sesh',
    ]);
  });
});
