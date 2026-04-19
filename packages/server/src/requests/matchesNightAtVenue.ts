// Pure match rule for MUS-58 night-at-venue ↔ promoter-for-venue-night pairs.
//
// Given a `night-at-venue` request (promoter side, carrying a set of possible
// dates) and a `promoter-for-venue-night` request (venue rep side, carrying a
// single proposed date) decide whether they constitute a match.
//
// Rule is deliberately minimal for this first-pass slice: the proposed date
// must appear in the possibleDates list (string equality, no fuzz). Concept
// overlap and area matching are out of scope — the ticket defers both.
//
// Kept dependency-free so it can be unit-tested without any DB or tRPC
// surface, same structure as MUS-57's `matchesGigRequest`.

export interface NightAtVenueMatchInput {
  /**
   * ISO yyyy-mm-dd strings the promoter could run the night on. Non-empty by
   * contract (validated at the tRPC boundary), but we treat an empty array
   * here as "no possible match" rather than throwing.
   */
  possibleDates: string[];
}

export interface PromoterForVenueNightMatchInput {
  /** ISO yyyy-mm-dd the venue rep has available. */
  proposedDate: string;
}

export function matchesNightAtVenue(
  nightAtVenue: NightAtVenueMatchInput,
  promoterForVenueNight: PromoterForVenueNightMatchInput,
): boolean {
  return nightAtVenue.possibleDates.includes(promoterForVenueNight.proposedDate);
}
