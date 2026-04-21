import { describe, expect, it } from 'vitest';
import { parsePostRequestParams } from './parsePostRequestParams';

describe('parsePostRequestParams', () => {
  it('parses a musician-for-band seed with bandId', () => {
    expect(
      parsePostRequestParams({ kind: 'musician-for-band', bandId: '12' }),
    ).toEqual({
      kind: 'musician-for-band',
      bandId: 12,
      gigId: null,
      genre: null,
    });
  });

  it('parses a band-for-gig-slot seed with gigId and genre', () => {
    expect(
      parsePostRequestParams({
        kind: 'band-for-gig-slot',
        gigId: '7',
        genre: 'jazz',
      }),
    ).toEqual({
      kind: 'band-for-gig-slot',
      bandId: null,
      gigId: 7,
      genre: 'jazz',
    });
  });

  it('rejects unknown kind values', () => {
    expect(parsePostRequestParams({ kind: 'not-a-kind' })).toEqual({
      kind: null,
      bandId: null,
      gigId: null,
      genre: null,
    });
  });

  it('rejects non-integer bandId', () => {
    expect(
      parsePostRequestParams({ kind: 'musician-for-band', bandId: 'abc' }),
    ).toEqual({
      kind: 'musician-for-band',
      bandId: null,
      gigId: null,
      genre: null,
    });
  });

  it('rejects zero and negative bandId', () => {
    expect(parsePostRequestParams({ bandId: '0' }).bandId).toBeNull();
    // Negative ids fail the strict /^\d+$/ regex — `-` isn't a digit.
    expect(parsePostRequestParams({ bandId: '-5' }).bandId).toBeNull();
  });

  it('rejects mixed alphanumeric bandId (strict digits only)', () => {
    // Number.parseInt('12abc', 10) would succeed as 12; the parser must
    // reject it so copy-paste errors from bad URLs don't silently seed the
    // form with partial data.
    expect(parsePostRequestParams({ bandId: '12abc' }).bandId).toBeNull();
  });

  it('returns all nulls for an empty params bag', () => {
    expect(parsePostRequestParams({})).toEqual({
      kind: null,
      bandId: null,
      gigId: null,
      genre: null,
    });
  });

  it('treats empty strings as missing', () => {
    expect(
      parsePostRequestParams({ kind: '', bandId: '', gigId: '', genre: '' }),
    ).toEqual({ kind: null, bandId: null, gigId: null, genre: null });
  });

  it('treats whitespace-only strings as missing', () => {
    expect(parsePostRequestParams({ genre: '   ' }).genre).toBeNull();
  });

  it('takes the first element when a param is an array', () => {
    // Expo Router can surface repeated query keys as an array.
    expect(
      parsePostRequestParams({ kind: ['musician-for-band', 'band-for-musician'] }),
    ).toMatchObject({ kind: 'musician-for-band' });
  });

  it('trims surrounding whitespace on genre', () => {
    expect(parsePostRequestParams({ genre: '  funk  ' }).genre).toBe('funk');
  });

  it('accepts every valid kind literal', () => {
    const kinds = [
      'musician-for-band',
      'band-for-gig-slot',
      'gig-for-band',
      'night-at-venue',
      'promoter-for-venue-night',
      'band-for-musician',
    ] as const;
    for (const k of kinds) {
      expect(parsePostRequestParams({ kind: k }).kind).toBe(k);
    }
  });
});
