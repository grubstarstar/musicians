import { describe, expect, it } from 'vitest';
import { isUniqueViolation, validateRegisterInput } from './authRoutes.js';

describe('validateRegisterInput', () => {
  it('returns null for a well-formed payload', () => {
    expect(validateRegisterInput('alice', 'longenough')).toBeNull();
  });

  it('rejects non-string username', () => {
    expect(validateRegisterInput(undefined, 'longenough')).toEqual({
      status: 400,
      error: 'username and password are required',
    });
    expect(validateRegisterInput(42, 'longenough')).toEqual({
      status: 400,
      error: 'username and password are required',
    });
  });

  it('rejects non-string password', () => {
    expect(validateRegisterInput('alice', undefined)).toEqual({
      status: 400,
      error: 'username and password are required',
    });
    expect(validateRegisterInput('alice', null)).toEqual({
      status: 400,
      error: 'username and password are required',
    });
  });

  it('rejects blank / whitespace-only usernames', () => {
    expect(validateRegisterInput('', 'longenough')).toEqual({
      status: 400,
      error: 'username is required',
    });
    expect(validateRegisterInput('   ', 'longenough')).toEqual({
      status: 400,
      error: 'username is required',
    });
  });

  it('rejects passwords shorter than 8 characters', () => {
    // Boundary: 7 chars fails, 8 chars passes.
    expect(validateRegisterInput('alice', '1234567')).toEqual({
      status: 400,
      error: 'password must be at least 8 characters',
    });
    expect(validateRegisterInput('alice', '12345678')).toBeNull();
  });

  it('does not trim the password before length-checking', () => {
    // Leading/trailing spaces are legitimate password characters; only the
    // length rule matters here. A 10-char string of spaces is technically
    // acceptable — the server's job is not to police password quality, just
    // to enforce the minimum length.
    expect(validateRegisterInput('alice', '          ')).toBeNull();
  });
});

describe('isUniqueViolation', () => {
  it('returns true for a bare Postgres error with code 23505', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('returns true when the error is wrapped (DrizzleQueryError style)', () => {
    // Drizzle currently wraps pg errors in a DrizzleQueryError exposing the
    // original under `cause` — real shape from a postgres.js error.
    expect(
      isUniqueViolation({
        name: 'DrizzleQueryError',
        message: 'Failed query: insert into "users" ...',
        cause: { code: '23505', constraint_name: 'users_username_unique' },
      }),
    ).toBe(true);
  });

  it('returns false for non-unique-violation SQLSTATE codes', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false); // FK violation
    expect(isUniqueViolation({ code: '42P01' })).toBe(false); // undefined_table
  });

  it('returns false for arbitrary errors and primitives', () => {
    expect(isUniqueViolation(new Error('nope'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation('23505')).toBe(false);
    expect(isUniqueViolation(23505)).toBe(false);
  });

  it('does not recurse beyond one level of cause', () => {
    // If someone double-wraps (cause.cause.code), we intentionally don't peel
    // further — our only known producer is a single wrapper layer, and
    // walking unbounded would be brittle.
    expect(
      isUniqueViolation({ cause: { cause: { code: '23505' } } }),
    ).toBe(false);
  });
});
