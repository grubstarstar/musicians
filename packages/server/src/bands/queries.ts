import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '../db.js';
import type { CreateEntityResult } from '../onboarding/createEntityResult.js';
import {
  bandGenres,
  bandMembers,
  bandTracks,
  bands,
  genres,
  users,
} from '../schema.js';
import type { BandProfile, BandWithMembers } from '../schema.js';

// MUS-103: shaped genre summary attached to band DTOs. Explicit projection
// (id/slug/name only) — `sort_order` and `created_at` stay server-side.
export interface BandGenreSummary {
  id: number;
  slug: string;
  name: string;
}

// Loads the `{id, slug, name}[]` genre list for a given set of band ids in a
// single query (avoids N+1). Returned as a Map<bandId, genres[]> so callers
// can join back to each band cheaply. Genres per band are sorted by
// `genres.sort_order` so UI listings are deterministic without client-side
// sorting.
async function loadGenresByBandIds(
  bandIds: number[],
): Promise<Map<number, BandGenreSummary[]>> {
  const result = new Map<number, BandGenreSummary[]>();
  if (bandIds.length === 0) return result;
  const rows = await db
    .select({
      bandId: bandGenres.band_id,
      id: genres.id,
      slug: genres.slug,
      name: genres.name,
      sortOrder: genres.sort_order,
    })
    .from(bandGenres)
    .innerJoin(genres, eq(genres.id, bandGenres.genre_id))
    .where(inArray(bandGenres.band_id, bandIds))
    .orderBy(asc(genres.sort_order), asc(genres.name));
  for (const r of rows) {
    const list = result.get(r.bandId) ?? [];
    list.push({ id: r.id, slug: r.slug, name: r.name });
    result.set(r.bandId, list);
  }
  return result;
}

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

  // MUS-103: fetch genres in one batched query rather than per-band.
  const genresByBandId = await loadGenresByBandIds(allBands.map((b) => b.id));

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
    genres: genresByBandId.get(band.id) ?? [],
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

  // MUS-103: one batched fetch for all bands the caller belongs to — avoids
  // N+1 per band.
  const genresByBandId = await loadGenresByBandIds(bandIds);

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
    genres: genresByBandId.get(band.id) ?? [],
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

  // MUS-103: per-band genre list. Single band, so no Map gymnastics needed.
  const bandGenreRows = await db
    .select({
      id: genres.id,
      slug: genres.slug,
      name: genres.name,
    })
    .from(bandGenres)
    .innerJoin(genres, eq(genres.id, bandGenres.genre_id))
    .where(eq(bandGenres.band_id, id))
    .orderBy(asc(genres.sort_order), asc(genres.name));

  return { ...band, members, tracks, genres: bandGenreRows };
}
