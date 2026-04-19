// Pure input-shaping helpers for the Post Request screen.
//
// Split into `src/utils/` so they can be unit-tested in isolation from
// React Native / Expo Router module graph (the mobile `vitest` config only
// collects tests under `src/utils/`).
//
// Each helper takes the raw text-input values (strings) off the form and
// returns the narrow, Zod-ready tRPC input payload. Empty/whitespace-only
// fields are dropped rather than serialised as empty strings or NaN so the
// server sees "not provided" as absent keys.

export interface MusicianForBandInput {
  kind: 'musician-for-band';
  bandId: number;
  instrument: string;
  style?: string;
  rehearsalCommitment?: string;
}

export interface BandForGigSlotInput {
  kind: 'band-for-gig-slot';
  gigId: number;
  setLength?: number;
  feeOffered?: number;
}

/**
 * Filters `bands.list` down to bands where the caller is a member.
 *
 * `userId` comes from the JWT `sub` claim (a string). Band member ids are
 * numbers, so we coerce once here rather than at every comparison.
 */
export function filterMyBands<B extends { members: { id: number }[] }>(
  bands: B[],
  userId: string,
): B[] {
  const uid = Number(userId);
  if (!Number.isFinite(uid)) return [];
  return bands.filter((band) => band.members.some((m) => m.id === uid));
}

export function buildMusicianForBandInput(args: {
  bandId: number;
  instrument: string;
  style: string;
  rehearsalCommitment: string;
}): MusicianForBandInput {
  const payload: MusicianForBandInput = {
    kind: 'musician-for-band',
    bandId: args.bandId,
    instrument: args.instrument.trim(),
  };
  const style = args.style.trim();
  if (style.length > 0) payload.style = style;
  const commitment = args.rehearsalCommitment.trim();
  if (commitment.length > 0) payload.rehearsalCommitment = commitment;
  return payload;
}

export function buildBandForGigSlotInput(args: {
  gigId: number;
  setLength: string;
  feeOffered: string;
}): BandForGigSlotInput {
  const payload: BandForGigSlotInput = {
    kind: 'band-for-gig-slot',
    gigId: args.gigId,
  };
  const setLength = Number.parseInt(args.setLength.trim(), 10);
  if (Number.isFinite(setLength) && setLength > 0) payload.setLength = setLength;
  const feeOffered = Number.parseInt(args.feeOffered.trim(), 10);
  if (Number.isFinite(feeOffered) && feeOffered >= 0) {
    payload.feeOffered = feeOffered;
  }
  return payload;
}
