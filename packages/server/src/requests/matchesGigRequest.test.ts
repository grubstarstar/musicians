import { describe, expect, it } from 'vitest';
import { matchesGigRequest } from './matchesGigRequest.js';

describe('matchesGigRequest', () => {
  describe('date', () => {
    it('matches when both sides are the same calendar day', () => {
      expect(
        matchesGigRequest(
          { gigDate: '2026-05-10T20:00:00Z' },
          { targetDate: '2026-05-10' },
        ),
      ).toBe(true);
    });

    it('rejects when calendar days differ', () => {
      expect(
        matchesGigRequest(
          { gigDate: '2026-05-10T23:00:00Z' },
          { targetDate: '2026-05-11' },
        ),
      ).toBe(false);
    });

    it('rejects when gig date is garbage (no day prefix)', () => {
      expect(
        matchesGigRequest(
          { gigDate: 'not-a-date' },
          { targetDate: '2026-05-10' },
        ),
      ).toBe(false);
    });
  });

  describe('area', () => {
    it('matches when both sides omit area', () => {
      expect(
        matchesGigRequest(
          { gigDate: '2026-05-10' },
          { targetDate: '2026-05-10' },
        ),
      ).toBe(true);
    });

    it('matches when only the gig has an area (band open to any)', () => {
      expect(
        matchesGigRequest(
          { gigDate: '2026-05-10', gigVenueCity: 'Melbourne' },
          { targetDate: '2026-05-10' },
        ),
      ).toBe(true);
    });

    it('matches when only the band has an area (gig unknown)', () => {
      expect(
        matchesGigRequest(
          { gigDate: '2026-05-10' },
          { targetDate: '2026-05-10', area: 'Melbourne' },
        ),
      ).toBe(true);
    });

    it('matches when areas overlap substring case-insensitively', () => {
      expect(
        matchesGigRequest(
          { gigDate: '2026-05-10', gigVenueCity: 'melbourne cbd' },
          { targetDate: '2026-05-10', area: 'Melbourne' },
        ),
      ).toBe(true);
    });

    it('matches the other direction of substring overlap', () => {
      expect(
        matchesGigRequest(
          { gigDate: '2026-05-10', gigVenueCity: 'Fitzroy' },
          { targetDate: '2026-05-10', area: 'greater fitzroy area' },
        ),
      ).toBe(true);
    });

    it('rejects when areas are both present and disjoint', () => {
      expect(
        matchesGigRequest(
          { gigDate: '2026-05-10', gigVenueCity: 'Melbourne' },
          { targetDate: '2026-05-10', area: 'Sydney' },
        ),
      ).toBe(false);
    });

    it('rejects when one area is an empty string (explicit empty not open-ended)', () => {
      // Passing an empty area is treated as "no overlap" rather than
      // "everything matches" — callers should leave the field absent instead.
      expect(
        matchesGigRequest(
          { gigDate: '2026-05-10', gigVenueCity: 'Melbourne' },
          { targetDate: '2026-05-10', area: '' },
        ),
      ).toBe(false);
    });
  });

  describe('fee', () => {
    it('matches when both sides omit fee', () => {
      expect(
        matchesGigRequest(
          { gigDate: '2026-05-10' },
          { targetDate: '2026-05-10' },
        ),
      ).toBe(true);
    });

    it('matches when only one side specifies a fee', () => {
      expect(
        matchesGigRequest(
          { gigDate: '2026-05-10', feeOffered: 10000 },
          { targetDate: '2026-05-10' },
        ),
      ).toBe(true);
      expect(
        matchesGigRequest(
          { gigDate: '2026-05-10' },
          { targetDate: '2026-05-10', feeAsked: 10000 },
        ),
      ).toBe(true);
    });

    it('matches when offer meets the ask exactly', () => {
      expect(
        matchesGigRequest(
          { gigDate: '2026-05-10', feeOffered: 10000 },
          { targetDate: '2026-05-10', feeAsked: 10000 },
        ),
      ).toBe(true);
    });

    it('matches when offer exceeds the ask', () => {
      expect(
        matchesGigRequest(
          { gigDate: '2026-05-10', feeOffered: 15000 },
          { targetDate: '2026-05-10', feeAsked: 10000 },
        ),
      ).toBe(true);
    });

    it('rejects when offer is below the ask', () => {
      expect(
        matchesGigRequest(
          { gigDate: '2026-05-10', feeOffered: 5000 },
          { targetDate: '2026-05-10', feeAsked: 10000 },
        ),
      ).toBe(false);
    });
  });

  describe('combined', () => {
    it('matches on all three: date, area overlap, fee meets ask', () => {
      expect(
        matchesGigRequest(
          {
            gigDate: '2026-05-10T19:30:00+10:00',
            gigVenueCity: 'Melbourne CBD',
            feeOffered: 20000,
          },
          {
            targetDate: '2026-05-10',
            area: 'melbourne',
            feeAsked: 15000,
          },
        ),
      ).toBe(true);
    });

    it('rejects when date matches but fee does not', () => {
      expect(
        matchesGigRequest(
          { gigDate: '2026-05-10', gigVenueCity: 'Melbourne', feeOffered: 5000 },
          { targetDate: '2026-05-10', area: 'Melbourne', feeAsked: 10000 },
        ),
      ).toBe(false);
    });
  });
});
