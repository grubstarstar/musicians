import { describe, expect, it } from 'vitest';
import {
  buildBandForGigSlotInput,
  buildGigForBandInput,
  buildMusicianForBandInput,
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
  it('trims and includes all fields when provided', () => {
    expect(
      buildMusicianForBandInput({
        bandId: 7,
        instrument: '  Bass  ',
        style: ' jazz-funk ',
        rehearsalCommitment: ' weekly ',
      }),
    ).toEqual({
      kind: 'musician-for-band',
      bandId: 7,
      instrument: 'Bass',
      style: 'jazz-funk',
      rehearsalCommitment: 'weekly',
    });
  });

  it('omits empty-string optional fields entirely', () => {
    const result = buildMusicianForBandInput({
      bandId: 3,
      instrument: 'Drums',
      style: '',
      rehearsalCommitment: '   ',
    });
    expect(result).toEqual({
      kind: 'musician-for-band',
      bandId: 3,
      instrument: 'Drums',
    });
    expect(Object.keys(result).sort()).toEqual(['bandId', 'instrument', 'kind']);
  });
});

describe('buildBandForGigSlotInput', () => {
  it('parses numeric setLength and feeOffered', () => {
    expect(
      buildBandForGigSlotInput({
        gigId: 42,
        setLength: '45',
        feeOffered: '25000',
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
      buildBandForGigSlotInput({ gigId: 1, setLength: '', feeOffered: '' }),
    ).toEqual({
      kind: 'band-for-gig-slot',
      gigId: 1,
    });
    expect(
      buildBandForGigSlotInput({ gigId: 1, setLength: 'abc', feeOffered: '' }),
    ).toEqual({
      kind: 'band-for-gig-slot',
      gigId: 1,
    });
  });

  it('drops setLength when zero or negative (server requires > 0)', () => {
    expect(
      buildBandForGigSlotInput({ gigId: 1, setLength: '0', feeOffered: '' }),
    ).toEqual({ kind: 'band-for-gig-slot', gigId: 1 });
    expect(
      buildBandForGigSlotInput({ gigId: 1, setLength: '-5', feeOffered: '' }),
    ).toEqual({ kind: 'band-for-gig-slot', gigId: 1 });
  });

  it('accepts feeOffered of 0 (free gig) and drops negative fees', () => {
    expect(
      buildBandForGigSlotInput({ gigId: 1, setLength: '', feeOffered: '0' }),
    ).toEqual({ kind: 'band-for-gig-slot', gigId: 1, feeOffered: 0 });
    expect(
      buildBandForGigSlotInput({ gigId: 1, setLength: '', feeOffered: '-100' }),
    ).toEqual({ kind: 'band-for-gig-slot', gigId: 1 });
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(
      buildBandForGigSlotInput({
        gigId: 1,
        setLength: '  30  ',
        feeOffered: '  1000  ',
      }),
    ).toEqual({
      kind: 'band-for-gig-slot',
      gigId: 1,
      setLength: 30,
      feeOffered: 1000,
    });
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
