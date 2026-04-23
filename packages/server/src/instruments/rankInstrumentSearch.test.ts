import { describe, expect, it } from 'vitest';
import { rankInstrumentSearch } from './rankInstrumentSearch.js';

describe('rankInstrumentSearch', () => {
  it('surfaces an exact case-insensitive match above prefix and contains matches', () => {
    const rows = [
      // tier 0 (exact match)
      { id: 1, name: 'Drums', category: 'percussion' },
      // tier 2 (contains 'drum' but not prefix for 'drums')
      { id: 2, name: 'Drum Machine', category: 'electronic' },
      // tier 1 (prefix of 'drums' — 'drumstick' starts with 'drums')
      { id: 3, name: 'Drumstick', category: 'percussion' },
    ];
    const ranked = rankInstrumentSearch(rows, 'drums');
    expect(ranked.map((r) => r.id)).toEqual([1, 3, 2]);
  });

  it('prefers prefix matches over contains-only matches', () => {
    const rows = [
      { id: 1, name: 'Bass Guitar', category: 'strings' },
      { id: 2, name: 'Double Bass', category: 'strings' },
      { id: 3, name: 'Basset Horn', category: 'wind' },
    ];
    const ranked = rankInstrumentSearch(rows, 'bass');
    // Prefix: "Bass Guitar", "Basset Horn". Contains-only: "Double Bass".
    // Within the prefix tier the category ordering ('strings' < 'wind')
    // followed by name alphabetically decides.
    expect(ranked.map((r) => r.id)).toEqual([1, 3, 2]);
  });

  it('sorts tied rows by category alphabetically, then by name', () => {
    const rows = [
      { id: 1, name: 'Bassoon', category: 'wind' },
      { id: 2, name: 'Bass Clarinet', category: 'wind' },
      { id: 3, name: 'Bass Guitar', category: 'strings' },
    ];
    const ranked = rankInstrumentSearch(rows, 'bass');
    // All three are prefix matches. strings < wind, and within wind
    // alphabetical name order wins.
    expect(ranked.map((r) => r.id)).toEqual([3, 2, 1]);
  });

  it('places null-category rows after non-null-category rows at the same tier', () => {
    const rows = [
      { id: 1, name: 'Other', category: null },
      { id: 2, name: 'Organ', category: 'keyboards' },
    ];
    const ranked = rankInstrumentSearch(rows, 'o');
    expect(ranked.map((r) => r.id)).toEqual([2, 1]);
  });

  it('returns an alphabetical order when the query is empty', () => {
    const rows = [
      { id: 1, name: 'Piano', category: 'keyboards' },
      { id: 2, name: 'Drums', category: 'percussion' },
      { id: 3, name: 'Banjo', category: 'strings' },
    ];
    const ranked = rankInstrumentSearch(rows, '');
    // Categories sorted: keyboards, percussion, strings
    expect(ranked.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it('is case-insensitive on both sides', () => {
    const rows = [
      { id: 1, name: 'Banjo', category: 'strings' },
    ];
    expect(rankInstrumentSearch(rows, 'BANJO')[0].id).toBe(1);
  });

  it('does not mutate the input array', () => {
    const rows = [
      { id: 1, name: 'Drums', category: 'percussion' },
      { id: 2, name: 'Bass Guitar', category: 'strings' },
    ];
    const snapshot = JSON.parse(JSON.stringify(rows));
    rankInstrumentSearch(rows, 'bass');
    expect(rows).toEqual(snapshot);
  });
});
