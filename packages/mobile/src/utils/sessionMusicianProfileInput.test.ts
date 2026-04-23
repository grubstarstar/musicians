import { describe, expect, it } from 'vitest';
import {
  buildSessionMusicianProfileInput,
  normaliseInstruments,
  parseExperienceYears,
} from './sessionMusicianProfileInput';

describe('normaliseInstruments', () => {
  it('trims whitespace on each entry', () => {
    expect(normaliseInstruments(['  Bass  ', '  Drums '])).toEqual([
      'Bass',
      'Drums',
    ]);
  });

  it('drops empty / whitespace-only entries', () => {
    expect(normaliseInstruments(['Bass', '', '   ', 'Drums'])).toEqual([
      'Bass',
      'Drums',
    ]);
  });

  it('de-duplicates while preserving first-seen order', () => {
    expect(
      normaliseInstruments(['Bass', 'Drums', 'Bass', 'Guitar', 'Drums']),
    ).toEqual(['Bass', 'Drums', 'Guitar']);
  });

  it('treats trimmed duplicates as duplicates', () => {
    expect(normaliseInstruments(['Bass', '  Bass  '])).toEqual(['Bass']);
  });

  it('returns an empty list when the input is empty or all-blank', () => {
    expect(normaliseInstruments([])).toEqual([]);
    expect(normaliseInstruments(['', '   '])).toEqual([]);
  });
});

describe('parseExperienceYears', () => {
  it('returns null for blank / whitespace-only input', () => {
    expect(parseExperienceYears('')).toEqual({ ok: true, value: null });
    expect(parseExperienceYears('   ')).toEqual({ ok: true, value: null });
  });

  it('parses a positive integer', () => {
    expect(parseExperienceYears('7')).toEqual({ ok: true, value: 7 });
  });

  it('parses zero', () => {
    expect(parseExperienceYears('0')).toEqual({ ok: true, value: 0 });
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(parseExperienceYears('  12 ')).toEqual({ ok: true, value: 12 });
  });

  it('rejects non-numeric text', () => {
    expect(parseExperienceYears('abc')).toEqual({ ok: false });
    expect(parseExperienceYears('7 years')).toEqual({ ok: false });
  });

  it('rejects fractional input', () => {
    expect(parseExperienceYears('3.5')).toEqual({ ok: false });
  });

  it('rejects negative input', () => {
    expect(parseExperienceYears('-1')).toEqual({ ok: false });
  });

  it('rejects scientific notation', () => {
    expect(parseExperienceYears('3e2')).toEqual({ ok: false });
  });

  it('rejects a leading + sign', () => {
    expect(parseExperienceYears('+5')).toEqual({ ok: false });
  });
});

describe('buildSessionMusicianProfileInput', () => {
  it('builds the full payload with all fields populated', () => {
    const result = buildSessionMusicianProfileInput({
      instruments: ['Bass', 'Drums'],
      experienceYears: '5',
      location: 'Melbourne',
      bio: 'Available weekends.',
      availableForSessionWork: true,
    });
    expect(result).toEqual({
      ok: true,
      input: {
        instruments: ['Bass', 'Drums'],
        experienceYears: 5,
        location: 'Melbourne',
        bio: 'Available weekends.',
        availableForSessionWork: true,
      },
    });
  });

  it('nulls out blank optional text fields', () => {
    const result = buildSessionMusicianProfileInput({
      instruments: ['Bass'],
      experienceYears: '',
      location: '',
      bio: '   ',
      availableForSessionWork: true,
    });
    expect(result).toEqual({
      ok: true,
      input: {
        instruments: ['Bass'],
        experienceYears: null,
        location: null,
        bio: null,
        availableForSessionWork: true,
      },
    });
  });

  it('trims text fields before keeping them', () => {
    const result = buildSessionMusicianProfileInput({
      instruments: ['Bass'],
      experienceYears: '0',
      location: '  Sydney  ',
      bio: '  hi  ',
      availableForSessionWork: false,
    });
    if (!result.ok) throw new Error('expected ok');
    expect(result.input.location).toBe('Sydney');
    expect(result.input.bio).toBe('hi');
    expect(result.input.availableForSessionWork).toBe(false);
  });

  it('returns an error when no instruments are provided', () => {
    expect(
      buildSessionMusicianProfileInput({
        instruments: [],
        experienceYears: '',
        location: '',
        bio: '',
        availableForSessionWork: true,
      }),
    ).toEqual({ ok: false, error: 'no-instruments' });
  });

  it('returns an error when instruments are only blanks', () => {
    expect(
      buildSessionMusicianProfileInput({
        instruments: ['', '   '],
        experienceYears: '',
        location: '',
        bio: '',
        availableForSessionWork: true,
      }),
    ).toEqual({ ok: false, error: 'no-instruments' });
  });

  it('returns an error when experience years is unparseable', () => {
    expect(
      buildSessionMusicianProfileInput({
        instruments: ['Bass'],
        experienceYears: 'many',
        location: '',
        bio: '',
        availableForSessionWork: true,
      }),
    ).toEqual({ ok: false, error: 'experience-years-invalid' });
  });

  it('surfaces no-instruments before experience-years-invalid', () => {
    // Order matters for the inline error copy — the form renders one error at
    // a time and we want the most user-actionable problem first.
    expect(
      buildSessionMusicianProfileInput({
        instruments: [],
        experienceYears: 'nope',
        location: '',
        bio: '',
        availableForSessionWork: true,
      }),
    ).toEqual({ ok: false, error: 'no-instruments' });
  });
});
