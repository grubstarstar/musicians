import { describe, expect, it } from 'vitest';
import {
  buildBandForGigSlotInput,
  buildBandForMusicianInput,
  buildGigForBandInput,
  buildMusicianForBandInput,
  buildNightAtVenueInput,
  buildPromoterForVenueNightInput,
  filterMyBands,
} from './requestInputs';

describe('filterMyBands', () => {
  const bands = [
    { id: 1, name: 'A', members: [{ id: 10 }, { id: 20 }] },
    { id: 2, name: 'B', members: [{ id: 30 }] },
    { id: 3, name: 'C', members: [] },
  ];

  it('returns bands where the user is a member', () => {
    expect(filterMyBands(bands, '10')).toEqual([bands[0]]);
  });

  it('returns an empty array when userId is not numeric', () => {
    expect(filterMyBands(bands, 'not-a-number')).toEqual([]);
  });

  it('returns an empty array when no band contains the user', () => {
    expect(filterMyBands(bands, '99')).toEqual([]);
  });

  it('returns multiple bands when the user is in several', () => {
    const extra = [
      ...bands,
      { id: 4, name: 'D', members: [{ id: 10 }] },
    ];
    expect(filterMyBands(extra, '10').map((b) => b.id)).toEqual([1, 4]);
  });
});

describe('buildMusicianForBandInput', () => {
  it('includes all fields when provided', () => {
    expect(
      buildMusicianForBandInput({
        bandId: 7,
        instrumentId: 42,
        style: ' jazz-funk ',
        rehearsalCommitment: ' weekly ',
      }),
    ).toEqual({
      kind: 'musician-for-band',
      bandId: 7,
      instrumentId: 42,
      style: 'jazz-funk',
      rehearsalCommitment: 'weekly',
    });
  });

  it('omits empty-string optional fields entirely', () => {
    const result = buildMusicianForBandInput({
      bandId: 3,
      instrumentId: 43,
      style: '',
      rehearsalCommitment: '   ',
    });
    expect(result).toEqual({
      kind: 'musician-for-band',
      bandId: 3,
      instrumentId: 43,
    });
    expect(Object.keys(result).sort()).toEqual(['bandId', 'instrumentId', 'kind']);
  });
});

describe('buildBandForGigSlotInput', () => {
  it('parses numeric setLength and feeOffered', () => {
    expect(
      buildBandForGigSlotInput({
        gigId: 42,
        setLength: '45',
        feeOffered: '25000',
        genreId: null,
      }),
    ).toEqual({
      kind: 'band-for-gig-slot',
      gigId: 42,
      setLength: 45,
      feeOffered: 25000,
    });
  });

  it('omits setLength when the field is empty or non-numeric', () => {
    expect(
      buildBandForGigSlotInput({
        gigId: 1,
        setLength: '',
        feeOffered: '',
        genreId: null,
      }),
    ).toEqual({
      kind: 'band-for-gig-slot',
      gigId: 1,
    });
    expect(
      buildBandForGigSlotInput({
        gigId: 1,
        setLength: 'abc',
        feeOffered: '',
        genreId: null,
      }),
    ).toEqual({
      kind: 'band-for-gig-slot',
      gigId: 1,
    });
  });

  it('drops setLength when zero or negative (server requires > 0)', () => {
    expect(
      buildBandForGigSlotInput({
        gigId: 1,
        setLength: '0',
        feeOffered: '',
        genreId: null,
      }),
    ).toEqual({ kind: 'band-for-gig-slot', gigId: 1 });
    expect(
      buildBandForGigSlotInput({
        gigId: 1,
        setLength: '-5',
        feeOffered: '',
        genreId: null,
      }),
    ).toEqual({ kind: 'band-for-gig-slot', gigId: 1 });
  });

  it('accepts feeOffered of 0 (free gig) and drops negative fees', () => {
    expect(
      buildBandForGigSlotInput({
        gigId: 1,
        setLength: '',
        feeOffered: '0',
        genreId: null,
      }),
    ).toEqual({ kind: 'band-for-gig-slot', gigId: 1, feeOffered: 0 });
    expect(
      buildBandForGigSlotInput({
        gigId: 1,
        setLength: '',
        feeOffered: '-100',
        genreId: null,
      }),
    ).toEqual({ kind: 'band-for-gig-slot', gigId: 1 });
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(
      buildBandForGigSlotInput({
        gigId: 1,
        setLength: '  30  ',
        feeOffered: '  1000  ',
        genreId: null,
      }),
    ).toEqual({
      kind: 'band-for-gig-slot',
      gigId: 1,
      setLength: 30,
      feeOffered: 1000,
    });
  });

  // MUS-77: slot-anchored genre requirement seeded through from the
  // gig-detail `+` CTA. When the slot has a genre, it flows to the server
  // as `genreId`; when null (cleared or no slot genre), the key is absent.
  it('serialises genreId when supplied (MUS-77)', () => {
    expect(
      buildBandForGigSlotInput({
        gigId: 1,
        setLength: '',
        feeOffered: '',
        genreId: 5,
      }),
    ).toEqual({ kind: 'band-for-gig-slot', gigId: 1, genreId: 5 });
  });

  it('omits genreId when null (MUS-77)', () => {
    expect(
      buildBandForGigSlotInput({
        gigId: 1,
        setLength: '',
        feeOffered: '',
        genreId: null,
      }),
    ).toEqual({ kind: 'band-for-gig-slot', gigId: 1 });
  });

  it('drops zero and negative genreId (strict positive ids, MUS-77)', () => {
    expect(
      buildBandForGigSlotInput({
        gigId: 1,
        setLength: '',
        feeOffered: '',
        genreId: 0,
      }),
    ).toEqual({ kind: 'band-for-gig-slot', gigId: 1 });
    expect(
      buildBandForGigSlotInput({
        gigId: 1,
        setLength: '',
        feeOffered: '',
        genreId: -1,
      }),
    ).toEqual({ kind: 'band-for-gig-slot', gigId: 1 });
  });
});

