// Pure match rule for MUS-58 musician-for-band ↔ band-for-musician pairs.
//
// Given a `musician-for-band` request (band side, asking for someone who
// plays some instrument) and a `band-for-musician` request (musician side,
// advertising an instrument) decide whether they constitute a match.
//
// Rule is deliberately simple for this first-pass slice: normalise both
// sides (lowercase + trim) and compare for exact equality. "bass guitar"
// matches "Bass Guitar" but does NOT match "bass" — that's lossy and
// acknowledged in the ticket. MUS-68 swaps this out for an instrument
// taxonomy (`instrumentId` equality) once the controlled list is in place.
//
// Kept dependency-free so it can be unit-tested without any DB or tRPC
// surface, same structure as MUS-57's `matchesGigRequest` and MUS-58's
// `matchesNightAtVenue`.

export interface MusicianForBandMatchInput {
  /** Instrument the band is asking for (free-text, un-normalised). */
  instrument: string;
}

export interface BandForMusicianMatchInput {
  /** Instrument the musician advertises (free-text, un-normalised). */
  instrument: string;
}

/** Normalise an instrument string for comparison: lowercase + trim. */
export function normaliseInstrument(instrument: string): string {
  return instrument.trim().toLowerCase();
}

export function matchesMusicianRequest(
  musicianForBand: MusicianForBandMatchInput,
  bandForMusician: BandForMusicianMatchInput,
): boolean {
  const a = normaliseInstrument(musicianForBand.instrument);
  const b = normaliseInstrument(bandForMusician.instrument);
  // Empty strings shouldn't match at all — an absent/blank field is
  // meaningless for instrument comparison and should never surface as a match.
  if (a.length === 0 || b.length === 0) return false;
  return a === b;
}
