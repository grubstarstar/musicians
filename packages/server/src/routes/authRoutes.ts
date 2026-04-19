import { Hono } from 'hono';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../db.js';
import { users } from '../schema.js';
import { signToken, verifyToken, buildSetCookieHeader, buildClearCookieHeader, getTokenFromRequest } from '../auth.js';

const authRoutes = new Hono();

authRoutes.post('/login', async (c) => {
  const body = await c.req.json<{ username: string; password: string }>();
  const { username, password } = body;

  if (!username || !password) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const [user] = await db.select().from(users).where(eq(users.username, username));

  if (!user) {
    // Prevent timing attacks: compare against a dummy hash
    await bcrypt.compare(password, '$2b$12$KIXJhqtcnFMBpkMzL2CXS.kdwhFhXYNAqPL3GXrVTGUDXB9eZ2Lby');
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const token = await signToken({ sub: String(user.id), username: user.username });
  c.header('Set-Cookie', buildSetCookieHeader(token));
  return c.json({ username: user.username, token });
});

authRoutes.post('/logout', (c) => {
  c.header('Set-Cookie', buildClearCookieHeader());
  return c.json({ ok: true });
});

authRoutes.get('/me', async (c) => {
  // Accept either an Authorization bearer token (mobile) or the auth_token
  // cookie (web). `getTokenFromRequest` checks both in that order.
  const token = getTokenFromRequest(c.req.raw);
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return c.json({ username: payload.username });
});

export default authRoutes;
