import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { db } from '../db.js';
import {
  bandMembers,
  bands,
  expressionsOfInterest,
  gigs,
  instruments,
  requests,
  users,
  venues,
} from '../schema.js';
import type {
  EoiDetails,
  EoiState,
  RequestKind,
  RequestStatus,
} from '../schema.js';
import {
  buildRequestInsertValues,
  type RequestCreateInput,
} from './buildRequestInsertValues.js';
import { matchesGigRequest } from './matchesGigRequest.js';
import { matchesMusicianRequest } from './matchesMusicianRequest.js';
import { matchesNightAtVenue } from './matchesNightAtVenue.js';
import { sortEoisForManage, type SortableEoi } from './sortEoisForManage.js';
import {
  collectInstrumentIds,
  withInstrumentName,
  type RequestDetailsWithInstrumentName,
} from './withInstrumentName.js';

export interface ShapedRequest {
  id: number;
  kind: RequestKind;
  status: RequestStatus;
  slotCount: number;
  slotsFilled: number;
  details: RequestDetailsWithInstrumentName;
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
//
// MUS-68: `details` on the two instrument-carrying kinds is enriched with
// `instrumentName` from the `instruments` taxonomy join.
export interface ShapedRequestWithAnchors extends Omit<ShapedRequest, 'anchorBandId' | 'anchorGigId'> {
  anchorBand: { id: number; name: string; imageUrl: string | null } | null;
  anchorGig: { id: number; datetime: Date; venue: { id: number; name: string } } | null;
  // Back-compat alias for MUS-51 consumers that accessed `band` directly.
  // Same reference as `anchorBand`.
  band: { id: number; name: string; imageUrl: string | null } | null;
}

// Nullable-band variant used for request detail reads since MUS-57 added
// counterpart kinds (`band-for-gig-slot`, `gig-for-band`) that don't have a
// band anchor. `band` is populated for `musician-for-band` and for
// `gig-for-band` (where the band sits inside `details.bandId`, resolved via
// a separate lookup). `gig` is populated for `band-for-gig-slot`.
//
// MUS-68: inherits `details: RequestDetailsWithInstrumentName` from
// `ShapedRequest` — instrument-carrying kinds include `instrumentName`.
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
  // MUS-68: denormalise `instrumentName` onto the returned details so the
  // client can render the pasted-back request without a follow-up lookup.
  const ids = collectInstrumentIds([row.details]);
  const instrumentNameById = await loadInstrumentNameMap(ids);
  return {
    ...row,
    details: withInstrumentName(row.details, instrumentNameById),
  };
}

/**
 * Bulk resolve an instrument id list to a `Map<id, name>` for display
 * denormalisation. Returns an empty map if the list is empty so callers can
 * skip the DB round-trip without a branch at each call site.
 */
async function loadInstrumentNameMap(
  ids: number[],
): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: instruments.id, name: instruments.name })
    .from(instruments)
    .where(inArray(instruments.id, ids));
  return new Map(rows.map((r) => [r.id, r.name]));
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

  const instrumentNameById = await loadInstrumentNameMap(
    collectInstrumentIds(rows.map((r) => r.details)),
  );

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
      details: withInstrumentName(r.details, instrumentNameById),
      createdAt: r.createdAt,
      anchorBand,
      anchorGig,
      band: anchorBand,
    };
  });
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

  const instrumentNameById = await loadInstrumentNameMap(
    collectInstrumentIds([row.details]),
  );

  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    slotCount: row.slotCount,
    slotsFilled: row.slotsFilled,
    details: withInstrumentName(row.details, instrumentNameById),
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

  const instrumentNameById = await loadInstrumentNameMap(
    collectInstrumentIds(requestRows.map((r) => r.details)),
  );

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
      details: withInstrumentName(r.details, instrumentNameById),
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
 * Kinds that participate in the matches surface. MUS-57 added the gig pair;
 * MUS-58 extends with the night-at-venue and musician pairs. `musician-for-
 * band` and `band-for-musician` are counterpart sides of the same engagement,
 * as are `night-at-venue` and `promoter-for-venue-night`.
 */
export type MatchableKind =
  | 'band-for-gig-slot'
  | 'gig-for-band'
  | 'night-at-venue'
  | 'promoter-for-venue-night'
  | 'musician-for-band'
  | 'band-for-musician';

/**
 * Shape returned by `listMatchesForUser`. One entry per (myRequest,
 * counterpartRequest) pair that satisfies the relevant pure match rule.
 *
 * Consumers (mobile) render this as a suggestion card; the pre-fill data
 * for one-tap EoI creation is carried inside `counterpart`. The field is a
 * flat superset so every counterpart kind reads through the same shape —
 * fields irrelevant to a given kind are just `null`.
 */
