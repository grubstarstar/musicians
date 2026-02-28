import { Hono } from 'hono';
import bcrypt from 'bcrypt';
import { db, User } from '../db.js';
import { signToken, verifyToken, buildSetCookieHeader, buildClearCookieHeader, getTokenFromCookie } from '../auth.js';

const authRoutes = new Hono();

authRoutes.post('/login', async (c) => {
  const body = await c.req.json<{ username: string; password: string }>();
  const { username, password } = body;

  if (!username || !password) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;

  if (!user) {
    // Prevent timing attacks: compare against a dummy hash
    await bcrypt.compare(password, '$2b$12$invalidhashfortimingattackprevention00000000000000000000');
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const token = await signToken({ sub: String(user.id), username: user.username });
  c.header('Set-Cookie', buildSetCookieHeader(token));
  return c.json({ username: user.username });
});

authRoutes.post('/logout', (c) => {
  c.header('Set-Cookie', buildClearCookieHeader());
  return c.json({ ok: true });
});

authRoutes.get('/me', async (c) => {
  const token = getTokenFromCookie(c.req.header('cookie'));
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
