import { describe, expect, it } from 'vitest';
import {
  collectInstrumentIds,
  withInstrumentName,
} from './withInstrumentName.js';

describe('withInstrumentName', () => {
  const nameMap = new Map([
    [42, 'Bass Guitar'],
    [43, 'Drums'],
  ]);

  it('adds instrumentName to musician-for-band details', () => {
    const out = withInstrumentName(
      { kind: 'musician-for-band', instrumentId: 42, style: 'jazz' },
      nameMap,
    );
    expect(out).toEqual({
      kind: 'musician-for-band',
      instrumentId: 42,
      style: 'jazz',
      instrumentName: 'Bass Guitar',
    });
  });

  it('adds instrumentName to band-for-musician details', () => {
    const out = withInstrumentName(
      { kind: 'band-for-musician', instrumentId: 43 },
      nameMap,
    );
    expect(out).toEqual({
      kind: 'band-for-musician',
      instrumentId: 43,
      instrumentName: 'Drums',
    });
  });

  it('sets instrumentName to null when the id is unknown', () => {
    const out = withInstrumentName(
      { kind: 'musician-for-band', instrumentId: 999 },
      nameMap,
    );
    expect(out).toEqual({
      kind: 'musician-for-band',
      instrumentId: 999,
      instrumentName: null,
    });
  });

  it('passes non-instrument kinds through unchanged', () => {
    const input = {
      kind: 'band-for-gig-slot' as const,
      gigId: 7,
      feeOffered: 25000,
    };
    expect(withInstrumentName(input, nameMap)).toBe(input);
  });

  it('passes band_join through unchanged', () => {
    const input = { kind: 'band_join' as const, bandId: 5 };
    expect(withInstrumentName(input, nameMap)).toBe(input);
  });
});

describe('collectInstrumentIds', () => {
  it('collects ids across both instrument-carrying kinds', () => {
    const ids = collectInstrumentIds([
      { kind: 'musician-for-band', instrumentId: 10 },
      { kind: 'band-for-musician', instrumentId: 11 },
      { kind: 'band-for-gig-slot', gigId: 7 },
      { kind: 'band_join', bandId: 5 },
    ]);
    expect(ids.sort()).toEqual([10, 11]);
  });

  it('dedupes repeated ids', () => {
    const ids = collectInstrumentIds([
      { kind: 'musician-for-band', instrumentId: 10 },
      { kind: 'band-for-musician', instrumentId: 10 },
    ]);
    expect(ids).toEqual([10]);
  });

  it('returns an empty array when no details carry an instrument', () => {
    const ids = collectInstrumentIds([
      { kind: 'band-for-gig-slot', gigId: 7 },
    ]);
    expect(ids).toEqual([]);
  });
});
