import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from './db.js';
import { bandMembers, bands, users } from './schema.js';

/**
 * Minimal deterministic seed for the e2e test database (MUS-71). This is the
 * smallest fixture the `request-to-join` Maestro flow needs:
 *
 *   - two users `gigtar` and `sesh` (both `password123`)
 *   - one band `The Testers`, owned by `gigtar`
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
}
