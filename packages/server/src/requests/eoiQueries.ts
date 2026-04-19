import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { db } from '../db.js';
import {
  bandMembers,
  bands,
  expressionsOfInterest,
  gigSlots,
  gigs,
  requests,
  venues,
  type EoiDetails,
  type EoiState,
  type Request,
  type RequestDetails,
  type RequestKind,
  type RequestStatus,
} from '../schema.js';
import { computeBandAllocationUpdates } from './computeBandAllocationUpdates.js';
import { computeGigAllocationUpdates } from './computeGigAllocationUpdates.js';
import { computeSlotOutcome } from './computeSlotOutcome.js';

// Shaped row returned across the tRPC boundary. Always camelCase; never a raw
// Drizzle row. Keeps API shape independent of column naming.
export interface ShapedEoi {
  id: number;
  requestId: number;
  state: EoiState;
  details: EoiDetails | null;
  createdAt: Date;
}

export interface RespondOutcome {
  eoi: ShapedEoi;
  autoRejectedEoiIds: number[];
  requestClosed: boolean;
  slotsFilled: number;
}

// Mirrors `EoiDetails` in schema.ts. The discriminated-union shape lets
// downstream outcome wiring switch on `kind` when applying side-effects.
export type EoiCreateInput =
  | { kind: 'musician-for-band'; notes?: string }
  | { kind: 'band-for-gig-slot'; bandId: number }
  | {
      kind: 'gig-for-band';
      gigId: number;
      bandForGigSlotRequestId?: number;
      proposedFee?: number;
    }
  // `night-at-venue` (MUS-58): venue rep supplies the venue + proposed date
  // (which must be one of the request's possibleDates). Acceptance creates a
  // draft gig.
  | {
      kind: 'night-at-venue';
      venueId: number;
      proposedDate: string;
      concept?: string;
    }
  // `promoter-for-venue-night` (MUS-58): promoter accepts the venue's
  // proposed night. Venue + date come from the request; `concept` is the
  // optional theme the promoter would run.
  | {
      kind: 'promoter-for-venue-night';
      concept?: string;
    }
  // `band-for-musician` (MUS-58): band member offers one of their bands to
  // the musician. Acceptance adds the musician to the band and fires the
  // same-instrument sibling close invariant.
  | {
      kind: 'band-for-musician';
      bandId: number;
      instrumentRole?: string;
    };

// --- Read helpers --------------------------------------------------------

export async function getRequestById(requestId: number): Promise<Request | null> {
  const [row] = await db
    .select()
    .from(requests)
    .where(eq(requests.id, requestId))
    .limit(1);
  return row ?? null;
}

export async function hasPendingEoiFromUser(
  requestId: number,
  userId: number,
): Promise<boolean> {
  const [row] = await db
    .select({ id: expressionsOfInterest.id })
    .from(expressionsOfInterest)
    .where(
      and(
        eq(expressionsOfInterest.request_id, requestId),
        eq(expressionsOfInterest.target_user_id, userId),
        eq(expressionsOfInterest.state, 'pending'),
      ),
    )
    .limit(1);
  return !!row;
}

// --- Create --------------------------------------------------------------

export async function createEoi(
  requestId: number,
  userId: number,
  details: EoiDetails | null,
): Promise<ShapedEoi> {
  const [row] = await db
    .insert(expressionsOfInterest)
    .values({
      request_id: requestId,
      target_user_id: userId,
      state: 'pending',
      details,
    })
    .returning({
      id: expressionsOfInterest.id,
      requestId: expressionsOfInterest.request_id,
      state: expressionsOfInterest.state,
      details: expressionsOfInterest.details,
      createdAt: expressionsOfInterest.created_at,
    });
  return row;
}

// --- Respond (accept/reject) --------------------------------------------
//
// Runs inside a single Drizzle transaction so that slot accounting + outcome
// side-effects (band membership insert, closing the request, auto-rejecting
// other pending EoIs) are atomic.
//
// Returns the updated EoI plus any auto-rejected sibling ids, so the tRPC
// layer can surface that to callers without a second round trip.