export interface ShapedMatch {
  myRequest: {
    id: number;
    kind: MatchableKind;
  };
  counterpart: {
    id: number;
    kind: MatchableKind;
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
    // Fields for `night-at-venue` / `promoter-for-venue-night` counterparts.
    concept: string | null;
    // Promoter-side `night-at-venue`: the list of possibleDates. `null` for
    // any other kind so the client can use `null` to mean "not applicable".
    possibleDates: string[] | null;
    // Venue-side `promoter-for-venue-night`: the venue + proposedDate.
    venueId: number | null;
    venueName: string | null;
    proposedDate: string | null;
    // Fields for `musician-for-band` / `band-for-musician` counterparts.
    // MUS-68: instrumentId is the taxonomy id; instrumentName is denormalised
    // from the `instruments` join so the client can render without a second
    // lookup. Both are null for kinds that don't carry an instrument.
    instrumentId: number | null;
    instrumentName: string | null;
  };
}

/** All request kinds that participate in the matches surface. */
const MATCHABLE_KINDS: MatchableKind[] = [
  'band-for-gig-slot',
  'gig-for-band',
  'night-at-venue',
  'promoter-for-venue-night',
  'musician-for-band',
  'band-for-musician',
];

/**
 * Factory for an "empty" counterpart shape. Individual pairings fill in the
 * fields relevant to their kind; everything else stays null so the client
 * can narrow on `kind` and read only what applies.
 */
function emptyCounterpartShape(): Omit<ShapedMatch['counterpart'], 'id' | 'kind' | 'sourceUserId'> {
  return {
    gigId: null,
    gigDatetime: null,
    gigVenueName: null,
    feeOffered: null,
    bandId: null,
    bandName: null,
    bandImageUrl: null,
    targetDate: null,
    area: null,
    feeAsked: null,
    concept: null,
    possibleDates: null,
    venueId: null,
    venueName: null,
    proposedDate: null,
    instrumentId: null,
    instrumentName: null,
  };
}

/**
 * Returns the set of matches between the caller's open requests and open
 * counterpart requests owned by other users across every kind pair:
 *   - `band-for-gig-slot` ↔ `gig-for-band` (MUS-57, `matchesGigRequest`)
 *   - `night-at-venue` ↔ `promoter-for-venue-night` (MUS-58, `matchesNightAtVenue`)
 *   - `musician-for-band` ↔ `band-for-musician` (MUS-58, `matchesMusicianRequest`)
 *
 * Implemented as a candidate-fetch + filter: pull both sides' open rows,
 * resolve enough data to run each match rule, then pair them up with the
 * relevant pure helper. Discovery volume today is small enough that this is
 * fine; if it becomes a hotspot we'd replace it with a SQL-side pre-filter +
 * pagination.
 */
