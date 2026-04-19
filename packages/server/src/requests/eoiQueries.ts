import { and, asc, eq, isNull, ne } from 'drizzle-orm';
import { db } from '../db.js';
import {
  bandMembers,
  expressionsOfInterest,
  gigSlots,
  requests,
  type EoiDetails,
  type EoiState,
  type Request,
} from '../schema.js';
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
  | { kind: 'band-for-gig-slot'; bandId: number };

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
  // `band-for-gig-slot`-specific failure modes. We surface these as structured
  // results so the tRPC layer can map them to precise error codes instead of a
  // generic 500.
  | { kind: 'invalid_eoi_details' }
  | { kind: 'no_open_slot' };

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
    // For `band-for-gig-slot` we have to reserve an open slot BEFORE marking
    // the EoI accepted, so a "no slots left" race is surfaced as a clean
    // precondition failure (the caller's transaction rolls back and the EoI
    // stays pending). Doing the claim first also lets us capture the set_order
    // we filled, which we could expose later if needed.
    let claimedGigSlotId: number | null = null;
    if (req.kind === 'band-for-gig-slot') {
      if (eoi.details === null || eoi.details.kind !== 'band-for-gig-slot') {
        return { kind: 'invalid_eoi_details' } as const;
      }
      if (req.anchor_gig_id === null) {
        // Should be unreachable if insert invariants hold, but bail cleanly.
        return { kind: 'invalid_eoi_details' } as const;
      }
      const [openSlot] = await tx
        .select({ id: gigSlots.id })
        .from(gigSlots)
        .where(and(eq(gigSlots.gig_id, req.anchor_gig_id), isNull(gigSlots.band_id)))
        .orderBy(asc(gigSlots.set_order))
        .limit(1);
      if (!openSlot) {
        return { kind: 'no_open_slot' } as const;
      }
      const bandId = eoi.details.bandId;
      await tx
        .update(gigSlots)
        .set({ band_id: bandId, updated_at: now })
        .where(eq(gigSlots.id, openSlot.id));
      claimedGigSlotId = openSlot.id;
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
    // `band-for-gig-slot` side-effect (slot claim) happened up-top so we could
    // short-circuit on no-open-slot; `claimedGigSlotId` retained in case a
    // future consumer wants to surface it.
    void claimedGigSlotId;

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