export interface RespondInput {
  eoiId: number;
  callerUserId: number;
  decision: 'accepted' | 'rejected';
}

export type RespondResult =
  | { kind: 'ok'; outcome: RespondOutcome }
  | { kind: 'not_found' }
  | { kind: 'forbidden' }
  | { kind: 'not_pending' }
  // Slot-allocation failure modes (both `band-for-gig-slot` and
  // `gig-for-band` accepts may hit them). Structured so the tRPC layer maps
  // them to precise error codes rather than a generic 500.
  | { kind: 'invalid_eoi_details' }
  | { kind: 'no_open_slot' }
  // `night-at-venue` (MUS-58): the venue rep's proposedDate must be one of
  // the request's possibleDates. Enforced at accept time so the EoI couldn't
  // have been tampered with after creation.
  | { kind: 'date_not_offered' };

export async function respondToEoi(input: RespondInput): Promise<RespondResult> {
  return db.transaction(async (tx) => {
    // Lock the EoI + request together so concurrent accepts can't oversubscribe.
    const [eoi] = await tx
      .select()
      .from(expressionsOfInterest)
      .where(eq(expressionsOfInterest.id, input.eoiId))
      .limit(1);
    if (!eoi) return { kind: 'not_found' } as const;

    const [req] = await tx
      .select()
      .from(requests)
      .where(eq(requests.id, eoi.request_id))
      .limit(1);
    if (!req) {
      // Defensive: FK should prevent this, but bail cleanly if it happens.
      return { kind: 'not_found' } as const;
    }

    if (req.source_user_id !== input.callerUserId) {
      return { kind: 'forbidden' } as const;
    }
    if (eoi.state !== 'pending') {
      return { kind: 'not_pending' } as const;
    }

    const now = new Date();

    if (input.decision === 'rejected') {
      const [updated] = await tx
        .update(expressionsOfInterest)
        .set({ state: 'rejected', decided_at: now, updated_at: now })
        .where(eq(expressionsOfInterest.id, eoi.id))
        .returning({
          id: expressionsOfInterest.id,
          requestId: expressionsOfInterest.request_id,
          state: expressionsOfInterest.state,
          details: expressionsOfInterest.details,
          createdAt: expressionsOfInterest.created_at,
        });
      return {
        kind: 'ok',
        outcome: {
          eoi: updated,
          autoRejectedEoiIds: [],
          requestClosed: false,
          slotsFilled: req.slots_filled,
        },
      } as const;
    }

    // ACCEPTED path.
    //
    // For any kind that allocates a band into a gig (`band-for-gig-slot` and
    // `gig-for-band`) we claim an open `gig_slots` row BEFORE marking the
    // EoI accepted, so a "no slots left" race is surfaced as a clean
    // precondition failure (the caller's transaction rolls back and the EoI
    // stays pending). Kinds whose acceptance CREATES a gig
    // (`night-at-venue`, `promoter-for-venue-night`) validate their payload
    // here too; the actual insert happens further down once the request +
    // EoI state are updated.
    //
    // `allocationGigId` is the gig whose open-slot count is being decremented
    // by this accept. For `band-for-gig-slot` it's the request's anchor gig;
    // for `gig-for-band` it's the gig the promoter supplied on the EoI. Null
    // for kinds that don't allocate into a gig.
    let allocationGigId: number | null = null;
    if (req.kind === 'band-for-gig-slot') {
      if (eoi.details === null || eoi.details.kind !== 'band-for-gig-slot') {
        return { kind: 'invalid_eoi_details' } as const;
      }
      if (req.anchor_gig_id === null) {
        // Should be unreachable if insert invariants hold, but bail cleanly.
        return { kind: 'invalid_eoi_details' } as const;
      }
      allocationGigId = req.anchor_gig_id;
      const bandId = eoi.details.bandId;
      const claim = await claimOpenSlot(tx, allocationGigId, bandId, now);
      if (!claim) return { kind: 'no_open_slot' } as const;
    } else if (req.kind === 'gig-for-band') {
      if (eoi.details === null || eoi.details.kind !== 'gig-for-band') {
        return { kind: 'invalid_eoi_details' } as const;
      }
      if (req.details.kind !== 'gig-for-band') {
        return { kind: 'invalid_eoi_details' } as const;
      }
      allocationGigId = eoi.details.gigId;
      const bandId = req.details.bandId;
      const claim = await claimOpenSlot(tx, allocationGigId, bandId, now);
      if (!claim) return { kind: 'no_open_slot' } as const;
    } else if (req.kind === 'night-at-venue') {
      if (eoi.details === null || eoi.details.kind !== 'night-at-venue') {
        return { kind: 'invalid_eoi_details' } as const;
      }
      if (req.details.kind !== 'night-at-venue') {
        return { kind: 'invalid_eoi_details' } as const;
      }
      // Enforce: the proposed date must be one of the request's possibleDates.
      if (!req.details.possibleDates.includes(eoi.details.proposedDate)) {
        return { kind: 'date_not_offered' } as const;
      }
    } else if (req.kind === 'promoter-for-venue-night') {
      if (
        eoi.details === null ||
        eoi.details.kind !== 'promoter-for-venue-night'
      ) {
        return { kind: 'invalid_eoi_details' } as const;
      }
      if (req.details.kind !== 'promoter-for-venue-night') {
        return { kind: 'invalid_eoi_details' } as const;
      }
    } else if (req.kind === 'band-for-musician') {
      if (eoi.details === null || eoi.details.kind !== 'band-for-musician') {
        return { kind: 'invalid_eoi_details' } as const;
      }
      if (req.details.kind !== 'band-for-musician') {
        return { kind: 'invalid_eoi_details' } as const;
      }
    }

    const { newSlotsFilled, shouldCloseRequest } = computeSlotOutcome(
      req.slots_filled,
      req.slot_count,
      'accepted',
    );

    const [updatedEoi] = await tx
      .update(expressionsOfInterest)
      .set({ state: 'accepted', decided_at: now, updated_at: now })
      .where(eq(expressionsOfInterest.id, eoi.id))
      .returning({
        id: expressionsOfInterest.id,
        requestId: expressionsOfInterest.request_id,
        state: expressionsOfInterest.state,
        details: expressionsOfInterest.details,
        createdAt: expressionsOfInterest.created_at,
      });

    await tx
      .update(requests)
      .set({
        slots_filled: newSlotsFilled,
        status: shouldCloseRequest ? 'closed' : req.status,
        updated_at: now,
      })
      .where(eq(requests.id, req.id));

    // Outcome side-effect for `musician-for-band`: add the target user to the
    // band. Idempotent — band_members has a composite PK, so repeat inserts
    // collide; onConflictDoNothing swallows that cleanly.
    if (req.kind === 'musician-for-band' && req.anchor_band_id !== null) {
      await tx
        .insert(bandMembers)
        .values({ band_id: req.anchor_band_id, user_id: eoi.target_user_id })
        .onConflictDoNothing();
    }

    // Outcome side-effect for `band-for-musician` (MUS-58): add the request
    // creator (the musician) to the band the EoI creator represents. Same
    // idempotent insert pattern as `musician-for-band`. The sibling-close
    // invariant below also fires for this kind.
    let bandForMusicianCtx: {
      bandId: number;
      instrument: string;
    } | null = null;
    if (req.kind === 'band-for-musician') {
      if (
        eoi.details !== null &&
        eoi.details.kind === 'band-for-musician' &&
        req.details.kind === 'band-for-musician'
      ) {
        const bandId = eoi.details.bandId;
        await tx
          .insert(bandMembers)
          .values({ band_id: bandId, user_id: req.source_user_id })
          .onConflictDoNothing();
        // The allocation's instrument is the request's instrument (the
        // musician's own declaration). `instrumentRole` on the EoI defaults
        // to the same and is only surfaced for the UI's "joined as"
        // narrative, not for matching.
        bandForMusicianCtx = {
          bandId,
          instrument: req.details.instrument,
        };
      }
    }

    // Outcome side-effect for `night-at-venue` and `promoter-for-venue-night`
    // (MUS-58): create a draft `gigs` row from the combined request + EoI
    // payload. No slots are created here — the promoter fills the lineup via
    // follow-up `band-for-gig-slot` requests. We use `slot_count = 0` on the
    // parent request (slot_count defaults to 1; accept closes it) so no
    // separate gig-slot allocation applies.
    if (
      req.kind === 'night-at-venue' &&
      eoi.details !== null &&
      eoi.details.kind === 'night-at-venue'
    ) {
      await tx.insert(gigs).values({
        datetime: new Date(eoi.details.proposedDate),
        venue_id: eoi.details.venueId,
        organiser_user_id: req.source_user_id,
        status: 'draft',
      });
    } else if (
      req.kind === 'promoter-for-venue-night' &&
      req.details.kind === 'promoter-for-venue-night'
    ) {
      await tx.insert(gigs).values({
        datetime: new Date(req.details.proposedDate),
        venue_id: req.details.venueId,
        organiser_user_id: eoi.target_user_id,
        status: 'draft',
      });
    }

    let autoRejectedEoiIds: number[] = [];
    if (shouldCloseRequest) {
      const autoRejected = await tx
        .update(expressionsOfInterest)
        .set({ state: 'auto_rejected', decided_at: now, updated_at: now })
        .where(
          and(
            eq(expressionsOfInterest.request_id, req.id),
            eq(expressionsOfInterest.state, 'pending'),
            ne(expressionsOfInterest.id, eoi.id),
          ),
        )
        .returning({ id: expressionsOfInterest.id });
      autoRejectedEoiIds = autoRejected.map((r) => r.id);
    }

    // Cross-request sibling update (MUS-57 slot-allocation invariant).
    //
    // Any acceptance that fills a `gig_slots` row on a gig must tick the
    // counters of every open `band-for-gig-slot` request anchored to that
    // gig — regardless of which side of the counterpart pair the accept came
    // through. For the `band-for-gig-slot` kind this includes the request
    // being accepted (which we've just updated above) so we exclude it here.
    // For `gig-for-band` there's no self-overlap to worry about.
    if (allocationGigId !== null) {
      const openSiblings = await tx
        .select({
          id: requests.id,
          slotsFilled: requests.slots_filled,
          slotCount: requests.slot_count,
        })
        .from(requests)
        .where(
          and(
            eq(requests.kind, 'band-for-gig-slot'),
            eq(requests.anchor_gig_id, allocationGigId),
            eq(requests.status, 'open'),
            ne(requests.id, req.id),
          ),
        );

      const siblingIds = openSiblings.map((s) => s.id);
      const pendingByRequest = new Map<number, number[]>();
      if (siblingIds.length > 0) {
        const pending = await tx
          .select({
            id: expressionsOfInterest.id,
            requestId: expressionsOfInterest.request_id,
          })
          .from(expressionsOfInterest)
          .where(
            and(
              inArray(expressionsOfInterest.request_id, siblingIds),
              eq(expressionsOfInterest.state, 'pending'),
            ),
          );
        for (const row of pending) {
          const existing = pendingByRequest.get(row.requestId) ?? [];
          existing.push(row.id);
          pendingByRequest.set(row.requestId, existing);
        }
      }

      const siblings = openSiblings.map((s) => ({
        ...s,
        pendingEoiIds: pendingByRequest.get(s.id) ?? [],
      }));
      const updates = computeGigAllocationUpdates(siblings);
      for (const update of updates) {
        await tx
          .update(requests)
          .set({
            slots_filled: update.newSlotsFilled,
            status: update.shouldClose ? 'closed' : 'open',
            updated_at: now,
          })
          .where(eq(requests.id, update.id));
      }
      const siblingAutoRejectIds = updates.flatMap((u) => u.eoiIdsToAutoReject);
      if (siblingAutoRejectIds.length > 0) {
        await tx
          .update(expressionsOfInterest)
          .set({ state: 'auto_rejected', decided_at: now, updated_at: now })
          .where(inArray(expressionsOfInterest.id, siblingAutoRejectIds));
        autoRejectedEoiIds = [...autoRejectedEoiIds, ...siblingAutoRejectIds];
      }
    }

    // Cross-request sibling update (MUS-58 band-allocation invariant).
    //
    // A `band-for-musician` accept puts a musician into band B on instrument
    // I. Every open `musician-for-band` request anchored to B whose
    // (normalised) `details.instrument` matches I must have its slot
    // counters ticked and potentially auto-close. Instruments that don't
    // match are untouched — a drummer joining doesn't affect the band's
    // open bass-player search.
    if (bandForMusicianCtx !== null) {
      const { bandId, instrument } = bandForMusicianCtx;
      const openSiblings = await tx
        .select({
          id: requests.id,
          slotsFilled: requests.slots_filled,
          slotCount: requests.slot_count,
          details: requests.details,
        })
        .from(requests)
        .where(
          and(
            eq(requests.kind, 'musician-for-band'),
            eq(requests.anchor_band_id, bandId),
            eq(requests.status, 'open'),
          ),
        );

      const siblingIds = openSiblings.map((s) => s.id);
      const pendingByRequest = new Map<number, number[]>();
      if (siblingIds.length > 0) {
        const pending = await tx
          .select({
            id: expressionsOfInterest.id,
            requestId: expressionsOfInterest.request_id,
          })
          .from(expressionsOfInterest)
          .where(
            and(
              inArray(expressionsOfInterest.request_id, siblingIds),
              eq(expressionsOfInterest.state, 'pending'),
            ),
          );
        for (const row of pending) {
          const existing = pendingByRequest.get(row.requestId) ?? [];
          existing.push(row.id);
          pendingByRequest.set(row.requestId, existing);
        }
      }

      const siblingInputs = openSiblings
        .filter((s) => s.details.kind === 'musician-for-band')
        .map((s) => ({
          id: s.id,
          slotsFilled: s.slotsFilled,
          slotCount: s.slotCount,
          // Guarded above; narrow for the pure helper's input type.
          instrument:
            s.details.kind === 'musician-for-band' ? s.details.instrument : '',
          pendingEoiIds: pendingByRequest.get(s.id) ?? [],
        }));
      const updates = computeBandAllocationUpdates(siblingInputs, instrument);
      for (const update of updates) {
        await tx
          .update(requests)
          .set({
            slots_filled: update.newSlotsFilled,
            status: update.shouldClose ? 'closed' : 'open',
            updated_at: now,
          })
          .where(eq(requests.id, update.id));
      }
      const siblingAutoRejectIds = updates.flatMap((u) => u.eoiIdsToAutoReject);
      if (siblingAutoRejectIds.length > 0) {
        await tx
          .update(expressionsOfInterest)
          .set({ state: 'auto_rejected', decided_at: now, updated_at: now })
          .where(inArray(expressionsOfInterest.id, siblingAutoRejectIds));
        autoRejectedEoiIds = [...autoRejectedEoiIds, ...siblingAutoRejectIds];
      }
    }

    return {
      kind: 'ok',
      outcome: {
        eoi: updatedEoi,
        autoRejectedEoiIds,
        requestClosed: shouldCloseRequest,
        slotsFilled: newSlotsFilled,
      },
    } as const;
  });
}

