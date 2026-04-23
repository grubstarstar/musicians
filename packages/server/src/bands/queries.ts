import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '../db.js';
import type { CreateEntityResult } from '../onboarding/createEntityResult.js';
import { bandMembers, bandTracks, bands, users } from '../schema.js';
import type { BandProfile, BandWithMembers } from '../schema.js';

export async function listBands(): Promise<BandWithMembers[]> {
  // Explicit projection — see `BandWithMembers` for why `created_by_user_id`
  // is intentionally omitted from the list response (it's a profile-screen
  // concern, not a discovery-list concern).
  const allBands = await db
    .select({
      id: bands.id,
      name: bands.name,
      imageUrl: bands.imageUrl,
    })
    .from(bands)
    .orderBy(asc(bands.name));

  const allMembers = await db
    .select({
      band_id: bandMembers.band_id,
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(bandMembers)
    .innerJoin(users, eq(users.id, bandMembers.user_id));

  return allBands.map((band) => ({
    ...band,
    members: allMembers
      .filter((m) => m.band_id === band.id)
      .map(({ id, username, firstName, lastName }) => ({
        id,
        username,
        firstName,
        lastName,
      })),
  }));
}

/**
 * Lists bands the given user is a member of, alphabetised by name.
 *
 * Mirrors the DTO shape of `listBands` so mobile consumers (e.g. Home's
 * "Your bands" row) can swap `bands.list` for `bands.listMine` with no
 * downstream changes. Two round trips: one to resolve the caller's band ids
 * + base band rows via an inner join on `band_members`, and a second batched
 * fetch for every member of those bands so we can render the full member
 * list (not just the caller).
 */
export async function listMyBands(userId: number): Promise<BandWithMembers[]> {
  const myBands = await db
    .select({
      id: bands.id,
      name: bands.name,
      imageUrl: bands.imageUrl,
    })
    .from(bands)
    .innerJoin(bandMembers, eq(bandMembers.band_id, bands.id))
    .where(eq(bandMembers.user_id, userId))
    .orderBy(asc(bands.name));

  if (myBands.length === 0) return [];

  const bandIds = myBands.map((b) => b.id);

  const membersOfMyBands = await db
    .select({
      band_id: bandMembers.band_id,
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(bandMembers)
    .innerJoin(users, eq(users.id, bandMembers.user_id))
    .where(inArray(bandMembers.band_id, bandIds));

  return myBands.map((band) => ({
    ...band,
    members: membersOfMyBands
      .filter((m) => m.band_id === band.id)
      .map(({ id, username, firstName, lastName }) => ({
        id,
        username,
        firstName,
        lastName,
      })),
  }));
}

/**
 * Creates a band with the caller as the first (and, in `solo` mode, only)
 * member. Used by the MUS-92 name-first create flow from the onboarding
 * wizard. The band row records `created_by_user_id` so the profile screen
 * can gate the "Add members" CTA to the creator only.
 *
 * Wrapped in a transaction so a partial failure (band inserted but
 * `band_members` row missing) cannot land — the caller would otherwise see
 * a band they can't view (membership-gated reads).
 */
export async function createBandWithCreator(
  input: { name: string },
  creatorUserId: number,
): Promise<CreateEntityResult> {
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(bands)
      .values({ name: input.name, created_by_user_id: creatorUserId })
      .returning({ id: bands.id });
    await tx.insert(bandMembers).values({
      band_id: inserted.id,
      user_id: creatorUserId,
    });
    // memberMode is supplied by the procedure so this helper stays pure
    // about the entity shape; the caller decides band vs solo. We return it
    // here only so the procedure result contains everything the mobile
    // post-create router needs in one round trip.
    return { id: inserted.id, memberMode: 'band' };
  });
}

export async function getBandProfile(id: number): Promise<BandProfile | null> {
  // Explicit projection (per the CLAUDE.md tRPC convention): the snake_case
  // `created_by_user_id` column maps to camelCase `createdByUserId` on the
  // returned shape so mobile sees a stable client-friendly DTO.
  const [band] = await db
    .select({
      id: bands.id,
      name: bands.name,
      imageUrl: bands.imageUrl,
      createdByUserId: bands.created_by_user_id,
    })
    .from(bands)
    .where(eq(bands.id, id));
  if (!band) return null;

  const members = await db
    .select({
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(bandMembers)
    .innerJoin(users, eq(users.id, bandMembers.user_id))
    .where(eq(bandMembers.band_id, id));

  const tracks = await db
    .select({
      id: bandTracks.id,
      title: bandTracks.title,
      url: bandTracks.url,
      position: bandTracks.position,
    })
    .from(bandTracks)
    .where(eq(bandTracks.band_id, id))
    .orderBy(asc(bandTracks.position));

  return { ...band, members, tracks };
}
