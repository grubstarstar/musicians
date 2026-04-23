// Pure match rule for MUS-58 musician-for-band ↔ band-for-musician pairs.
//
// Given a `musician-for-band` request (band side, asking for someone who
// plays some instrument) and a `band-for-musician` request (musician side,
// advertising an instrument) decide whether they constitute a match.
//
// MUS-68: rule is now strict `instrumentId` equality against the controlled
// `instruments` taxonomy. Free-text fallbacks ("bass" vs "bass guitar"
// typos) are resolved to the canonical "Other" row at write time; that row
// still id-matches itself, which keeps the slot-close invariant consistent
// without forcing a nullable column.
//
// Kept dependency-free so it can be unit-tested without any DB or tRPC
// surface, same structure as MUS-57's `matchesGigRequest` and MUS-58's
// `matchesNightAtVenue`.

export interface MusicianForBandMatchInput {
  /** Instrument id the band is asking for (from the taxonomy). */
  instrumentId: number;
}

export interface BandForMusicianMatchInput {
  /** Instrument id the musician advertises (from the taxonomy). */
  instrumentId: number;
}

export function matchesMusicianRequest(
  musicianForBand: MusicianForBandMatchInput,
  bandForMusician: BandForMusicianMatchInput,
): boolean {
  // Zero / negative ids shouldn't match at all — they indicate a missing or
  // malformed row and surfacing them as matches would be misleading.
  if (musicianForBand.instrumentId <= 0) return false;
  if (bandForMusician.instrumentId <= 0) return false;
  return musicianForBand.instrumentId === bandForMusician.instrumentId;
}
