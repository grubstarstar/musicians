import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { db } from '../db.js';
import {
  bandMembers,
  bands,
  expressionsOfInterest,
  gigs,
  requests,
  users,
  venues,
} from '../schema.js';
import type {
  EoiDetails,
  EoiState,
  RequestDetails,
  RequestKind,
  RequestStatus,
} from '../schema.js';
import {
  buildRequestInsertValues,
  type RequestCreateInput,
} from './buildRequestInsertValues.js';
import { matchesGigRequest } from './matchesGigRequest.js';
import { sortEoisForManage, type SortableEoi } from './sortEoisForManage.js';

export interface ShapedRequest {
  id: number;
  kind: RequestKind;
  status: RequestStatus;
  slotCount: number;
  slotsFilled: number;
  details: RequestDetails;
  anchorBandId: number | null;
  anchorGigId: number | null;
  createdAt: Date;
}

// Shape returned by `listOpenRequests`. Either `anchorBand` or `anchorGig`
// is populated depending on the request kind (never both, never neither).
// Consumers should narrow on `kind` (or on the presence of one anchor) before
// rendering.
//
// `anchorBand` is retained for backwards-compat with the MUS-51 listing code
// (web discovery list) and the mobile requests.tsx; it's populated only for
// `musician-for-band` rows.
export interface ShapedRequestWithAnchors extends Omit<ShapedRequest, 'anchorBandId' | 'anchorGigId'> {
  anchorBand: { id: number; name: string; imageUrl: string | null } | null;
  anchorGig: { id: number; datetime: Date; venue: { id: number; name: string } } | null;
  // Back-compat alias for MUS-51 consumers that accessed `band` directly.
  // Same reference as `anchorBand`.
  band: { id: number; name: string; imageUrl: string | null } | null;
}

// Narrower shape used by queries that innerJoin on bands and are therefore
// guaranteed to have a band anchor (MUS-55's detail + My Requests flows).
// Keep this distinct from `ShapedRequestWithAnchors` whose `band` is nullable.
export interface ShapedRequestWithBand extends Omit<ShapedRequest, 'anchorBandId' | 'anchorGigId'> {
  band: { id: number; name: string; imageUrl: string | null };
}

// Nullable-band variant used for request detail reads since MUS-57 added
// counterpart kinds (`band-for-gig-slot`, `gig-for-band`) that don't have a
// band anchor. `band` is populated for `musician-for-band` and for
// `gig-for-band` (where the band sits inside `details.bandId`, resolved via
// a separate lookup). `gig` is populated for `band-for-gig-slot`.
export interface ShapedRequestForDetail extends Omit<ShapedRequest, 'anchorBandId' | 'anchorGigId'> {
  band: { id: number; name: string; imageUrl: string | null } | null;
  gig: {
    id: number;
    datetime: Date;
    venue: { id: number; name: string };
  } | null;
}

export async function isMemberOfBand(userId: number, bandId: number): Promise<boolean> {
  const [row] = await db
    .select({ user_id: bandMembers.user_id })
    .from(bandMembers)
    .where(and(eq(bandMembers.band_id, bandId), eq(bandMembers.user_id, userId)))
    .limit(1);
  return !!row;
}

export async function createRequest(
  input: RequestCreateInput,
  userId: number,
): Promise<ShapedRequest> {
  const values = buildRequestInsertValues(input, userId);
  const [row] = await db
    .insert(requests)
    .values(values)
    .returning({
      id: requests.id,
      kind: requests.kind,
      status: requests.status,
      slotCount: requests.slot_count,
      slotsFilled: requests.slots_filled,
      details: requests.details,
      anchorBandId: requests.anchor_band_id,
      anchorGigId: requests.anchor_gig_id,
      createdAt: requests.created_at,
    });
  return row;
}

/**
 * Lists open requests across all kinds (optionally filtered to a single kind).
 *
 * Both anchors are left-joined so the response carries whichever one is
 * relevant for each row: `anchorBand` for `musician-for-band`, `anchorGig`
 * for `band-for-gig-slot`. Consumers pick the one matching the row's `kind`.
 *
 * Pass `excludeUserId` to hide rows authored by that user — used by the
 * Opportunities tab so callers don't see (and can't express interest in)
 * their own requests (MUS-61). Optional so non-authenticated or admin
 * callers can still fetch the full open list.
 */
