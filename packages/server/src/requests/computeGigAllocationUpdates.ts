// Pure helper for MUS-57 slot-allocation invariant.
//
// When an EoI accept fills a `gig_slots` row on a gig (whether via a
// `band-for-gig-slot` accept or a `gig-for-band` accept), every open
// `band-for-gig-slot` request anchored to that same gig must have its slot
// counters advanced and potentially auto-close. This helper computes the
// required updates given the prior state of those sibling requests.
//
// Kept dependency-free so it can be unit-tested in isolation. The
// infrastructure-side caller (`respondToEoi`) fetches the sibling rows and
// applies the returned updates inside the same transaction.

import { computeSlotOutcome } from './computeSlotOutcome.js';

export interface SiblingRequest {
  id: number;
  slotsFilled: number;
  slotCount: number;
}

export interface SiblingUpdate {
  id: number;
  newSlotsFilled: number;
  shouldClose: boolean;
}

/**
 * Given the pre-update state of the sibling `band-for-gig-slot` requests
 * anchored to a gig that just had a slot allocated, returns the per-request
 * updates to apply (new slots_filled + whether to close).
 *
 * Callers are expected to filter the sibling list to requests that are
 * currently `status = 'open'`; this helper treats every input as allocatable
 * and computes the naive outcome.
 */
export function computeGigAllocationUpdates(
  siblings: SiblingRequest[],
): SiblingUpdate[] {
  return siblings.map((sib) => {
    const { newSlotsFilled, shouldCloseRequest } = computeSlotOutcome(
      sib.slotsFilled,
      sib.slotCount,
      'accepted',
    );
    return {
      id: sib.id,
      newSlotsFilled,
      shouldClose: shouldCloseRequest,
    };
  });
}
