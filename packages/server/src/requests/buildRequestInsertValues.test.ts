import { describe, expect, it } from 'vitest';
import {
  buildRequestInsertValues,
  type RequestCreateInput,
} from './buildRequestInsertValues.js';

describe('buildRequestInsertValues', () => {
  describe('musician-for-band', () => {
    it('maps a musician-for-band input with all fields to the expected insert row', () => {
      const input: RequestCreateInput = {
        kind: 'musician-for-band',
        bandId: 7,
        instrument: 'Bass',
        style: 'jazz-funk',
        rehearsalCommitment: 'weekly',
      };

      expect(buildRequestInsertValues(input, 42)).toEqual({
        kind: 'musician-for-band',
        source_user_id: 42,
        anchor_band_id: 7,
        anchor_gig_id: null,
        details: {
          kind: 'musician-for-band',
          instrument: 'Bass',
          style: 'jazz-funk',
          rehearsalCommitment: 'weekly',
        },
        slot_count: 1,
        slots_filled: 0,
        status: 'open',
      });
    });

    it('omits optional fields from details when not provided', () => {
      const input: RequestCreateInput = {
        kind: 'musician-for-band',
        bandId: 3,
        instrument: 'Drums',
      };

      const result = buildRequestInsertValues(input, 1);

      expect(Object.keys(result.details).sort()).toEqual(['instrument', 'kind']);
      expect(result.details).toEqual({ kind: 'musician-for-band', instrument: 'Drums' });
    });

    it('does not leak unknown input fields into details', () => {
      // Simulate untrusted input that got past the Zod parser with extra fields.
      const hostile = {
        kind: 'musician-for-band',
        bandId: 1,
        instrument: 'Synth',
        sneaky: 'should-not-leak',
        __proto__Attack: true,
      } as unknown as RequestCreateInput;

      const result = buildRequestInsertValues(hostile, 1);

      expect(Object.keys(result.details).sort()).toEqual(['instrument', 'kind']);
      expect(JSON.stringify(result)).not.toContain('sneaky');
      expect(JSON.stringify(result)).not.toContain('__proto__Attack');
    });
  });

  describe('band-for-gig-slot', () => {
    it('maps a band-for-gig-slot input with all fields and carries openSlotCount into slot_count', () => {
      const input: RequestCreateInput = {
        kind: 'band-for-gig-slot',
        gigId: 12,
        setLength: 45,
        feeOffered: 25000,
        openSlotCount: 3,
      };

      expect(buildRequestInsertValues(input, 9)).toEqual({
        kind: 'band-for-gig-slot',
        source_user_id: 9,
        anchor_band_id: null,
        anchor_gig_id: 12,
        details: {
          kind: 'band-for-gig-slot',
          gigId: 12,
          setLength: 45,
          feeOffered: 25000,
        },
        slot_count: 3,
        slots_filled: 0,
        status: 'open',
      });
    });

    it('omits optional setLength and feeOffered from details when not provided', () => {
      const input: RequestCreateInput = {
        kind: 'band-for-gig-slot',
        gigId: 42,
        openSlotCount: 1,
      };

      const result = buildRequestInsertValues(input, 5);

      expect(result.details).toEqual({ kind: 'band-for-gig-slot', gigId: 42 });
      expect(result.slot_count).toBe(1);
      expect(result.anchor_band_id).toBeNull();
      expect(result.anchor_gig_id).toBe(42);
    });

    it('does not leak unknown input fields into details', () => {
      const hostile = {
        kind: 'band-for-gig-slot',
        gigId: 3,
        openSlotCount: 2,
        sneaky: 'should-not-leak',
      } as unknown as RequestCreateInput;

      const result = buildRequestInsertValues(hostile, 1);

      expect(Object.keys(result.details).sort()).toEqual(['gigId', 'kind']);
      expect(JSON.stringify(result)).not.toContain('sneaky');
    });

    it('sets slots_filled to 0 and status to open regardless of openSlotCount', () => {
      const result = buildRequestInsertValues(
        { kind: 'band-for-gig-slot', gigId: 1, openSlotCount: 5 },
        1,
      );
      expect(result.slots_filled).toBe(0);
      expect(result.status).toBe('open');
    });
  });

  describe('gig-for-band', () => {
    it('maps a gig-for-band input with all fields', () => {
      const input: RequestCreateInput = {
        kind: 'gig-for-band',
        bandId: 9,
        targetDate: '2026-05-10',
        area: 'Melbourne',
        feeAsked: 20000,
      };

      expect(buildRequestInsertValues(input, 4)).toEqual({
        kind: 'gig-for-band',
        source_user_id: 4,
        anchor_band_id: null,
        anchor_gig_id: null,
        details: {
          kind: 'gig-for-band',
          bandId: 9,
          targetDate: '2026-05-10',
          area: 'Melbourne',
          feeAsked: 20000,
        },
        slot_count: 1,
        slots_filled: 0,
        status: 'open',
      });
    });

    it('omits optional area and feeAsked from details when not provided', () => {
      const input: RequestCreateInput = {
        kind: 'gig-for-band',
        bandId: 2,
        targetDate: '2026-05-10',
      };

      const result = buildRequestInsertValues(input, 1);

      expect(result.details).toEqual({
        kind: 'gig-for-band',
        bandId: 2,
        targetDate: '2026-05-10',
      });
      expect(result.slot_count).toBe(1);
      expect(result.anchor_band_id).toBeNull();
      expect(result.anchor_gig_id).toBeNull();
    });
  });

  describe('night-at-venue', () => {
    it('maps a night-at-venue input with all fields', () => {
      const input: RequestCreateInput = {
        kind: 'night-at-venue',
        concept: 'Saturday jazz showcase',
        possibleDates: ['2026-05-02', '2026-05-09', '2026-05-16'],
      };

      expect(buildRequestInsertValues(input, 11)).toEqual({
        kind: 'night-at-venue',
        source_user_id: 11,
        anchor_band_id: null,
        anchor_gig_id: null,
        details: {
          kind: 'night-at-venue',
          concept: 'Saturday jazz showcase',
          possibleDates: ['2026-05-02', '2026-05-09', '2026-05-16'],
        },
        slot_count: 1,
        slots_filled: 0,
        status: 'open',
      });
    });
  });

  describe('promoter-for-venue-night', () => {
    it('maps a promoter-for-venue-night input with all fields', () => {
      const input: RequestCreateInput = {
        kind: 'promoter-for-venue-night',
        venueId: 3,
        proposedDate: '2026-06-14',
        concept: 'Late-night electronic',
      };

      expect(buildRequestInsertValues(input, 22)).toEqual({
        kind: 'promoter-for-venue-night',
        source_user_id: 22,
        anchor_band_id: null,
        anchor_gig_id: null,
        details: {
          kind: 'promoter-for-venue-night',
          venueId: 3,
          proposedDate: '2026-06-14',
          concept: 'Late-night electronic',
        },
        slot_count: 1,
        slots_filled: 0,
        status: 'open',
      });
    });

    it('omits optional concept when not provided', () => {
      const input: RequestCreateInput = {
        kind: 'promoter-for-venue-night',
        venueId: 5,
        proposedDate: '2026-06-14',
      };

      expect(buildRequestInsertValues(input, 1).details).toEqual({
        kind: 'promoter-for-venue-night',
        venueId: 5,
        proposedDate: '2026-06-14',
      });
    });
  });

  describe('band-for-musician', () => {
    it('maps a band-for-musician input with all fields', () => {
      const input: RequestCreateInput = {
        kind: 'band-for-musician',
        instrument: 'Bass Guitar',
        availability: 'Weekends',
        demosUrl: 'https://example.com/demos',
      };

      expect(buildRequestInsertValues(input, 33)).toEqual({
        kind: 'band-for-musician',
        source_user_id: 33,
        anchor_band_id: null,
        anchor_gig_id: null,
        details: {
          kind: 'band-for-musician',
          instrument: 'Bass Guitar',
          availability: 'Weekends',
          demosUrl: 'https://example.com/demos',
        },
        slot_count: 1,
        slots_filled: 0,
        status: 'open',
      });
    });

    it('omits optional availability and demosUrl when not provided', () => {
      const input: RequestCreateInput = {
        kind: 'band-for-musician',
        instrument: 'Drums',
      };

      expect(buildRequestInsertValues(input, 1).details).toEqual({
        kind: 'band-for-musician',
        instrument: 'Drums',
      });
    });
  });
});
