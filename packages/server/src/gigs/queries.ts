import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db.js';
import { genres, gigSlots, gigs, userRoles, venues } from '../schema.js';
import type { GigStatus } from '../schema.js';

/**
 * Checks whether a user holds the `promoter` role. Used to gate gig-organiser
 * actions (creating gigs, posting `band-for-gig-slot` requests). Returns
 * `true` iff a `user_roles` row exists for this user with role = 'promoter'.
 */
export async function hasPromoterRole(userId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: userRoles.id })
    .from(userRoles)
    .where(and(eq(userRoles.user_id, userId), eq(userRoles.role, 'promoter')))
    .limit(1);
  return !!row;
}

// Shaped (camelCase, no raw row leaks) return type for a gig plus its slots.
// Slots are always returned in `set_order` ascending order so the lineup
// renders consistently on the client without extra sorting.
//
// MUS-103: `genre` is the slot-level genre requirement, resolved to a
// `{ id, slug, name }` shape or null when no filter is set. Clients use this
// to render per-slot constraints and to decide whether to gate the
// band-for-gig-slot CTA.
export interface ShapedGigSlot {
  id: number;
  setOrder: number;
  fee: number | null;
  bandId: number | null;
  genre: { id: number; slug: string; name: string } | null;
}

export interface ShapedGig {
  id: number;
  datetime: Date;
  venueId: number;
  doors: string | null;
  status: GigStatus;
  organiserUserId: number;
  slots: ShapedGigSlot[];
}

export interface ShapedGigSummary {
  id: number;
  datetime: Date;
  venue: { id: number; name: string };
  doors: string | null;
  status: GigStatus;
  totalSlots: number;
  openSlots: number;
}

export interface CreateGigInput {
  datetime: Date;
  venueId: number;
  doors?: string;
  slots: { setOrder: number; fee?: number }[];
}

/**
 * Creates a gig row plus one `gig_slots` row per entry in `input.slots`.
 *
 * All slots start with `band_id = null` (open). Runs inside a transaction so
 * the gig + slots insert atomically — if a slot insert fails (e.g. duplicate
 * `set_order`), the gig row is rolled back rather than left orphaned.
 */
export async function createGig(
  input: CreateGigInput,
  organiserUserId: number,
): Promise<ShapedGig> {
  return db.transaction(async (tx) => {
    const [gig] = await tx
      .insert(gigs)
      .values({
        datetime: input.datetime,
        venue_id: input.venueId,
        doors: input.doors ?? null,
        organiser_user_id: organiserUserId,
      })
      .returning({
        id: gigs.id,
        datetime: gigs.datetime,
        venueId: gigs.venue_id,
        doors: gigs.doors,
        status: gigs.status,
        organiserUserId: gigs.organiser_user_id,
      });

    const slotRows =
      input.slots.length === 0
        ? []
        : await tx
            .insert(gigSlots)
            .values(
              input.slots.map((s) => ({
                gig_id: gig.id,
                set_order: s.setOrder,
                fee: s.fee ?? null,
              })),
            )
            .returning({
              id: gigSlots.id,
              setOrder: gigSlots.set_order,
              fee: gigSlots.fee,
              bandId: gigSlots.band_id,
            });

    // MUS-103: createGig doesn't accept per-slot genre yet (gig creation UI
    // is deferred — see ticket "out of scope"). Slots are inserted without
    // `genre_id`, so we surface `genre: null` on every returned slot. When
    // the UI lands this helper will grow a `genreId` input and the null
    // literal becomes a lookup.
    return {
      ...gig,
      slots: slotRows
        .map((s) => ({ ...s, genre: null }))
        .sort((a, b) => a.setOrder - b.setOrder),
    };
  });
}

export async function getGigById(id: number): Promise<ShapedGig | null> {
  const [gig] = await db
    .select({
      id: gigs.id,
      datetime: gigs.datetime,
      venueId: gigs.venue_id,
      doors: gigs.doors,
      status: gigs.status,
      organiserUserId: gigs.organiser_user_id,
    })
    .from(gigs)
    .where(eq(gigs.id, id))
    .limit(1);
  if (!gig) return null;

  // MUS-103: left join `genres` so slots with a null `genre_id` still come
  // back (as `genre: null` after shaping), and slots with a set `genre_id`
  // carry the resolved `{ id, slug, name }` inline.
  const slotRows = await db
    .select({
      id: gigSlots.id,
      setOrder: gigSlots.set_order,
      fee: gigSlots.fee,
      bandId: gigSlots.band_id,
      genreId: genres.id,
      genreSlug: genres.slug,
      genreName: genres.name,
    })
    .from(gigSlots)
    .leftJoin(genres, eq(genres.id, gigSlots.genre_id))
    .where(eq(gigSlots.gig_id, id))
    .orderBy(asc(gigSlots.set_order));

  const slots: ShapedGigSlot[] = slotRows.map((r) => ({
    id: r.id,
    setOrder: r.setOrder,
    fee: r.fee,
    bandId: r.bandId,
    genre:
      r.genreId !== null && r.genreSlug !== null && r.genreName !== null
        ? { id: r.genreId, slug: r.genreSlug, name: r.genreName }
        : null,
  }));

  return { ...gig, slots };
}

/**
 * Lists gigs organised by a user, newest first, with slot counts rolled up.
 * Used by the mobile "My gigs" picker when posting a band-for-gig-slot request.
 */
export async function listGigsByOrganiser(
  organiserUserId: number,
): Promise<ShapedGigSummary[]> {
  const gigRows = await db
    .select({
      id: gigs.id,
      datetime: gigs.datetime,
      doors: gigs.doors,
      status: gigs.status,
      venueId: venues.id,
      venueName: venues.name,
    })
    .from(gigs)
    .innerJoin(venues, eq(venues.id, gigs.venue_id))
    .where(eq(gigs.organiser_user_id, organiserUserId))
    .orderBy(desc(gigs.created_at));

  if (gigRows.length === 0) return [];

  const ids = gigRows.map((g) => g.id);
  // Fetch all slots for these gigs in one round trip rather than N+1.
  const allSlots = await db
    .select({
      gigId: gigSlots.gig_id,
      bandId: gigSlots.band_id,
    })
    .from(gigSlots)
    .where(inArray(gigSlots.gig_id, ids));

  const totalsByGigId = new Map<number, { total: number; open: number }>();
  for (const s of allSlots) {
    const agg = totalsByGigId.get(s.gigId) ?? { total: 0, open: 0 };
    agg.total += 1;
    if (s.bandId === null) agg.open += 1;
    totalsByGigId.set(s.gigId, agg);
  }

  return gigRows.map((g) => {
    const agg = totalsByGigId.get(g.id) ?? { total: 0, open: 0 };
    return {
      id: g.id,
      datetime: g.datetime,
      venue: { id: g.venueId, name: g.venueName },
      doors: g.doors,
      status: g.status,
      totalSlots: agg.total,
      openSlots: agg.open,
    };
  });
}

/**
 * Returns the count of slots on a gig that still have `band_id IS NULL`.
 * Used by `requests.create` to set `slot_count` on a band-for-gig-slot request.
 */
export async function countOpenSlots(gigId: number): Promise<number> {
  const rows = await db
    .select({ id: gigSlots.id })
    .from(gigSlots)
    .where(and(eq(gigSlots.gig_id, gigId), isNull(gigSlots.band_id)));
  return rows.length;
}

