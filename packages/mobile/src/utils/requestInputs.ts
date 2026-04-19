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

export interface GigForBandInput {
  kind: 'gig-for-band';
  bandId: number;
  targetDate: string; // ISO yyyy-mm-dd
  area?: string;
  feeAsked?: number;
}

export interface NightAtVenueInput {
  kind: 'night-at-venue';
  concept: string;
  possibleDates: string[]; // non-empty list of ISO yyyy-mm-dd
}

export interface PromoterForVenueNightInput {
  kind: 'promoter-for-venue-night';
  venueId: number;
  proposedDate: string; // ISO yyyy-mm-dd
  concept?: string;
}

export interface BandForMusicianInput {
  kind: 'band-for-musician';
  instrument: string;
  availability?: string;
  demosUrl?: string;
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

/**
 * Validates and shapes the gig-for-band form input. `targetDate` must already
 * be a `yyyy-mm-dd` string — the form sets this via a date picker rather than
 * freeform text. We still validate because the Zod server contract rejects
 * anything else, and surfacing the error client-side is kinder than a 400.
 */
export function buildGigForBandInput(args: {
  bandId: number;
  targetDate: string;
  area: string;
  feeAsked: string;
}): GigForBandInput | null {
  const date = args.targetDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const payload: GigForBandInput = {
    kind: 'gig-for-band',
    bandId: args.bandId,
    targetDate: date,
  };
  const area = args.area.trim();
  if (area.length > 0) payload.area = area;
  const feeAsked = Number.parseInt(args.feeAsked.trim(), 10);
  if (Number.isFinite(feeAsked) && feeAsked >= 0) {
    payload.feeAsked = feeAsked;
  }
  return payload;
}

/** Regex for the yyyy-mm-dd shape Zod enforces on every date-string input. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates and shapes a night-at-venue form input. Returns `null` if the
 * concept is blank or `possibleDates` is empty / contains anything other
 * than yyyy-mm-dd strings. All dates are de-duped and sorted to keep
 * downstream comparisons stable.
 */
export function buildNightAtVenueInput(args: {
  concept: string;
  possibleDates: string[];
}): NightAtVenueInput | null {
  const concept = args.concept.trim();
  if (concept.length === 0) return null;
  const unique = Array.from(
    new Set(
      args.possibleDates
        .map((d) => d.trim())
        .filter((d) => ISO_DAY.test(d)),
    ),
  );
  unique.sort();
  if (unique.length === 0) return null;
  return {
    kind: 'night-at-venue',
    concept,
    possibleDates: unique,
  };
}

/**
 * Validates and shapes a promoter-for-venue-night form input. Returns `null`
 * when the proposed date isn't yyyy-mm-dd. `venueId` must already be a valid
 * chosen venue — the form ensures a pick before calling this helper.
 */
export function buildPromoterForVenueNightInput(args: {
  venueId: number;
  proposedDate: string;
  concept: string;
}): PromoterForVenueNightInput | null {
  const date = args.proposedDate.trim();
  if (!ISO_DAY.test(date)) return null;
  const payload: PromoterForVenueNightInput = {
    kind: 'promoter-for-venue-night',
    venueId: args.venueId,
    proposedDate: date,
  };
  const concept = args.concept.trim();
  if (concept.length > 0) payload.concept = concept;
  return payload;
}

/**
 * Validates and shapes a band-for-musician form input. Returns `null` when
 * instrument is blank. Availability / demosUrl are dropped when empty.
 */
export function buildBandForMusicianInput(args: {
  instrument: string;
  availability: string;
  demosUrl: string;
}): BandForMusicianInput | null {
  const instrument = args.instrument.trim();
  if (instrument.length === 0) return null;
  const payload: BandForMusicianInput = {
    kind: 'band-for-musician',
    instrument,
  };
  const availability = args.availability.trim();
  if (availability.length > 0) payload.availability = availability;
  const demosUrl = args.demosUrl.trim();
  if (demosUrl.length > 0) payload.demosUrl = demosUrl;
  return payload;
}
