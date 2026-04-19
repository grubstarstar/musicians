// Pure match rule for MUS-57 counterpart discovery.
//
// Given a `band-for-gig-slot` request (promoter side, anchored to an existing
// gig with a datetime + venue city) and a `gig-for-band` request (band side,
// a date + optional area + optional fee ask), decide whether they constitute
// a match.
//
// Kept dependency-free so it can be unit-tested without any DB or tRPC
// surface, and called from the router's `matches.listForUser` query against
// values already hydrated by that query's join.
//
// Rules (documented for future readers and codified in the tests):
//
// 1. Date: `bandForGigSlot.gigDate` must equal `gigForBand.targetDate` at day
//    granularity — trailing time, timezone offset, etc. are ignored. Both
//    inputs are expected to be ISO strings; we compare the `yyyy-mm-dd`
//    prefix so an input with or without a time component works identically.
//
// 2. Area: if BOTH sides specify area/city, require a case-insensitive
//    substring match in either direction (so "Melbourne" matches
//    "melbourne cbd" and vice-versa). We trim whitespace before comparing.
//    If either side is missing we don't block — the bands/promoters opted
//    into broader matching by leaving it off.
//
// 3. Fee: if BOTH sides specify a fee, the promoter's `feeOffered` must be
//    >= the band's `feeAsked`. If either is missing we don't block — the
//    parties can negotiate off-band. The feeOffered >= feeAsked rule is
//    deliberately simple: the promoter's bar must meet the band's floor.

export interface BandForGigSlotMatchInput {
  /**
   * The datetime of the anchor gig (ISO string). Only the date portion is
   * compared. Passed as a string rather than a `Date` to keep the helper
   * infra-free and to make call-sites explicit about the representation.
   */
  gigDate: string;
  /** Freeform venue city for fuzzy area matching. Optional. */
  gigVenueCity?: string;
  /** Fee the promoter is offering for this slot (cents). Optional. */
  feeOffered?: number;
}

export interface GigForBandMatchInput {
  /** Band-supplied target date (ISO `yyyy-mm-dd`, no time component). */
  targetDate: string;
  /** Freeform area the band is willing to travel to. Optional. */
  area?: string;
  /** Minimum fee the band wants for the gig (cents). Optional. */
  feeAsked?: number;
}

/** Extract the `yyyy-mm-dd` prefix of an ISO date string. */
function isoDay(value: string): string {
  // Works for `yyyy-mm-dd`, `yyyy-mm-ddThh:mm:ssZ`, `yyyy-mm-dd hh:mm:ss+00`
  // — all of which we might see across Postgres timestamptz serialisation and
  // a raw `targetDate` field. If the format is wildly off we return the input
  // as-is; the === compare will then safely reject the match.
  return value.slice(0, 10);
}

/** True if `a` contains `b` (case-insensitive, trimmed) or vice-versa. */
function fuzzyAreaMatch(a: string, b: string): boolean {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (na.length === 0 || nb.length === 0) return false;
  return na.includes(nb) || nb.includes(na);
}

export function matchesGigRequest(
  bandForGigSlot: BandForGigSlotMatchInput,
  gigForBand: GigForBandMatchInput,
): boolean {
  // 1. Date gate — strictest rule, short-circuits the rest.
  if (isoDay(bandForGigSlot.gigDate) !== isoDay(gigForBand.targetDate)) {
    return false;
  }

  // 2. Area: only block when BOTH sides specified an area and they don't overlap.
  if (
    bandForGigSlot.gigVenueCity !== undefined &&
    gigForBand.area !== undefined &&
    !fuzzyAreaMatch(bandForGigSlot.gigVenueCity, gigForBand.area)
  ) {
    return false;
  }

  // 3. Fee: only block when BOTH sides specified a fee and the promoter's
  //    offer is below the band's ask.
  if (
    bandForGigSlot.feeOffered !== undefined &&
    gigForBand.feeAsked !== undefined &&
    bandForGigSlot.feeOffered < gigForBand.feeAsked
  ) {
    return false;
  }

  return true;
}
