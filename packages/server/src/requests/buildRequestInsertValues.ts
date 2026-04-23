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
    }
  // `night-at-venue` (MUS-58): promoter-side request, no anchor object.
  // Acceptance creates a `gigs` row from the EoI payload (venue rep supplies
  // venueId + proposedDate). Slot_count is always 1 — one accept per concept.
  | {
      kind: 'night-at-venue';
      concept: string;
      possibleDates: string[];
    }
  // `promoter-for-venue-night` (MUS-58): venue-side request, no anchor
  // object. Acceptance creates a `gigs` row anchored to the request's
  // venue + date, organised by the accepting promoter.
  | {
      kind: 'promoter-for-venue-night';
      venueId: number;
      proposedDate: string;
      concept?: string;
    }
  // `band-for-musician` (MUS-58): musician-side request, no anchor object.
  // Anchor lives on the EoI side — the accepting band member supplies the
  // bandId they represent. Free-text instrument for this slice.
  | {
      kind: 'band-for-musician';
      instrument: string;
      availability?: string;
      demosUrl?: string;
    }
  // `band_join` (MUS-87): requester (source) asks to join a specific band.
  // Anchored to the band so `listOpenRequests` / `listMyRequests` can render
  // the band without a second lookup. Slot_count = 1 — one accept closes it.
  | {
      kind: 'band_join';
      bandId: number;
    }
  // `promoter_group_join` (MUS-88): requester (source) asks to join a specific
  // promoter group. No anchor column for promoter groups on `requests`, so
  // the target group id only lives in details. Slot_count = 1 — one accept
  // (by any existing group member) closes the request.
  | {
      kind: 'promoter_group_join';
      promoterGroupId: number;
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

  if (input.kind === 'gig-for-band') {
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

  if (input.kind === 'night-at-venue') {
    // night-at-venue (MUS-58): promoter is source, no anchor object. Exactly
    // one accept per concept (slot_count = 1) — acceptance creates a draft gig
    // from the venue rep's EoI payload.
    const details: RequestDetails = {
      kind: 'night-at-venue',
      concept: input.concept,
      possibleDates: input.possibleDates,
    };
    return {
      kind: 'night-at-venue',
      source_user_id: userId,
      anchor_band_id: null,
      anchor_gig_id: null,
      details,
      slot_count: 1,
      slots_filled: 0,
      status: 'open',
    };
  }

  if (input.kind === 'promoter-for-venue-night') {
    // promoter-for-venue-night (MUS-58): venue rep is source, no anchor.
    // Exactly one accept per night (slot_count = 1).
    const details: RequestDetails = {
      kind: 'promoter-for-venue-night',
      venueId: input.venueId,
      proposedDate: input.proposedDate,
      ...(input.concept !== undefined ? { concept: input.concept } : {}),
    };
    return {
      kind: 'promoter-for-venue-night',
      source_user_id: userId,
      anchor_band_id: null,
      anchor_gig_id: null,
      details,
      slot_count: 1,
      slots_filled: 0,
      status: 'open',
    };
  }

  if (input.kind === 'band-for-musician') {
    // band-for-musician (MUS-58): musician is source, no anchor object. Exactly
    // one accept per request — the musician joins the band the EoI creator
    // specifies. Slot_count = 1.
    const details: RequestDetails = {
      kind: 'band-for-musician',
      instrument: input.instrument,
      ...(input.availability !== undefined ? { availability: input.availability } : {}),
      ...(input.demosUrl !== undefined ? { demosUrl: input.demosUrl } : {}),
    };
    return {
      kind: 'band-for-musician',
      source_user_id: userId,
      anchor_band_id: null,
      anchor_gig_id: null,
      details,
      slot_count: 1,
      slots_filled: 0,
      status: 'open',
    };
  }

  if (input.kind === 'band_join') {
    // band_join (MUS-87): requester is the source, the target band is the
    // anchor. Slot_count = 1 — one accept (by any existing band member) closes
    // the request and inserts the requester into `band_members`.
    const details: RequestDetails = {
      kind: 'band_join',
      bandId: input.bandId,
    };
    return {
      kind: 'band_join',
      source_user_id: userId,
      anchor_band_id: input.bandId,
      anchor_gig_id: null,
      details,
      slot_count: 1,
      slots_filled: 0,
      status: 'open',
    };
  }

  // promoter_group_join (MUS-88): requester is the source, the target group
  // id only lives in `details.promoterGroupId` (no promoter-group anchor
  // column on `requests`). Slot_count = 1 — one accept (by any existing
  // group member) closes the request and inserts the requester into
  // `promoters_promoter_groups`.
  const details: RequestDetails = {
    kind: 'promoter_group_join',
    promoterGroupId: input.promoterGroupId,
  };
  return {
    kind: 'promoter_group_join',
    source_user_id: userId,
    anchor_band_id: null,
    anchor_gig_id: null,
    details,
    slot_count: 1,
    slots_filled: 0,
    status: 'open',
  };
}
