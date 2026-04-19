import type { RequestDetails, RequestKind, RequestStatus } from '../schema.js';

// Discriminated union of create-request inputs. One branch per request kind;
// new kinds add a branch here + a case in the switch below. The input shape
// is flat (no nested `details`) because the Zod router layer validates the
// raw user-supplied fields and `details` is a server-assembled JSON blob.
export type RequestCreateInput =
  | {
      kind: 'musician-for-band';
      bandId: number;
      instrument: string;
      style?: string;
      rehearsalCommitment?: string;
    }
  | {
      kind: 'band-for-gig-slot';
      gigId: number;
      setLength?: number;
      feeOffered?: number;
      // Number of open slots at creation time — computed by the caller (the
      // tRPC router) after checking `gig_slots` for this gig. Kept as an
      // explicit field here so this pure helper stays infra-free.
      openSlotCount: number;
    }
  // `gig-for-band` (MUS-57): band-side request, no anchor object. Slot_count
  // is always 1 for this kind — acceptance fills exactly one band into one
  // gig slot on the EoI-supplied gig.
  | {
      kind: 'gig-for-band';
      bandId: number;
      targetDate: string; // ISO yyyy-mm-dd
      area?: string;
      feeAsked?: number;
    };

export interface RequestInsertValues {
  kind: RequestKind;
  source_user_id: number;
  anchor_band_id: number | null;
  anchor_gig_id: number | null;
  details: RequestDetails;
  slot_count: number;
  slots_filled: number;
  status: RequestStatus;
}

export function buildRequestInsertValues(
  input: RequestCreateInput,
  userId: number,
): RequestInsertValues {
  if (input.kind === 'musician-for-band') {
    const details: RequestDetails = {
      kind: 'musician-for-band',
      instrument: input.instrument,
      ...(input.style !== undefined ? { style: input.style } : {}),
      ...(input.rehearsalCommitment !== undefined
        ? { rehearsalCommitment: input.rehearsalCommitment }
        : {}),
    };
    return {
      kind: 'musician-for-band',
      source_user_id: userId,
      anchor_band_id: input.bandId,
      anchor_gig_id: null,
      details,
      slot_count: 1,
      slots_filled: 0,
      status: 'open',
    };
  }

  if (input.kind === 'band-for-gig-slot') {
    const details: RequestDetails = {
      kind: 'band-for-gig-slot',
      gigId: input.gigId,
      ...(input.setLength !== undefined ? { setLength: input.setLength } : {}),
      ...(input.feeOffered !== undefined ? { feeOffered: input.feeOffered } : {}),
    };
    return {
      kind: 'band-for-gig-slot',
      source_user_id: userId,
      anchor_band_id: null,
      anchor_gig_id: input.gigId,
      details,
      // `slot_count` mirrors the number of currently-open slots on the gig so
      // slot accounting (MUS-52) closes the request once every open slot has
      // been filled via accepted EoIs.
      slot_count: input.openSlotCount,
      slots_filled: 0,
      status: 'open',
    };
  }

  // gig-for-band (MUS-57): band is source, no anchor object. Exactly one slot
  // — acceptance fills the band into one gig slot on the EoI-referenced gig.
  const details: RequestDetails = {
    kind: 'gig-for-band',
    bandId: input.bandId,
    targetDate: input.targetDate,
    ...(input.area !== undefined ? { area: input.area } : {}),
    ...(input.feeAsked !== undefined ? { feeAsked: input.feeAsked } : {}),
  };
  return {
    kind: 'gig-for-band',
    source_user_id: userId,
    anchor_band_id: null,
    anchor_gig_id: null,
    details,
    slot_count: 1,
    slots_filled: 0,
    status: 'open',
  };
}
