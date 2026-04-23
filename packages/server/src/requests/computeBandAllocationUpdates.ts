// Pure helper for MUS-58 band-allocation invariant.
//
// When a `band-for-musician` EoI is accepted for band B and the joining
// musician's instrument is I, every open `musician-for-band` request where
// `anchor_band_id = B` AND `details.instrumentId` equals I must have its
// slot counters advanced and potentially auto-close. If a sibling
// auto-closes, every pending EoI still outstanding against it must be
// auto-rejected.
//
// Mirrors MUS-57's `computeGigAllocationUpdates` exactly, but:
//   - the anchor is a band (not a gig), and
//   - the discriminator is instrument id (not slot index).
//
// MUS-68: instruments are now compared by id against the controlled
// taxonomy — no normalisation needed. Siblings whose instrumentId doesn't
// match are left untouched — a drummer joining doesn't affect the band's
// open bass-player search.
//
// Kept dependency-free so it can be unit-tested in isolation. The
// infrastructure-side caller (`respondToEoi`) fetches the siblings + their
// pending EoI ids in one batched pass and applies the returned updates inside
// the same transaction.

import { computeSlotOutcome } from './computeSlotOutcome.js';

export interface BandSiblingRequest {
  id: number;
  slotsFilled: number;
  slotCount: number;
  /** The `details.instrumentId` from the sibling `musician-for-band` request. */
  instrumentId: number;
  pendingEoiIds: number[];
}

export interface BandSiblingUpdate {
  id: number;
  newSlotsFilled: number;
  shouldClose: boolean;
  eoiIdsToAutoReject: number[];
}

/**
 * Given the pre-update state of the sibling `musician-for-band` requests
 * anchored to a band that just had a member allocated (plus each sibling's
 * currently-pending EoI ids and the joining musician's instrumentId),
 * returns the per-request updates to apply for those siblings whose
 * instrumentId matches.
 *
 * Non-matching-instrument siblings are omitted entirely from the result so
 * the caller can blindly apply every returned update without a second check.
 *
 * Callers are expected to filter the sibling list to requests that are
 * currently `status = 'open'` and anchored to the same band; this helper
 * treats every input as allocatable and computes the naive outcome for the
 * ones matching on instrument.
 */
export function computeBandAllocationUpdates(
  siblings: BandSiblingRequest[],
  joiningInstrumentId: number,
): BandSiblingUpdate[] {
  if (joiningInstrumentId <= 0) return [];
  const updates: BandSiblingUpdate[] = [];
  for (const sib of siblings) {
    if (sib.instrumentId <= 0 || sib.instrumentId !== joiningInstrumentId) {
      continue;
    }
    const { newSlotsFilled, shouldCloseRequest } = computeSlotOutcome(
      sib.slotsFilled,
      sib.slotCount,
      'accepted',
    );
    updates.push({
      id: sib.id,
      newSlotsFilled,
      shouldClose: shouldCloseRequest,
      eoiIdsToAutoReject: shouldCloseRequest ? sib.pendingEoiIds : [],
    });
  }
  return updates;
}