export async function listMatchesForUser(userId: number): Promise<ShapedMatch[]> {
  // Caller's open requests across every matchable kind.
  const myRows = await db
    .select({
      id: requests.id,
      kind: requests.kind,
      details: requests.details,
      anchorBandId: requests.anchor_band_id,
      anchorGigId: requests.anchor_gig_id,
    })
    .from(requests)
    .where(
      and(
        eq(requests.source_user_id, userId),
        eq(requests.status, 'open'),
        inArray(requests.kind, MATCHABLE_KINDS),
      ),
    );

  if (myRows.length === 0) return [];

  // Counterpart candidates: every OTHER user's open rows across the same
  // kinds. Join through gigs/venues/bands as needed so we have enough data
  // to feed the pure helpers.
  const candidateRows = await db
    .select({
      id: requests.id,
      kind: requests.kind,
      details: requests.details,
      sourceUserId: requests.source_user_id,
      anchorBandId: requests.anchor_band_id,
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
        inArray(requests.kind, MATCHABLE_KINDS),
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

  // Venues referenced by `promoter-for-venue-night` counterparts. Same
  // pattern — pre-fetch in a single round-trip rather than N+1.
  const promoterForVenueNightVenueIds = Array.from(
    new Set(
      candidateRows
        .filter(
          (r) =>
            r.kind === 'promoter-for-venue-night' &&
            r.details.kind === 'promoter-for-venue-night',
        )
        .map((r) => {
          if (r.details.kind !== 'promoter-for-venue-night') return null;
          return r.details.venueId;
        })
        .filter((id): id is number => id !== null),
    ),
  );
  const extraVenues = promoterForVenueNightVenueIds.length
    ? await db
        .select({ id: venues.id, name: venues.name })
        .from(venues)
        .where(inArray(venues.id, promoterForVenueNightVenueIds))
    : [];
  const venuesById = new Map(extraVenues.map((v) => [v.id, v]));

  // MUS-68: instrument ids referenced across `musician-for-band` and
  // `band-for-musician` candidate rows. Bulk-fetch names so every matched
  // counterpart can carry `instrumentName` without an N+1 lookup.
  const instrumentIdSet = new Set<number>();
  for (const r of candidateRows) {
    if (r.details.kind === 'musician-for-band' || r.details.kind === 'band-for-musician') {
      instrumentIdSet.add(r.details.instrumentId);
    }
  }
  const instrumentRows = instrumentIdSet.size
    ? await db
        .select({ id: instruments.id, name: instruments.name })
        .from(instruments)
        .where(inArray(instruments.id, Array.from(instrumentIdSet)))
    : [];
  const instrumentNameById = new Map(
    instrumentRows.map((i) => [i.id, i.name]),
  );

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
            ...emptyCounterpartShape(),
            id: other.id,
            kind: 'gig-for-band',
            sourceUserId: other.sourceUserId,
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
            ...emptyCounterpartShape(),
            id: other.id,
            kind: 'band-for-gig-slot',
            sourceUserId: other.sourceUserId,
            gigId: other.anchorGigId,
            gigDatetime: other.gigDatetime,
            gigVenueName: other.gigVenueName,
            feeOffered: other.details.feeOffered ?? null,
          },
        });
      }
    } else if (mine.kind === 'night-at-venue') {
      if (mine.details.kind !== 'night-at-venue') continue;
      const myPossibleDates = mine.details.possibleDates;
      const myConcept = mine.details.concept;
      for (const other of candidateRows) {
        if (other.kind !== 'promoter-for-venue-night') continue;
        if (other.details.kind !== 'promoter-for-venue-night') continue;
        if (
          !matchesNightAtVenue(
            { possibleDates: myPossibleDates },
            { proposedDate: other.details.proposedDate },
          )
        ) {
          continue;
        }
        const venue = venuesById.get(other.details.venueId) ?? null;
        matches.push({
          myRequest: { id: mine.id, kind: 'night-at-venue' },
          counterpart: {
            ...emptyCounterpartShape(),
            id: other.id,
            kind: 'promoter-for-venue-night',
            sourceUserId: other.sourceUserId,
            venueId: other.details.venueId,
            venueName: venue?.name ?? null,
            proposedDate: other.details.proposedDate,
            concept: other.details.concept ?? myConcept,
          },
        });
      }
    } else if (mine.kind === 'promoter-for-venue-night') {
      if (mine.details.kind !== 'promoter-for-venue-night') continue;
      const myProposedDate = mine.details.proposedDate;
      for (const other of candidateRows) {
        if (other.kind !== 'night-at-venue') continue;
        if (other.details.kind !== 'night-at-venue') continue;
        if (
          !matchesNightAtVenue(
            { possibleDates: other.details.possibleDates },
            { proposedDate: myProposedDate },
          )
        ) {
          continue;
        }
        matches.push({
          myRequest: { id: mine.id, kind: 'promoter-for-venue-night' },
          counterpart: {
            ...emptyCounterpartShape(),
            id: other.id,
            kind: 'night-at-venue',
            sourceUserId: other.sourceUserId,
            concept: other.details.concept,
            possibleDates: other.details.possibleDates,
            // Echo back my proposed date so the client can render "they can
            // run it on your date" without another fetch.
            proposedDate: myProposedDate,
          },
        });
      }
    } else if (mine.kind === 'musician-for-band') {
      if (mine.details.kind !== 'musician-for-band') continue;
      const myInstrumentId = mine.details.instrumentId;
      for (const other of candidateRows) {
        if (other.kind !== 'band-for-musician') continue;
        if (other.details.kind !== 'band-for-musician') continue;
        if (
          !matchesMusicianRequest(
            { instrumentId: myInstrumentId },
            { instrumentId: other.details.instrumentId },
          )
        ) {
          continue;
        }
        matches.push({
          myRequest: { id: mine.id, kind: 'musician-for-band' },
          counterpart: {
            ...emptyCounterpartShape(),
            id: other.id,
            kind: 'band-for-musician',
            sourceUserId: other.sourceUserId,
            instrumentId: other.details.instrumentId,
            instrumentName:
              instrumentNameById.get(other.details.instrumentId) ?? null,
          },
        });
      }
    } else if (mine.kind === 'band-for-musician') {
      if (mine.details.kind !== 'band-for-musician') continue;
      const myInstrumentId = mine.details.instrumentId;
      for (const other of candidateRows) {
        if (other.kind !== 'musician-for-band') continue;
        if (other.details.kind !== 'musician-for-band') continue;
        if (
          !matchesMusicianRequest(
            { instrumentId: other.details.instrumentId },
            { instrumentId: myInstrumentId },
          )
        ) {
          continue;
        }
        matches.push({
          myRequest: { id: mine.id, kind: 'band-for-musician' },
          counterpart: {
            ...emptyCounterpartShape(),
            id: other.id,
            kind: 'musician-for-band',
            sourceUserId: other.sourceUserId,
            bandId: other.anchorBandId,
            bandName: other.bandName,
            bandImageUrl: other.bandImageUrl,
            instrumentId: other.details.instrumentId,
            instrumentName:
              instrumentNameById.get(other.details.instrumentId) ?? null,
          },
        });
      }
    }
  }

  return matches;
}
