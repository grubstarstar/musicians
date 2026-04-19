import { and, eq, ne } from 'drizzle-orm';
import { db } from '../db.js';
import {
  bandMembers,
  expressionsOfInterest,
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

export type EoiCreateInput = {
  kind: 'musician-for-band';
  notes?: string;
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
  | { kind: 'not_pending' };

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
