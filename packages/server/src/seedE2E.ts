import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from './db.js';
import {
  bandMembers,
  bands,
  promoterGroups,
  promoterGroupsVenues,
  promotersPromoterGroups,
  userRoles,
  users,
  venues,
} from './schema.js';

/**
 * Minimal deterministic seed for the e2e test database (MUS-71). Each Maestro
 * journey contributes the fixture it needs, kept piecewise so the seed stays
 * small and each journey owns its slice:
 *
 *   - `request-to-join` (MUS-71):
 *       users `gigtar` and `sesh` (both `password123`)
 *       band `The Testers`, owned by `gigtar`
 *
 *   - `promoter-home` (MUS-97):
 *       user `promoter1` (`password123`) with the `promoter` role
 *       promoter group `Test Promotions`
 *       venue `Test Hall` (address `1 Test Lane, Testville VIC 3000`)
 *       `promoter1` linked to `Test Promotions`; `Test Promotions` linked to
 *       `Test Hall` — so `promoterGroups.listMine` returns one group with one
 *       venue for `promoter1`.
 *
 * Designed to be called from inside the `/test/reset` server endpoint after
 * truncation so each Maestro run starts from the same state. No I/O cleanup
 * here — the caller manages the DB connection lifetime.
 */
export async function seedE2E(): Promise<void> {
  const passwordHash = await bcrypt.hash('password123', 12);

  const [gigtar] = await db
    .insert(users)
    .values({
      username: 'gigtar',
      password_hash: passwordHash,
      firstName: 'Gigtar',
      lastName: null,
    })
    .returning({ id: users.id });

  const [sesh] = await db
    .insert(users)
    .values({
      username: 'sesh',
      password_hash: passwordHash,
      firstName: 'Sesh',
      lastName: null,
    })
    .returning({ id: users.id });

  // The Testers — owned by gigtar via a single band_members row. Membership is
  // sufficient ownership for the request-to-join flow, since `isMemberOfBand`
  // is the gate the server uses for `requests.create({kind:'musician-for-band'})`.
  const [theTesters] = await db
    .insert(bands)
    .values({
      name: 'The Testers',
      imageUrl: null,
    })
    .returning({ id: bands.id });

  await db.insert(bandMembers).values({
    band_id: theTesters.id,
    user_id: gigtar.id,
  });

  // Sanity: avoid accidental sesh-membership leaks if this file is later
  // edited carelessly. Lookup is cheap and acts as a self-test.
  const [seshMembership] = await db
    .select({ band_id: bandMembers.band_id })
    .from(bandMembers)
    .where(eq(bandMembers.user_id, sesh.id));
  if (seshMembership) {
    throw new Error('seedE2E invariant violated: sesh should not be in any band');
  }

  // --- promoter-home fixture (MUS-97) ---
  //
  // The `promoter-home` Maestro journey logs in as a promoter, switches
  // context to "Promoter", and asserts that one promoter group (with one
  // linked venue) is visible on the PromoterHome screen. That needs:
  //   users → user_roles (role='promoter')
  //     → promoters_promoter_groups → promoter_groups
  //     → promoter_groups_venues → venues
  // All five rows are inserted here so `/test/reset` reseeds them
  // automatically between runs.
  //
  // `firstName: null` keeps the login welcome heading rendering the
  // username (`Hello promoter1`), matching the gigtar/sesh convention.
  const [promoter1] = await db
    .insert(users)
    .values({
      username: 'promoter1',
      password_hash: passwordHash,
      firstName: null,
      lastName: null,
    })
    .returning({ id: users.id });

  const [promoter1Role] = await db
    .insert(userRoles)
    .values({ user_id: promoter1.id, role: 'promoter' })
    .returning({ id: userRoles.id });

  const [testPromotions] = await db
    .insert(promoterGroups)
    .values({ name: 'Test Promotions' })
    .returning({ id: promoterGroups.id });

  const [testHall] = await db
    .insert(venues)
    .values({ name: 'Test Hall', address: '1 Test Lane, Testville VIC 3000' })
    .returning({ id: venues.id });

  await db.insert(promotersPromoterGroups).values({
    user_role_id: promoter1Role.id,
    promoter_group_id: testPromotions.id,
  });

  await db.insert(promoterGroupsVenues).values({
    promoter_group_id: testPromotions.id,
    venue_id: testHall.id,
  });
}
