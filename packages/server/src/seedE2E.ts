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
 *   - `onboarding` (MUS-91):
 *       user `newbie` (`abcd1234`) with `roles: []`
 *       Represents a freshly-signed-up user who has not yet completed the
 *       onboarding wizard. The auth guard in (app)/_layout.tsx redirects
 *       `roles.length === 0` users to /onboarding/role-picker — flow 04
 *       exercises that path by logging in as newbie after a DB reset.
 *
 * Designed to be called from inside the `/test/reset` server endpoint after
 * truncation so each Maestro run starts from the same state. No I/O cleanup
 * here — the caller manages the DB connection lifetime.
 */
export async function seedE2E(): Promise<void> {
  const passwordHash = await bcrypt.hash('password123', 12);
  // newbie uses a different password (abcd1234) to match the onboarding journey
  // flows (MUS-91) which log in with those credentials after signup/reset.
  const newbiePasswordHash = await bcrypt.hash('abcd1234', 12);

  // users.roles (MUS-86) is the snapshot MUS-89's (app)/_layout.tsx guard
  // reads to decide whether to route a cold-launched authenticated user to
  // the onboarding wizard or to Home. All seedE2E users are post-onboarding
  // fixtures, so they carry the appropriate role already — without this,
  // every Maestro flow that logs in as a seeded user gets bounced to the
  // role-picker on cold launch.
  const [gigtar] = await db
    .insert(users)
    .values({
      username: 'gigtar',
      password_hash: passwordHash,
      firstName: 'Gigtar',
      lastName: null,
      roles: ['musician'],
    })
    .returning({ id: users.id });

  const [sesh] = await db
    .insert(users)
    .values({
      username: 'sesh',
      password_hash: passwordHash,
      firstName: 'Sesh',
      lastName: null,
      roles: ['musician'],
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
      roles: ['promoter'],
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

  // --- onboarding fixture (MUS-91) ---
  //
  // Flow 04 of the onboarding journey logs in as a user who has completed
  // signup but has not yet selected a role (roles=[]). The auth guard in
  // (app)/_layout.tsx redirects such users to /onboarding/role-picker.
  //
  // Password is "abcd1234" (distinct from password123) matching the
  // credentials used by the onboarding journey flows after a DB reset.
  // roles=[] is the sentinel the auth guard checks — do not add a role here.
  await db.insert(users).values({
    username: 'newbie',
    password_hash: newbiePasswordHash,
    firstName: null,
    lastName: null,
    roles: [],
  });
}
