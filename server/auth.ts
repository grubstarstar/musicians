import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
);

const COOKIE_NAME = 'auth_token';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

export async function signToken(payload: { sub: string; username: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<{ sub: string; username: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { sub: string; username: string };
  } catch {
    return null;
  }
}

export function buildSetCookieHeader(token: string): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`;
}

export function buildClearCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getTokenFromCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}
