import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '../db.js';
import { bandMembers, bandTracks, bands, users } from '../schema.js';
import type { BandProfile, BandWithMembers } from '../schema.js';

export async function listBands(): Promise<BandWithMembers[]> {
  const allBands = await db.select().from(bands).orderBy(asc(bands.name));

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

export async function getBandProfile(id: number): Promise<BandProfile | null> {
  const [band] = await db.select().from(bands).where(eq(bands.id, id));
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
