// MUS-92: integration tests for the name-first create flow's tRPC surface.
// Drives the real router against `musicians_test` using `createCallerFactory`
// — no HTTP / JWT ceremony. Skipped when the test DB isn't reachable, mirroring
// the probe-and-skip pattern in `bandJoinRouter.integration.test.ts`.
//
// Coverage per the ticket AC:
//   - `bands.create` — happy path: row inserted, `created_by_user_id` set,
//     creator inserted into `band_members`, response shape echoes memberMode.
//   - `bands.create` (solo) — same shape; memberMode echoed as 'solo'.
//   - `bands.create` — empty/whitespace name rejected.
//   - `promoterGroups.create` — happy path: row inserted, creator gets
//     `user_roles(role='promoter')` and `promoters_promoter_groups` membership.
//   - `promoterGroups.create` — promoter role grant is idempotent: a user who
//     already has the role can still create a group without duplicate-row
//     errors from the unique index.
//   - `promoterGroups.create` (solo) — memberMode echoed as 'solo'.
//   - `bands.getById` exposes `createdByUserId`.
//   - `promoterGroups.get` exposes `createdByUserId`.
//   - Unauthenticated calls rejected.

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

describe.skipIf(skip)('name-first create flow (integration)', () => {
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
        : { user: { id: String(userId), username: `user${userId}`, roles: [] } };
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

  async function insertUser(username: string): Promise<number> {
    const [row] = await db
      .insert(schema.users)
      .values({ username, password_hash: 'x', firstName: 'X', lastName: null })
      .returning({ id: schema.users.id });
    return row.id;
  }

  describe('bands.create', () => {
    it('creates the band, marks the caller as creator, and inserts the membership row', async () => {
      const aliceId = await insertUser('alice');
      const result = await callerFor(aliceId).bands.create({
        name: 'Aurora Chord',
        memberMode: 'band',
      });

      expect(result.memberMode).toBe('band');
      expect(result.id).toBeGreaterThan(0);

      const [bandRow] = await db
        .select({
          id: schema.bands.id,
          name: schema.bands.name,
          createdBy: schema.bands.created_by_user_id,
        })
        .from(schema.bands);
      expect(bandRow).toEqual({
        id: result.id,
        name: 'Aurora Chord',
        createdBy: aliceId,
      });

      const memberRows = await db.select().from(schema.bandMembers);
      expect(memberRows).toEqual([{ band_id: result.id, user_id: aliceId }]);
    });

    it('echoes memberMode=solo back to the client', async () => {
      const id = await insertUser('soloist');
      const result = await callerFor(id).bands.create({
        name: 'Solo Project',
        memberMode: 'solo',
      });
      expect(result.memberMode).toBe('solo');

      // Solo still inserts exactly one band_members row — same membership
      // shape as `band` mode. The "no add-members CTA" behaviour is mobile-
      // side gating, not a server-side membership distinction.
      const memberRows = await db.select().from(schema.bandMembers);
      expect(memberRows).toEqual([{ band_id: result.id, user_id: id }]);
    });

    it('rejects an empty / whitespace-only name', async () => {
      const id = await insertUser('alice');
      await expect(
        callerFor(id).bands.create({ name: '   ', memberMode: 'band' }),
      ).rejects.toBeInstanceOf(TRPCError);
    });

    it('rejects unauthenticated callers with UNAUTHORIZED', async () => {
      try {
        await callerFor(null).bands.create({
          name: 'Anon Band',
          memberMode: 'band',
        });
        throw new Error('expected UNAUTHORIZED');
      } catch (e) {
        expect(e).toBeInstanceOf(TRPCError);
        expect((e as TRPCError).code).toBe('UNAUTHORIZED');
      }
    });

    it('exposes createdByUserId on bands.getById', async () => {
      const aliceId = await insertUser('alice');
      const { id } = await callerFor(aliceId).bands.create({
        name: 'Reflective Band',
        memberMode: 'band',
      });

      const detail = await callerFor(aliceId).bands.getById({ id });
      expect(detail.createdByUserId).toBe(aliceId);
    });
  });

  describe('promoterGroups.create', () => {
    it('grants the promoter role, creates the group, and links membership', async () => {
      const bobId = await insertUser('bob');
      const result = await callerFor(bobId).promoterGroups.create({
        name: 'Bobs Bookings',
        memberMode: 'promoterGroup',
      });

      expect(result.memberMode).toBe('promoterGroup');

      // user_roles row exists for bob with role='promoter'
      const roleRows = await db
        .select({ id: schema.userRoles.id, role: schema.userRoles.role })
        .from(schema.userRoles);
      expect(roleRows).toHaveLength(1);
      expect(roleRows[0].role).toBe('promoter');

      // group row carries the creator
      const [groupRow] = await db
        .select({
          id: schema.promoterGroups.id,
          name: schema.promoterGroups.name,
          createdBy: schema.promoterGroups.created_by_user_id,
        })
        .from(schema.promoterGroups);
      expect(groupRow).toEqual({
        id: result.id,
        name: 'Bobs Bookings',
        createdBy: bobId,
      });

      // membership row links the role to the group
      const membershipRows = await db
        .select({
          user_role_id: schema.promotersPromoterGroups.user_role_id,
          promoter_group_id: schema.promotersPromoterGroups.promoter_group_id,
        })
        .from(schema.promotersPromoterGroups);
      expect(membershipRows).toEqual([
        { user_role_id: roleRows[0].id, promoter_group_id: result.id },
      ]);
    });

    it('is idempotent w.r.t. an existing promoter user_roles row', async () => {
      const bobId = await insertUser('bob');
      // Grant the role up front (simulating a user who already created a
      // group earlier in their session). The second create must not blow up
      // on the user_roles unique index.
      await db
        .insert(schema.userRoles)
        .values({ user_id: bobId, role: 'promoter' });

      const result = await callerFor(bobId).promoterGroups.create({
        name: 'Second Group',
        memberMode: 'promoterGroup',
      });
      expect(result.id).toBeGreaterThan(0);

      const roleRows = await db.select().from(schema.userRoles);
      // Still exactly one promoter row for bob — the upsert was a no-op.
      expect(roleRows).toHaveLength(1);
    });

    it('echoes memberMode=solo back to the client', async () => {
      const id = await insertUser('soloprom');
      const result = await callerFor(id).promoterGroups.create({
        name: 'Solo Promoter',
        memberMode: 'solo',
      });
      expect(result.memberMode).toBe('solo');
    });

    it('rejects an empty name', async () => {
      const id = await insertUser('bob');
      await expect(
        callerFor(id).promoterGroups.create({
          name: '',
          memberMode: 'promoterGroup',
        }),
      ).rejects.toBeInstanceOf(TRPCError);
    });

    it('rejects unauthenticated callers with UNAUTHORIZED', async () => {
      try {
        await callerFor(null).promoterGroups.create({
          name: 'Anon Group',
          memberMode: 'promoterGroup',
        });
        throw new Error('expected UNAUTHORIZED');
      } catch (e) {
        expect(e).toBeInstanceOf(TRPCError);
        expect((e as TRPCError).code).toBe('UNAUTHORIZED');
      }
    });

    it('exposes createdByUserId on promoterGroups.get', async () => {
      const bobId = await insertUser('bob');
      const { id } = await callerFor(bobId).promoterGroups.create({
        name: 'Reflective Group',
        memberMode: 'promoterGroup',
      });

      const detail = await callerFor(bobId).promoterGroups.get({ id });
      expect(detail.createdByUserId).toBe(bobId);
    });
  });
});
