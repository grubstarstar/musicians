import { describe, expect, it } from 'vitest';
import { matchesNightAtVenue } from './matchesNightAtVenue.js';

describe('matchesNightAtVenue', () => {
  it('matches when the proposed date is in a single-entry possibleDates list', () => {
    expect(
      matchesNightAtVenue(
        { possibleDates: ['2026-05-10'] },
        { proposedDate: '2026-05-10' },
      ),
    ).toBe(true);
  });

  it('rejects when the proposed date is not in a single-entry possibleDates list', () => {
    expect(
      matchesNightAtVenue(
        { possibleDates: ['2026-05-10'] },
        { proposedDate: '2026-05-11' },
      ),
    ).toBe(false);
  });

  it('matches when the proposed date is anywhere in a many-entry possibleDates list', () => {
    expect(
      matchesNightAtVenue(
        { possibleDates: ['2026-05-02', '2026-05-09', '2026-05-16', '2026-05-23'] },
        { proposedDate: '2026-05-16' },
      ),
    ).toBe(true);
  });

  it('rejects when the proposed date is not in a many-entry possibleDates list', () => {
    expect(
      matchesNightAtVenue(
        { possibleDates: ['2026-05-02', '2026-05-09', '2026-05-16', '2026-05-23'] },
        { proposedDate: '2026-05-30' },
      ),
    ).toBe(false);
  });

  it('rejects when possibleDates is empty', () => {
    expect(
      matchesNightAtVenue(
        { possibleDates: [] },
        { proposedDate: '2026-05-10' },
      ),
    ).toBe(false);
  });

  it('is strict string equality (no day-prefix slicing, no timezone normalisation)', () => {
    // Deliberately lossy for this slice — callers must pass canonical
    // yyyy-mm-dd strings (Zod at the boundary enforces that).
    expect(
      matchesNightAtVenue(
        { possibleDates: ['2026-05-10'] },
        { proposedDate: '2026-05-10T00:00:00Z' },
      ),
    ).toBe(false);
  });
});