export async function listOpenRequests(filter: {
  kind?: RequestKind;
  excludeUserId?: number;
}): Promise<ShapedRequestWithAnchors[]> {
  const conditions = [eq(requests.status, 'open')];
  if (filter.kind) {
    conditions.push(eq(requests.kind, filter.kind));
  }
  if (filter.excludeUserId !== undefined) {
    conditions.push(ne(requests.source_user_id, filter.excludeUserId));
  }
  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

  const rows = await db
    .select({
      id: requests.id,
      kind: requests.kind,
      status: requests.status,
      slotCount: requests.slot_count,
      slotsFilled: requests.slots_filled,
      details: requests.details,
      createdAt: requests.created_at,
      anchorBandId: bands.id,
      anchorBandName: bands.name,
      anchorBandImageUrl: bands.imageUrl,
      anchorGigId: gigs.id,
      anchorGigDatetime: gigs.datetime,
      anchorGigVenueId: venues.id,
      anchorGigVenueName: venues.name,
    })
    .from(requests)
    .leftJoin(bands, eq(bands.id, requests.anchor_band_id))
    .leftJoin(gigs, eq(gigs.id, requests.anchor_gig_id))
    .leftJoin(venues, eq(venues.id, gigs.venue_id))
    .where(whereClause)
    .orderBy(desc(requests.created_at));

  return rows.map((r) => {
    const anchorBand =
      r.anchorBandId !== null && r.anchorBandName !== null
        ? {
            id: r.anchorBandId,
            name: r.anchorBandName,
            imageUrl: r.anchorBandImageUrl,
          }
        : null;
    const anchorGig =
      r.anchorGigId !== null &&
      r.anchorGigDatetime !== null &&
      r.anchorGigVenueId !== null &&
      r.anchorGigVenueName !== null
        ? {
            id: r.anchorGigId,
            datetime: r.anchorGigDatetime,
            venue: { id: r.anchorGigVenueId, name: r.anchorGigVenueName },
          }
        : null;
    return {
      id: r.id,
      kind: r.kind,
      status: r.status,
      slotCount: r.slotCount,
      slotsFilled: r.slotsFilled,
      details: r.details,
      createdAt: r.createdAt,
      anchorBand,
      anchorGig,
      band: anchorBand,
    };
  });
}

/**
 * Single-request read used by the Express Interest detail screen. Same shape
 * as a row from `listOpenRequests` so the detail / list views can share code.
 * Returns null if the request doesn't exist; caller maps to NOT_FOUND.
 *
 * Note: this variant innerJoins on bands so only `musician-for-band` rows
 * (which have a band anchor) are returned. Retained for backward compat
 * with MUS-55's mobile detail flow that hard-codes `data.band`. Newer flows
 * should use `getRequestForDetail` which handles the counterpart kinds too.
 */
export async function getOpenRequestWithBand(
  requestId: number,
): Promise<ShapedRequestWithBand | null> {
  const [row] = await db
    .select({
      id: requests.id,
      kind: requests.kind,
      status: requests.status,
      slotCount: requests.slot_count,
      slotsFilled: requests.slots_filled,
      details: requests.details,
      createdAt: requests.created_at,
      bandId: bands.id,
      bandName: bands.name,
      bandImageUrl: bands.imageUrl,
    })
    .from(requests)
    .innerJoin(bands, eq(bands.id, requests.anchor_band_id))
    .where(eq(requests.id, requestId))
    .limit(1);

  if (!row) return null;
  const { bandId, bandName, bandImageUrl, ...rest } = row;
  return { ...rest, band: { id: bandId, name: bandName, imageUrl: bandImageUrl } };
}

/**
 * Detail read that works for any request kind (MUS-57). Left-joins both
 * anchors and resolves the `gig-for-band` band lazily via `details.bandId`.
 * Returns null if no row matches.
 */
