import { describe, expect, it } from 'vitest';
import {
  buildRequestInsertValues,
  type RequestCreateInput,
} from './buildRequestInsertValues.js';

describe('buildRequestInsertValues', () => {
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