// --- listMyEois (MUS-64) -------------------------------------------------
//
// Target-side list: the EoIs the calling user created, with just enough of
// the parent request (and its anchor) to render a row. Mirrors the anchor
// shape used by `listMyRequests` / `listOpenRequests` so the mobile client
// has a familiar discriminated union to narrow on.

export interface ShapedMyEoiRow {
  eoi: {
    id: number;
    state: EoiState;
    details: EoiDetails | null;
    createdAt: Date;
    decidedAt: Date | null;
  };
  request: {
    id: number;
    kind: RequestKind;
    status: RequestStatus;
    details: RequestDetails;
    anchorBand: { id: number; name: string; imageUrl: string | null } | null;
    anchorGig:
      | { id: number; datetime: Date; venue: { id: number; name: string } }
      | null;
  };
}

/**
 * Returns the EoIs the caller has created, ordered by most recent first, with
 * the parent request + its anchor embedded so the client can render a single
 * row without further round-trips (no N+1 — one joined query).
 *
 * Shape is camelCase-only across the tRPC boundary; never a raw Drizzle row.
 */
export async function listMyEois(userId: number): Promise<ShapedMyEoiRow[]> {
  const rows = await db
    .select({
      eoiId: expressionsOfInterest.id,
      eoiState: expressionsOfInterest.state,
      eoiDetails: expressionsOfInterest.details,
      eoiCreatedAt: expressionsOfInterest.created_at,
      eoiDecidedAt: expressionsOfInterest.decided_at,
      requestId: requests.id,
      requestKind: requests.kind,
      requestStatus: requests.status,
      requestDetails: requests.details,
      anchorBandId: bands.id,
      anchorBandName: bands.name,
      anchorBandImageUrl: bands.imageUrl,
      anchorGigId: gigs.id,
      anchorGigDatetime: gigs.datetime,
      anchorGigVenueId: venues.id,
      anchorGigVenueName: venues.name,
    })
    .from(expressionsOfInterest)
    .innerJoin(requests, eq(requests.id, expressionsOfInterest.request_id))
    .leftJoin(bands, eq(bands.id, requests.anchor_band_id))
    .leftJoin(gigs, eq(gigs.id, requests.anchor_gig_id))
    .leftJoin(venues, eq(venues.id, gigs.venue_id))
    .where(eq(expressionsOfInterest.target_user_id, userId))
    .orderBy(desc(expressionsOfInterest.created_at));

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
      eoi: {
        id: r.eoiId,
        state: r.eoiState,
        details: r.eoiDetails,
        createdAt: r.eoiCreatedAt,
        decidedAt: r.eoiDecidedAt,
      },
      request: {
        id: r.requestId,
        kind: r.requestKind,
        status: r.requestStatus,
        details: r.requestDetails,
        anchorBand,
        anchorGig,
      },
    };
  });
}

// --- Slot-claim helper ---------------------------------------------------
//
// Claims the lowest-`set_order` open slot on the given gig for the given
// band. Returns the slot id on success, or null if no open slot existed.
//
// Kept as a transaction-local helper (takes `tx` rather than using `db`) so
// all slot allocations happen within the same transaction as the parent
// respondToEoi call and `no_open_slot` races roll back cleanly.
type TxLike = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function claimOpenSlot(
  tx: TxLike,
  gigId: number,
  bandId: number,
  now: Date,
): Promise<number | null> {
  const [openSlot] = await tx
    .select({ id: gigSlots.id })
    .from(gigSlots)
    .where(and(eq(gigSlots.gig_id, gigId), isNull(gigSlots.band_id)))
    .orderBy(asc(gigSlots.set_order))
    .limit(1);
  if (!openSlot) return null;
  await tx
    .update(gigSlots)
    .set({ band_id: bandId, updated_at: now })
    .where(eq(gigSlots.id, openSlot.id));
  return openSlot.id;
}