export async function getRequestForDetail(
  requestId: number,
): Promise<ShapedRequestForDetail | null> {
  const [row] = await db
    .select({
      id: requests.id,
      kind: requests.kind,
      status: requests.status,
      slotCount: requests.slot_count,
      slotsFilled: requests.slots_filled,
      details: requests.details,
      createdAt: requests.created_at,
      anchorBandId: bands.id,
      anchorBandName: bands.name,
      anchorBandImageUrl: bands.imageUrl,
      anchorGigId: gigs.id,
      anchorGigDatetime: gigs.datetime,
      anchorGigVenueId: venues.id,
      anchorGigVenueName: venues.name,
    })
    .from(requests)
    .leftJoin(bands, eq(bands.id, requests.anchor_band_id))
    .leftJoin(gigs, eq(gigs.id, requests.anchor_gig_id))
    .leftJoin(venues, eq(venues.id, gigs.venue_id))
    .where(eq(requests.id, requestId))
    .limit(1);
  if (!row) return null;

  let band =
    row.anchorBandId !== null && row.anchorBandName !== null
      ? {
          id: row.anchorBandId,
          name: row.anchorBandName,
          imageUrl: row.anchorBandImageUrl,
        }
      : null;

  // `gig-for-band` carries its band id in `details.bandId` (no anchor column).
  // Resolve it with a second lookup so the client can render the band summary
  // without juggling two code paths.
  if (band === null && row.details.kind === 'gig-for-band') {
    const [b] = await db
      .select({ id: bands.id, name: bands.name, imageUrl: bands.imageUrl })
      .from(bands)
      .where(eq(bands.id, row.details.bandId))
      .limit(1);
    band = b ?? null;
  }

  const gig =
    row.anchorGigId !== null &&
    row.anchorGigDatetime !== null &&
    row.anchorGigVenueId !== null &&
    row.anchorGigVenueName !== null
      ? {
          id: row.anchorGigId,
          datetime: row.anchorGigDatetime,
          venue: { id: row.anchorGigVenueId, name: row.anchorGigVenueName },
        }
      : null;

  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    slotCount: row.slotCount,
    slotsFilled: row.slotsFilled,
    details: row.details,
    createdAt: row.createdAt,
    band,
    gig,
  };
}

// --- listMine (MUS-55) ---------------------------------------------------