describe('buildGigForBandInput', () => {
  it('returns a valid payload with all optional fields', () => {
    expect(
      buildGigForBandInput({
        bandId: 7,
        targetDate: '2026-05-10',
        area: ' Melbourne ',
        feeAsked: '20000',
      }),
    ).toEqual({
      kind: 'gig-for-band',
      bandId: 7,
      targetDate: '2026-05-10',
      area: 'Melbourne',
      feeAsked: 20000,
    });
  });

  it('omits area and feeAsked when blank', () => {
    expect(
      buildGigForBandInput({
        bandId: 3,
        targetDate: '2026-05-10',
        area: '   ',
        feeAsked: '',
      }),
    ).toEqual({
      kind: 'gig-for-band',
      bandId: 3,
      targetDate: '2026-05-10',
    });
  });

  it('returns null when targetDate is not in yyyy-mm-dd format', () => {
    expect(
      buildGigForBandInput({
        bandId: 1,
        targetDate: 'next week',
        area: '',
        feeAsked: '',
      }),
    ).toBeNull();
  });

  it('returns null for empty targetDate', () => {
    expect(
      buildGigForBandInput({
        bandId: 1,
        targetDate: '',
        area: '',
        feeAsked: '',
      }),
    ).toBeNull();
  });
});

describe('buildNightAtVenueInput', () => {
  it('returns a payload with a single valid date', () => {
    expect(
      buildNightAtVenueInput({
        concept: 'Saturday showcase',
        possibleDates: ['2026-05-10'],
      }),
    ).toEqual({
      kind: 'night-at-venue',
      concept: 'Saturday showcase',
      possibleDates: ['2026-05-10'],
    });
  });

  it('sorts and de-duplicates the dates', () => {
    expect(
      buildNightAtVenueInput({
        concept: 'x',
        possibleDates: ['2026-05-16', '2026-05-09', '2026-05-16', '2026-05-02'],
      }),
    ).toEqual({
      kind: 'night-at-venue',
      concept: 'x',
      possibleDates: ['2026-05-02', '2026-05-09', '2026-05-16'],
    });
  });

  it('drops malformed entries but keeps valid ones', () => {
    expect(
      buildNightAtVenueInput({
        concept: 'x',
        possibleDates: ['2026-05-10', 'not-a-date', '2026-05-17'],
      }),
    ).toEqual({
      kind: 'night-at-venue',
      concept: 'x',
      possibleDates: ['2026-05-10', '2026-05-17'],
    });
  });

  it('returns null when concept is blank', () => {
    expect(
      buildNightAtVenueInput({
        concept: '   ',
        possibleDates: ['2026-05-10'],
      }),
    ).toBeNull();
  });

  it('returns null when the resulting date list is empty', () => {
    expect(
      buildNightAtVenueInput({
        concept: 'x',
        possibleDates: [],
      }),
    ).toBeNull();
    expect(
      buildNightAtVenueInput({
        concept: 'x',
        possibleDates: ['not-a-date'],
      }),
    ).toBeNull();
  });

  it('trims the concept and each date entry', () => {
    expect(
      buildNightAtVenueInput({
        concept: '  Jazz night  ',
        possibleDates: ['  2026-05-10  '],
      }),
    ).toEqual({
      kind: 'night-at-venue',
      concept: 'Jazz night',
      possibleDates: ['2026-05-10'],
    });
  });
});

describe('buildPromoterForVenueNightInput', () => {
  it('returns a payload with all fields set', () => {
    expect(
      buildPromoterForVenueNightInput({
        venueId: 3,
        proposedDate: '2026-06-14',
        concept: 'Late-night electronic',
      }),
    ).toEqual({
      kind: 'promoter-for-venue-night',
      venueId: 3,
      proposedDate: '2026-06-14',
      concept: 'Late-night electronic',
    });
  });

  it('omits concept when blank', () => {
    expect(
      buildPromoterForVenueNightInput({
        venueId: 3,
        proposedDate: '2026-06-14',
        concept: '   ',
      }),
    ).toEqual({
      kind: 'promoter-for-venue-night',
      venueId: 3,
      proposedDate: '2026-06-14',
    });
  });

  it('returns null for malformed date', () => {
    expect(
      buildPromoterForVenueNightInput({
        venueId: 3,
        proposedDate: 'next week',
        concept: '',
      }),
    ).toBeNull();
  });
});

describe('buildBandForMusicianInput', () => {
  it('returns a payload with all fields set', () => {
    expect(
      buildBandForMusicianInput({
        instrumentId: 42,
        availability: 'Weekends',
        demosUrl: 'https://example.com/demos',
      }),
    ).toEqual({
      kind: 'band-for-musician',
      instrumentId: 42,
      availability: 'Weekends',
      demosUrl: 'https://example.com/demos',
    });
  });

  it('omits optional fields when blank', () => {
    expect(
      buildBandForMusicianInput({
        instrumentId: 43,
        availability: '',
        demosUrl: '   ',
      }),
    ).toEqual({
      kind: 'band-for-musician',
      instrumentId: 43,
    });
  });

  it('returns null when instrumentId is missing', () => {
    expect(
      buildBandForMusicianInput({
        instrumentId: null,
        availability: 'Weekends',
        demosUrl: '',
      }),
    ).toBeNull();
  });

  it('returns null when instrumentId is zero or negative', () => {
    expect(
      buildBandForMusicianInput({
        instrumentId: 0,
        availability: '',
        demosUrl: '',
      }),
    ).toBeNull();
  });
});
