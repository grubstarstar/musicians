import { describe, expect, it } from 'vitest';
import { matchesMusicianRequest } from './matchesMusicianRequest.js';

describe('matchesMusicianRequest', () => {
  it('matches on identical instrument ids', () => {
    expect(
      matchesMusicianRequest(
        { instrumentId: 42 },
        { instrumentId: 42 },
      ),
    ).toBe(true);
  });

  it('does not match different instrument ids', () => {
    // MUS-68: a "Bass Guitar" id no longer matches a "Bass" id even though
    // the strings are similar. That's the whole point of the taxonomy.
    expect(
      matchesMusicianRequest(
        { instrumentId: 42 },
        { instrumentId: 43 },
      ),
    ).toBe(false);
  });

  it('returns false when either side has a non-positive id', () => {
    // Defensive: 0 / negative ids indicate a missing or malformed row and
    // must not surface as a match even against themselves.
    expect(
      matchesMusicianRequest(
        { instrumentId: 0 },
        { instrumentId: 0 },
      ),
    ).toBe(false);
    expect(
      matchesMusicianRequest(
        { instrumentId: 1 },
        { instrumentId: 0 },
      ),
    ).toBe(false);
    expect(
      matchesMusicianRequest(
        { instrumentId: -1 },
        { instrumentId: 1 },
      ),
    ).toBe(false);
  });
});