export interface ShapedEoiForManage extends SortableEoi {
  id: number;
  state: EoiState;
  details: EoiDetails | null;
  createdAt: Date;
  decidedAt: Date | null;
  targetUser: {
    id: number;
    username: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export interface ShapedRequestWithEois extends ShapedRequestWithAnchors {
  updatedAt: Date;
  eois: ShapedEoiForManage[];
}

/**
 * Lists requests authored by the caller, regardless of status, newest first.
 * Each request embeds its EoIs with the target user summary. EoIs are sorted
 * pending-first, then most-recently decided (see `sortEoisForManage`).
 *
 * Both anchors are left-joined so the response includes whichever is relevant
 * per row: `anchorBand` for `musician-for-band`, `anchorGig` for
 * `band-for-gig-slot`. Mirrors the shape returned by `listOpenRequests`.
 *
 * Shape is camelCase-only across the tRPC boundary — never a raw Drizzle row.
 */
export async function listMyRequests(userId: number): Promise<ShapedRequestWithEois[]> {
  const requestRows = await db
    .select({
      id: requests.id,
      kind: requests.kind,
      status: requests.status,
      slotCount: requests.slot_count,
      slotsFilled: requests.slots_filled,
      details: requests.details,
      createdAt: requests.created_at,
      updatedAt: requests.updated_at,
      anchorBandId: bands.id,
      anchorBandName: bands.name,
      anchorBandImageUrl: bands.imageUrl,
      anchorGigId: gigs.id,
      anchorGigDatetime: gigs.datetime,
      anchorGigVenueId: venues.id,
      anchorGigVenueName: venues.name,
    })
    .from(requests)
    .leftJoin(bands, eq(bands.id, requests.anchor_band_id))
    .leftJoin(gigs, eq(gigs.id, requests.anchor_gig_id))
    .leftJoin(venues, eq(venues.id, gigs.venue_id))
    .where(eq(requests.source_user_id, userId))
    .orderBy(desc(requests.created_at));

  if (requestRows.length === 0) return [];

  const requestIds = requestRows.map((r) => r.id);

  // One batched fetch for EoIs across every request the caller owns — avoids
  // an N+1 per-request query. Group in memory afterwards.
  const eoiRows = await db
    .select({
      id: expressionsOfInterest.id,
      requestId: expressionsOfInterest.request_id,
      state: expressionsOfInterest.state,
      details: expressionsOfInterest.details,
      createdAt: expressionsOfInterest.created_at,
      decidedAt: expressionsOfInterest.decided_at,
      targetUserId: users.id,
      targetUsername: users.username,
      targetFirstName: users.firstName,
      targetLastName: users.lastName,
    })
    .from(expressionsOfInterest)
    .innerJoin(users, eq(users.id, expressionsOfInterest.target_user_id))
    .where(inArray(expressionsOfInterest.request_id, requestIds));

  return requestRows.map((r) => {
    const matching = eoiRows
      .filter((e) => e.requestId === r.id)
      .map<ShapedEoiForManage>((e) => ({
        id: e.id,
        state: e.state,
        details: e.details,
        createdAt: e.createdAt,
        decidedAt: e.decidedAt,
        targetUser: {
          id: e.targetUserId,
          username: e.targetUsername,
          firstName: e.targetFirstName,
          lastName: e.targetLastName,
        },
      }));
    const anchorBand =
      r.anchorBandId !== null && r.anchorBandName !== null
        ? {
            id: r.anchorBandId,
            name: r.anchorBandName,
            imageUrl: r.anchorBandImageUrl,
          }
        : null;
    const anchorGig =
      r.anchorGigId !== null &&
      r.anchorGigDatetime !== null &&
      r.anchorGigVenueId !== null &&
      r.anchorGigVenueName !== null
        ? {
            id: r.anchorGigId,
            datetime: r.anchorGigDatetime,
            venue: { id: r.anchorGigVenueId, name: r.anchorGigVenueName },
          }
        : null;
    return {
      id: r.id,
      kind: r.kind,
      status: r.status,
      slotCount: r.slotCount,
      slotsFilled: r.slotsFilled,
      details: r.details,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      anchorBand,
      anchorGig,
      band: anchorBand,
      eois: sortEoisForManage(matching),
    };
  });
}

// --- Matches (MUS-57) ----------------------------------------------------

/**
 * Shape returned by `listMatchesForUser`. One entry per (myRequest,
 * counterpartRequest) pair that satisfies `matchesGigRequest`.
 *
 * Consumers (mobile) render this as a suggestion card; the pre-fill data
 * for one-tap EoI creation is carried inside `counterpart` (specifically
 * `gigId` for the promoter-side flow, or `bandId` + `targetDate` for the
 * band-side flow).
 */
export interface ShapedMatch {
  myRequest: {
    id: number;
    kind: 'band-for-gig-slot' | 'gig-for-band';
  };
  counterpart: {
    id: number;
    kind: 'band-for-gig-slot' | 'gig-for-band';
    sourceUserId: number;
    // Fields for `band-for-gig-slot` counterparts: the gig itself.
    gigId: number | null;
    gigDatetime: Date | null;
    gigVenueName: string | null;
    feeOffered: number | null;
    // Fields for `gig-for-band` counterparts: the band + target date.
    bandId: number | null;
    bandName: string | null;
    bandImageUrl: string | null;
    targetDate: string | null;
    area: string | null;
    feeAsked: number | null;
  };
}

/**
 * Returns the set of matches between the caller's open requests and open
 * counterpart requests owned by other users.
 *
 * Implemented as a candidate-fetch + filter: pull both sides' open rows,
 * resolve enough data to run `matchesGigRequest` (gig date + venue city vs
 * target date + area), then pair them up with the pure match rule. The
 * discovery volume today is small enough that this is fine; if it becomes a
 * hotspot we'd replace it with a SQL-side pre-filter + pagination.
 */
export async function listMatchesForUser(userId: number): Promise<ShapedMatch[]> {
  // Caller's open requests across the two counterpart kinds.
  const myRows = await db
    .select({
      id: requests.id,
      kind: requests.kind,
      details: requests.details,
      anchorGigId: requests.anchor_gig_id,
    })
    .from(requests)
    .where(
      and(
        eq(requests.source_user_id, userId),
        eq(requests.status, 'open'),
        inArray(requests.kind, ['band-for-gig-slot', 'gig-for-band']),
      ),
    );

  if (myRows.length === 0) return [];

  // Counterpart candidates: every OTHER user's open band-for-gig-slot +
  // gig-for-band, joined through gigs/venues/bands as needed so we have
  // enough data to feed `matchesGigRequest`.
  const candidateRows = await db
    .select({
      id: requests.id,
      kind: requests.kind,
      details: requests.details,
      sourceUserId: requests.source_user_id,
      anchorGigId: requests.anchor_gig_id,
      gigDatetime: gigs.datetime,
      gigVenueName: venues.name,
      bandId: bands.id,
      bandName: bands.name,
      bandImageUrl: bands.imageUrl,
    })
    .from(requests)
    .leftJoin(gigs, eq(gigs.id, requests.anchor_gig_id))
    .leftJoin(venues, eq(venues.id, gigs.venue_id))
    .leftJoin(bands, eq(bands.id, requests.anchor_band_id))
    .where(
      and(
        eq(requests.status, 'open'),
        ne(requests.source_user_id, userId),
        inArray(requests.kind, ['band-for-gig-slot', 'gig-for-band']),
      ),
    );

  // We also need the `bands` row for `gig-for-band` counterparts (band id
  // lives inside `details`, not as an anchor). Fetch lazily in bulk.
  const gigForBandBandIds = Array.from(
    new Set(
      candidateRows
        .filter((r) => r.kind === 'gig-for-band' && r.details.kind === 'gig-for-band')
        .map((r) => {
          if (r.details.kind !== 'gig-for-band') return null;
          return r.details.bandId;
        })
        .filter((id): id is number => id !== null),
    ),
  );
  const extraBands = gigForBandBandIds.length
    ? await db
        .select({
          id: bands.id,
          name: bands.name,
          imageUrl: bands.imageUrl,
        })
        .from(bands)
        .where(inArray(bands.id, gigForBandBandIds))
    : [];
  const bandsById = new Map(extraBands.map((b) => [b.id, b]));

  const matches: ShapedMatch[] = [];

  for (const mine of myRows) {
    if (mine.kind === 'band-for-gig-slot') {
      if (mine.details.kind !== 'band-for-gig-slot') continue;
      if (mine.anchorGigId === null) continue;
      // Our side: the anchor gig's datetime. Need to look it up since `mine`
      // doesn't join gigs.
      const [myGig] = await db
        .select({
          datetime: gigs.datetime,
          venueName: venues.name,
        })
        .from(gigs)
        .innerJoin(venues, eq(venues.id, gigs.venue_id))
        .where(eq(gigs.id, mine.anchorGigId))
        .limit(1);
      if (!myGig) continue;
      const myFeeOffered = mine.details.feeOffered;

      for (const other of candidateRows) {
        if (other.kind !== 'gig-for-band') continue;
        if (other.details.kind !== 'gig-for-band') continue;
        const ok = matchesGigRequest(
          {
            gigDate: myGig.datetime.toISOString(),
            gigVenueCity: myGig.venueName,
            ...(myFeeOffered !== undefined ? { feeOffered: myFeeOffered } : {}),
          },
          {
            targetDate: other.details.targetDate,
            ...(other.details.area !== undefined ? { area: other.details.area } : {}),
            ...(other.details.feeAsked !== undefined
              ? { feeAsked: other.details.feeAsked }
              : {}),
          },
        );
        if (!ok) continue;
        const band = bandsById.get(other.details.bandId) ?? null;
        matches.push({
          myRequest: { id: mine.id, kind: 'band-for-gig-slot' },
          counterpart: {
            id: other.id,
            kind: 'gig-for-band',
            sourceUserId: other.sourceUserId,
            gigId: null,
            gigDatetime: null,
            gigVenueName: null,
            feeOffered: null,
            bandId: other.details.bandId,
            bandName: band?.name ?? null,
            bandImageUrl: band?.imageUrl ?? null,
            targetDate: other.details.targetDate,
            area: other.details.area ?? null,
            feeAsked: other.details.feeAsked ?? null,
          },
        });
      }
    } else if (mine.kind === 'gig-for-band') {
      if (mine.details.kind !== 'gig-for-band') continue;
      const myTargetDate = mine.details.targetDate;
      const myArea = mine.details.area;
      const myFeeAsked = mine.details.feeAsked;

      for (const other of candidateRows) {
        if (other.kind !== 'band-for-gig-slot') continue;
        if (other.details.kind !== 'band-for-gig-slot') continue;
        if (other.gigDatetime === null) continue;
        const otherFeeOffered = other.details.feeOffered;
        const ok = matchesGigRequest(
          {
            gigDate: other.gigDatetime.toISOString(),
            ...(other.gigVenueName !== null
              ? { gigVenueCity: other.gigVenueName }
              : {}),
            ...(otherFeeOffered !== undefined ? { feeOffered: otherFeeOffered } : {}),
          },
          {
            targetDate: myTargetDate,
            ...(myArea !== undefined ? { area: myArea } : {}),
            ...(myFeeAsked !== undefined ? { feeAsked: myFeeAsked } : {}),
          },
        );
        if (!ok) continue;
        matches.push({
          myRequest: { id: mine.id, kind: 'gig-for-band' },
          counterpart: {
            id: other.id,
            kind: 'band-for-gig-slot',
            sourceUserId: other.sourceUserId,
            gigId: other.anchorGigId,
            gigDatetime: other.gigDatetime,
            gigVenueName: other.gigVenueName,
            feeOffered: other.details.feeOffered ?? null,
            bandId: null,
            bandName: null,
            bandImageUrl: null,
            targetDate: null,
            area: null,
            feeAsked: null,
          },
        });
      }
    }
  }

  return matches;
}
