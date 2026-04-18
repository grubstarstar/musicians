import { asc, eq } from 'drizzle-orm';
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
