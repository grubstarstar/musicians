import { describe, expect, it } from 'vitest';
import {
  getTokenFromAuthHeader,
  getTokenFromCookie,
  getTokenFromRequest,
} from './auth.js';

describe('getTokenFromAuthHeader', () => {
  it('extracts the token after "Bearer "', () => {
    expect(getTokenFromAuthHeader('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('is case-insensitive on the scheme', () => {
    expect(getTokenFromAuthHeader('bearer xyz')).toBe('xyz');
    expect(getTokenFromAuthHeader('BEARER xyz')).toBe('xyz');
  });

  it('tolerates extra whitespace between scheme and token', () => {
    expect(getTokenFromAuthHeader('Bearer   padded')).toBe('padded');
  });

  it('returns null when the header is missing', () => {
    expect(getTokenFromAuthHeader(undefined)).toBeNull();
  });

  it('returns null for non-Bearer schemes', () => {
    expect(getTokenFromAuthHeader('Basic dXNlcjpwYXNz')).toBeNull();
  });

  it('returns null when only the scheme is present', () => {
    expect(getTokenFromAuthHeader('Bearer')).toBeNull();
    expect(getTokenFromAuthHeader('Bearer ')).toBeNull();
  });
});

describe('getTokenFromCookie', () => {
  it('extracts auth_token when it is the only cookie', () => {
    expect(getTokenFromCookie('auth_token=abc123')).toBe('abc123');
  });

  it('extracts auth_token among others, regardless of position', () => {
    expect(getTokenFromCookie('theme=dark; auth_token=abc123; lang=en')).toBe('abc123');
    expect(getTokenFromCookie('auth_token=abc123; lang=en')).toBe('abc123');
    expect(getTokenFromCookie('lang=en; auth_token=abc123')).toBe('abc123');
  });

  it('returns null when the cookie header is missing or empty', () => {
    expect(getTokenFromCookie(undefined)).toBeNull();
    expect(getTokenFromCookie('')).toBeNull();
  });

  it('returns null when auth_token is absent', () => {
    expect(getTokenFromCookie('theme=dark; lang=en')).toBeNull();
  });

  it('does not confuse cookies whose names contain auth_token as a substring', () => {
    expect(getTokenFromCookie('not_auth_token=xxx')).toBeNull();
  });
});

describe('getTokenFromRequest', () => {
  const makeRequest = (headers: Record<string, string>): Request =>
    new Request('http://localhost/x', { headers });

  it('prefers the Authorization header when both are present', () => {
    const req = makeRequest({
      authorization: 'Bearer header-token',
      cookie: 'auth_token=cookie-token',
    });
    expect(getTokenFromRequest(req)).toBe('header-token');
  });

  it('falls back to the cookie when Authorization is missing', () => {
    const req = makeRequest({ cookie: 'auth_token=cookie-token' });
    expect(getTokenFromRequest(req)).toBe('cookie-token');
  });

  it('returns null when neither is present', () => {
    expect(getTokenFromRequest(makeRequest({}))).toBeNull();
  });

  it('falls back to cookie when Authorization is a non-Bearer scheme', () => {
    const req = makeRequest({
      authorization: 'Basic abc',
      cookie: 'auth_token=cookie-token',
    });
    expect(getTokenFromRequest(req)).toBe('cookie-token');
  });
});
