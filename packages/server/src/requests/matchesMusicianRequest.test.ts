import { describe, expect, it } from 'vitest';
import {
  matchesMusicianRequest,
  normaliseInstrument,
} from './matchesMusicianRequest.js';

describe('normaliseInstrument', () => {
  it('lowercases and trims', () => {
    expect(normaliseInstrument('  Bass Guitar  ')).toBe('bass guitar');
  });

  it('is idempotent on already-normalised values', () => {
    expect(normaliseInstrument('drums')).toBe('drums');
  });

  it('preserves internal spacing (not collapsed)', () => {
    expect(normaliseInstrument('Acoustic  Guitar')).toBe('acoustic  guitar');
  });
});

describe('matchesMusicianRequest', () => {
  it('matches on identical lowercase strings', () => {
    expect(
      matchesMusicianRequest(
        { instrument: 'bass' },
        { instrument: 'bass' },
      ),
    ).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(
      matchesMusicianRequest(
        { instrument: 'Bass Guitar' },
        { instrument: 'bass guitar' },
      ),
    ).toBe(true);
  });

  it('matches across leading/trailing whitespace', () => {
    expect(
      matchesMusicianRequest(
        { instrument: '  drums  ' },
        { instrument: 'Drums' },
      ),
    ).toBe(true);
  });

  it('does not match different instruments', () => {
    expect(
      matchesMusicianRequest(
        { instrument: 'bass' },
        { instrument: 'guitar' },
      ),
    ).toBe(false);
  });

  it('does not match "bass" vs "bass guitar" (lossy first-pass)', () => {
    // Documented: the first-pass rule is exact-after-normalise; MUS-68
    // will tighten via an instrument taxonomy with aliases.
    expect(
      matchesMusicianRequest(
        { instrument: 'bass' },
        { instrument: 'bass guitar' },
      ),
    ).toBe(false);
  });

  it('does not match when either side is blank', () => {
    expect(
      matchesMusicianRequest(
        { instrument: '' },
        { instrument: 'bass' },
      ),
    ).toBe(false);
    expect(
      matchesMusicianRequest(
        { instrument: 'bass' },
        { instrument: '   ' },
      ),
    ).toBe(false);
  });
});
