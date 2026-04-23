import { describe, expect, it } from 'vitest';
import {
  getTokenFromAuthHeader,
  getTokenFromCookie,
  getTokenFromRequest,
  hasRole,
  signToken,
  verifyToken,
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

// MUS-86: JWT now carries `roles` so clients don't need a round-trip to read
// them. These tests cover sign/verify round-trip plus the
// forward-compatibility normalisation for legacy or malformed tokens.
describe('signToken / verifyToken — roles payload', () => {
  it('round-trips roles through sign + verify', async () => {
    const token = await signToken({ sub: '42', username: 'alice', roles: ['musician', 'promoter'] });
    const payload = await verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe('42');
    expect(payload?.username).toBe('alice');
    expect(payload?.roles).toEqual(['musician', 'promoter']);
  });

  it('preserves an empty roles array without coercing to missing', async () => {
    const token = await signToken({ sub: '1', username: 'bob', roles: [] });
    const payload = await verifyToken(token);
    expect(payload?.roles).toEqual([]);
  });

  it('normalises a missing roles field to an empty array (legacy tokens)', async () => {
    // Mint a token through `jose` directly, simulating a token minted by a
    // pre-MUS-86 server (no `roles` claim). `verifyToken` must tolerate it
    // rather than forcing a logout when the server rolls ahead of clients.
    const { SignJWT } = await import('jose');
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
    );
    const legacy = await new SignJWT({ sub: '7', username: 'legacy' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);
    const payload = await verifyToken(legacy);
    expect(payload).not.toBeNull();
    expect(payload?.roles).toEqual([]);
  });

  it('returns null when sub or username is missing', async () => {
    // Token with only roles should be rejected — no identity is no login.
    const { SignJWT } = await import('jose');
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
    );
    const bad = await new SignJWT({ roles: ['musician'] })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);
    expect(await verifyToken(bad)).toBeNull();
  });
});

describe('hasRole', () => {
  it('returns true when the role is present', () => {
    expect(hasRole({ roles: ['musician', 'promoter'] }, 'musician')).toBe(true);
    expect(hasRole({ roles: ['musician', 'promoter'] }, 'promoter')).toBe(true);
  });

  it('returns false when the role is absent', () => {
    expect(hasRole({ roles: ['musician'] }, 'promoter')).toBe(false);
    expect(hasRole({ roles: [] }, 'musician')).toBe(false);
  });

  it('is case-sensitive (free-text per MUS-86)', () => {
    expect(hasRole({ roles: ['Musician'] }, 'musician')).toBe(false);
    expect(hasRole({ roles: ['musician'] }, 'MUSICIAN')).toBe(false);
  });
});
